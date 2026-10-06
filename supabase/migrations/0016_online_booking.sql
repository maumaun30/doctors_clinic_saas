-- =====================================================================
-- 0016_online_booking.sql
-- Public patient self-booking at /book/<slug>.
--
--   * clinics.online_booking / clinics.booking_slug — admins opt a clinic
--     in and pick its public URL slug.
--   * appointments.source — 'staff' (default) or 'online', so staff can
--     spot and confirm online bookings.
--   * online_booking_attempts — per-IP-hash log for rate limiting.
--   * public_booking_info / public_available_slots / public_book_appointment
--     — the only surface the public page uses. All service_role only:
--     the page calls them from Server Actions with the service key, so
--     anon still cannot execute any SECURITY DEFINER function (see 0014).
--
-- Booking rules (public_book_appointment):
--   - clinic must have online_booking on; doctor must practice there.
--   - the requested start must be exactly one of available_slots() for
--     that doctor/clinic/date (30-min visits), within the next 60 days.
--     A per-doctor advisory lock serializes concurrent bookings.
--   - an existing patient in the same account is reused only if the name
--     AND (email or phone) both match; otherwise a new patient is created.
--   - rate limits: 5 bookings per IP hash per clinic per hour, and at most
--     2 upcoming online bookings per patient.
--
-- Also fixes available_slots (0010): it stepped a `time` value, which
-- wraps past midnight, so a 09:00–10:30 window produced hundreds of
-- duplicate slots from 00:00 onward. Now steps over timestamps.
-- =====================================================================

alter table clinics
  add column if not exists online_booking boolean not null default false,
  add column if not exists booking_slug   text unique
    check (booking_slug is null or booking_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
           and length(booking_slug) between 3 and 60);

alter table appointments
  add column if not exists source text not null default 'staff'
    check (source in ('staff','online'));

create table if not exists online_booking_attempts (
  id          uuid primary key default gen_random_uuid(),
  clinic_id   uuid not null references clinics(id) on delete cascade,
  ip_hash     text not null,
  created_at  timestamptz not null default now()
);
create index if not exists online_booking_attempts_idx
  on online_booking_attempts(clinic_id, ip_hash, created_at desc);
alter table online_booking_attempts enable row level security;
revoke all on online_booking_attempts from anon, authenticated;

-- ---------------------------------------------------------------------
-- available_slots — fixed: generate slot starts over local timestamps
-- (no midnight wrap, no duplicates). Same signature and semantics.
-- ---------------------------------------------------------------------
create or replace function available_slots(
  p_doctor_id        uuid,
  p_clinic_id        uuid,
  p_date_local       date,
  p_duration_minutes int default 30,
  p_step_minutes     int default 15
)
returns table (slot_start timestamptz)
language plpgsql
stable security definer
set search_path = public
as $$
begin
  if p_duration_minutes <= 0 or p_step_minutes <= 0 then return; end if;

  return query
  with candidates as (
    select distinct (g.local_ts at time zone 'Asia/Manila') as ss
    from doctor_availability da
    cross join lateral generate_series(
      p_date_local + da.start_time,
      p_date_local + da.end_time - make_interval(mins => p_duration_minutes),
      make_interval(mins => p_step_minutes)
    ) as g(local_ts)
    where da.doctor_id = p_doctor_id
      and da.clinic_id = p_clinic_id
      and da.weekday   = extract(dow from p_date_local)::smallint
  )
  select c.ss
  from candidates c
  where c.ss > now()
    and not exists (
      select 1 from appointments a
      where a.doctor_id = p_doctor_id
        and a.status in ('scheduled','confirmed')
        and tstzrange(a.scheduled_at,
                      a.scheduled_at + make_interval(mins => a.duration_minutes), '[)')
            && tstzrange(c.ss, c.ss + make_interval(mins => p_duration_minutes), '[)')
    )
  order by c.ss;
end;
$$;

-- ---------------------------------------------------------------------
-- public_booking_info(slug) — clinic + its doctors, or no row.
-- ---------------------------------------------------------------------
create or replace function public_booking_info(p_slug text)
returns table (
  clinic_id      uuid,
  clinic_name    text,
  clinic_address text,
  doctors        jsonb   -- [{id, name, specialization}]
)
language sql
stable security definer
set search_path = public
as $$
  select c.id, c.name, c.address,
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'id', d.profile_id,
                    'name', p.full_name,
                    'specialization', d.specialization)
                  order by p.full_name)
           from doctor_clinics dc
           join doctors  d on d.profile_id = dc.doctor_id
           join profiles p on p.id = d.profile_id
           where dc.clinic_id = c.id
         ), '[]'::jsonb)
  from clinics c
  where c.booking_slug = lower(p_slug)
    and c.online_booking;
$$;

-- ---------------------------------------------------------------------
-- public_available_slots(slug, doctor, date) — 30-min slots.
-- ---------------------------------------------------------------------
create or replace function public_available_slots(
  p_slug       text,
  p_doctor_id  uuid,
  p_date_local date
)
returns table (slot_start timestamptz)
language plpgsql
stable security definer
set search_path = public
as $$
declare
  v_clinic uuid;
  v_today  date := (now() at time zone 'Asia/Manila')::date;
