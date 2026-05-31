-- =====================================================================
-- 0009_patient_clinics.sql
-- Per-clinic patient visibility. A patient belongs to one or more
-- clinics within an account. Staff see only patients at clinics they
-- are connected to:
--   admin     -> any patient in their account
--   doctor    -> patients at clinics where they practice (doctor_clinics)
--   secretary -> patients at clinics they are assigned to (via clinic_assignments)
-- =====================================================================

create table patient_clinics (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references patients(id) on delete cascade,
  clinic_id   uuid not null references clinics(id)  on delete cascade,
  created_at  timestamptz not null default now(),
  unique (patient_id, clinic_id)
);
create index patient_clinics_clinic_idx on patient_clinics(clinic_id);
create index patient_clinics_patient_idx on patient_clinics(patient_id);

alter table patient_clinics enable row level security;

-- Backfill: link any existing patient that already has an appointment
-- somewhere to that clinic so nothing disappears after this migration.
insert into patient_clinics(patient_id, clinic_id)
select distinct patient_id, clinic_id from appointments
on conflict (patient_id, clinic_id) do nothing;

-- =====================================================================
-- helpers
-- =====================================================================
create or replace function clinics_for_caller()
returns setof uuid
language sql stable security definer
set search_path = public
as $$
  -- All clinics the caller is connected to (doctor or secretary).
  select dc.clinic_id from doctor_clinics dc where dc.doctor_id = auth.uid()
  union
  select dc.clinic_id
    from clinic_assignments ca
    join doctor_clinics dc on dc.id = ca.doctor_clinic_id
   where ca.secretary_id = auth.uid()
$$;

create or replace function can_see_patient(p_patient_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select
    exists (
      select 1 from patients p
      where p.id = p_patient_id
        and p.account_id = current_account_id()
        and is_admin()
    )
    or exists (
      select 1 from patient_clinics pc
      where pc.patient_id = p_patient_id
        and pc.clinic_id in (select clinics_for_caller())
    )
$$;

-- =====================================================================
-- RLS on patient_clinics
-- =====================================================================
create policy patient_clinics_select
  on patient_clinics for select
  using (
    (is_admin() and exists (
       select 1 from patients p
       where p.id = patient_clinics.patient_id
         and p.account_id = current_account_id()))
    or clinic_id in (select clinics_for_caller())
  );

create policy patient_clinics_admin_write
  on patient_clinics for all
  using (is_admin() and exists (
    select 1 from patients p
    where p.id = patient_clinics.patient_id and p.account_id = current_account_id()))
  with check (is_admin() and exists (
    select 1 from patients p
    where p.id = patient_clinics.patient_id and p.account_id = current_account_id()));

create policy patient_clinics_staff_link
  on patient_clinics for insert
  with check (
    clinic_id in (select clinics_for_caller())
    and exists (
      select 1 from patients p
      where p.id = patient_clinics.patient_id
        and p.account_id = current_account_id())
  );

-- =====================================================================
-- Tighten patients_select to per-clinic
-- =====================================================================
drop policy if exists patients_select on patients;

create policy patients_select
  on patients for select
  using (
    account_id = current_account_id()
    and can_see_patient(id)
  );

-- =====================================================================
-- RPC: atomic create_patient that also links to a clinic the caller
-- has access to. Avoids the "I just inserted it but can't see it"
-- chicken-and-egg.
-- =====================================================================

create or replace function create_patient(
  p_clinic_id     uuid,
  p_full_name     text,
  p_date_of_birth date default null,
  p_sex           sex_type default null,
  p_phone         text default null,
  p_address       text default null
)
returns patients
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role     user_role;
  caller_account  uuid;
  clinic_account  uuid;
  allowed         boolean;
  inserted        patients;
begin
  select role, account_id into caller_role, caller_account
    from profiles where id = auth.uid();
  if caller_role is null or caller_role = 'pending' then
    raise exception 'forbidden';
  end if;

  select account_id into clinic_account from clinics where id = p_clinic_id;
  if clinic_account is null then raise exception 'clinic not found'; end if;
  if clinic_account <> caller_account then
    raise exception 'forbidden: cross-account clinic';
  end if;

  if caller_role = 'admin' then
    allowed := true;
  else
    allowed := p_clinic_id in (select clinics_for_caller());
  end if;
  if not allowed then
    raise exception 'forbidden: not connected to this clinic';
  end if;

  insert into patients(account_id, full_name, date_of_birth, sex, phone, address)
  values (caller_account, p_full_name, p_date_of_birth, p_sex, p_phone, p_address)
  returning * into inserted;

  insert into patient_clinics(patient_id, clinic_id)
  values (inserted.id, p_clinic_id);

  return inserted;
end;
$$;

revoke all on function create_patient(uuid, text, date, sex_type, text, text) from public;
grant execute on function create_patient(uuid, text, date, sex_type, text, text) to authenticated;

-- =====================================================================
-- Make book_appointment also auto-link the patient to the clinic, so
-- booking an existing patient at a new clinic works without an admin
-- having to add the link first.
-- =====================================================================

create or replace function book_appointment(
  p_patient_id       uuid,
  p_doctor_id        uuid,
  p_clinic_id        uuid,
  p_scheduled_at     timestamptz,
  p_duration_minutes int default 30,
  p_notes            text default null
)
returns appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role    user_role;
  caller_account uuid;
  clinic_account uuid;
  patient_account uuid;
  has_perm       boolean;
  has_slot       boolean;
  overlap_count  int;
  inserted       appointments;
  scheduled_dow  smallint;
  scheduled_t    time;
  end_t          time;
begin
  select role, account_id into caller_role, caller_account
    from profiles where id = auth.uid();
  if caller_role is null or caller_role = 'pending' then
    raise exception 'forbidden';
  end if;

  select account_id into clinic_account  from clinics  where id = p_clinic_id;
  select account_id into patient_account from patients where id = p_patient_id;
  if clinic_account is null or patient_account is null then
    raise exception 'clinic or patient not found';
  end if;
  if clinic_account <> caller_account or patient_account <> caller_account then
    raise exception 'forbidden: cross-account';
  end if;

  if not exists (
    select 1 from doctor_clinics
     where doctor_id = p_doctor_id and clinic_id = p_clinic_id
  ) then
    raise exception 'doctor does not practice at this clinic';
  end if;

  has_perm :=
    caller_role = 'admin'
    or auth.uid() = p_doctor_id
    or exists (
      select 1
      from clinic_assignments ca
      join doctor_clinics dc on dc.id = ca.doctor_clinic_id
      where ca.secretary_id = auth.uid()
        and dc.doctor_id = p_doctor_id
        and dc.clinic_id = p_clinic_id
    );
  if not has_perm then
    raise exception 'forbidden: not authorized for this doctor/clinic';
  end if;

  scheduled_dow := extract(dow from p_scheduled_at at time zone 'Asia/Manila')::smallint;
  scheduled_t   := (p_scheduled_at at time zone 'Asia/Manila')::time;
  end_t         := (p_scheduled_at + make_interval(mins => p_duration_minutes)
                    at time zone 'Asia/Manila')::time;

  select exists (
    select 1 from doctor_availability
    where doctor_id = p_doctor_id
      and clinic_id = p_clinic_id
      and weekday   = scheduled_dow
      and scheduled_t >= start_time
      and end_t      <= end_time
  ) into has_slot;
  if not has_slot then raise exception 'doctor not available at requested time'; end if;

  select count(*) into overlap_count
  from appointments a
  where a.doctor_id = p_doctor_id
    and a.status in ('scheduled','confirmed')
    and tstzrange(a.scheduled_at,
                  a.scheduled_at + make_interval(mins => a.duration_minutes), '[)')
        && tstzrange(p_scheduled_at,
                     p_scheduled_at + make_interval(mins => p_duration_minutes), '[)');
  if overlap_count > 0 then raise exception 'doctor double-booked'; end if;

  -- auto-link patient to clinic
  insert into patient_clinics(patient_id, clinic_id)
  values (p_patient_id, p_clinic_id)
  on conflict (patient_id, clinic_id) do nothing;

  insert into appointments(
    patient_id, doctor_id, clinic_id, scheduled_at,
    duration_minutes, status, created_by, notes
  ) values (
    p_patient_id, p_doctor_id, p_clinic_id, p_scheduled_at,
    p_duration_minutes, 'scheduled', auth.uid(), p_notes
  )
  returning * into inserted;

  return inserted;
end;
$$;