begin
  select c.id into v_clinic
    from clinics c
   where c.booking_slug = lower(p_slug) and c.online_booking;
  if v_clinic is null then return; end if;
  if not exists (select 1 from doctor_clinics
                  where doctor_id = p_doctor_id and clinic_id = v_clinic) then
    return;
  end if;
  if p_date_local < v_today or p_date_local > v_today + 60 then return; end if;

  return query
    select s.slot_start
      from available_slots(p_doctor_id, v_clinic, p_date_local, 30, 30) s;
end;
$$;

-- ---------------------------------------------------------------------
-- public_book_appointment(...) — returns the new appointment's id/time.
-- Raises with a 'booking:' prefixed message the page shows to the user.
-- ---------------------------------------------------------------------
create or replace function public_book_appointment(
  p_slug          text,
  p_doctor_id     uuid,
  p_scheduled_at  timestamptz,
  p_full_name     text,
  p_phone         text,
  p_email         text default null,
  p_date_of_birth date default null,
  p_ip_hash       text default null
)
returns table (appointment_id uuid, scheduled_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clinic   clinics;
  v_name     text := btrim(p_full_name);
  v_phone    text := nullif(btrim(p_phone), '');
  v_email    text := nullif(lower(btrim(p_email)), '');
  v_digits   text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_local    date := (p_scheduled_at at time zone 'Asia/Manila')::date;
  v_patient  uuid;
  v_appt     appointments;
begin
  select * into v_clinic
    from clinics c
   where c.booking_slug = lower(p_slug) and c.online_booking;
  if v_clinic.id is null then
    raise exception 'booking: online booking is not available for this clinic';
  end if;

  if v_name is null or length(v_name) < 2 or length(v_name) > 200 then
    raise exception 'booking: please enter your full name';
  end if;
  if length(v_digits) < 7 or length(v_digits) > 15 then
    raise exception 'booking: please enter a valid phone number';
  end if;

  if p_ip_hash is not null then
    if (select count(*) from online_booking_attempts a
         where a.clinic_id = v_clinic.id
           and a.ip_hash = p_ip_hash
           and a.created_at > now() - interval '1 hour') >= 5 then
      raise exception 'booking: too many bookings from your network — please try again later or call the clinic';
    end if;
  end if;

  -- One booking at a time per doctor, so the slot check below can't race.
  perform pg_advisory_xact_lock(hashtext('book:' || p_doctor_id::text));

  if not exists (
    select 1 from public_available_slots(p_slug, p_doctor_id, v_local) s
     where s.slot_start = p_scheduled_at
  ) then
    raise exception 'booking: that time is no longer available — please pick another slot';
  end if;

  -- Reuse an existing patient only on name + (email or phone) match.
  select p.id into v_patient
    from patients p
   where p.account_id = v_clinic.account_id
     and lower(btrim(p.full_name)) = lower(v_name)
     and (
       (v_email is not null and lower(p.email) = v_email)
       or regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') = v_digits
     )
   order by p.created_at
   limit 1;

  if v_patient is null then
    insert into patients(account_id, full_name, phone, email, date_of_birth)
    values (v_clinic.account_id, v_name, v_phone, v_email, p_date_of_birth)
    returning id into v_patient;
  else
    if (select count(*) from appointments a
         where a.patient_id = v_patient
           and a.source = 'online'
           and a.status in ('scheduled','confirmed')
           and a.scheduled_at > now()) >= 2 then
      raise exception 'booking: you already have upcoming online bookings — please call the clinic to book more';
    end if;
    -- Fill in contact details we didn't have; never overwrite staff data.
    update patients
       set email = coalesce(email, v_email),
           phone = coalesce(phone, v_phone),
           date_of_birth = coalesce(date_of_birth, p_date_of_birth)
     where id = v_patient;
  end if;

  insert into patient_clinics(patient_id, clinic_id)
  values (v_patient, v_clinic.id)
  on conflict (patient_id, clinic_id) do nothing;

  insert into appointments(
    patient_id, doctor_id, clinic_id, scheduled_at,
    duration_minutes, status, source, notes
  ) values (
    v_patient, p_doctor_id, v_clinic.id, p_scheduled_at,
    30, 'scheduled', 'online', 'Booked online'
  )
  returning * into v_appt;

  if p_ip_hash is not null then
    insert into online_booking_attempts(clinic_id, ip_hash)
    values (v_clinic.id, p_ip_hash);
  end if;

  return query select v_appt.id, v_appt.scheduled_at;
end;
$$;

-- service_role only (same policy as 0014).
revoke all on function public_booking_info(text) from public, anon, authenticated;
revoke all on function public_available_slots(text, uuid, date) from public, anon, authenticated;
revoke all on function public_book_appointment(text, uuid, timestamptz, text, text, text, date, text)
  from public, anon, authenticated;
