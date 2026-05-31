-- =====================================================================
-- 0003_rpcs.sql  —  Server-side RPCs (security definer).
-- These are the only path for: admin provisioning of users, atomic
-- appointment booking, and appointment completion -> medical record.
-- =====================================================================

-- ---------------------------------------------------------------------
-- admin_assign_user(target_user_id, target_role, target_account_id?)
-- Admins promote a 'pending' user into their account with a role.
-- Cannot be used to escalate yourself or to move users across accounts
-- you don't own.
-- ---------------------------------------------------------------------
create or replace function admin_assign_user(
  p_user_id    uuid,
  p_role       user_role,
  p_account_id uuid default null
)
returns profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role     user_role;
  caller_account  uuid;
  target_account  uuid;
  updated         profiles;
begin
  select role, account_id into caller_role, caller_account
  from profiles where id = auth.uid();

  if caller_role is null or caller_role <> 'admin' or caller_account is null then
    raise exception 'forbidden: admin only';
  end if;

  if p_role = 'pending' then
    raise exception 'cannot assign role=pending';
  end if;

  target_account := coalesce(p_account_id, caller_account);
  if target_account <> caller_account then
    raise exception 'forbidden: cross-account assignment';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'cannot self-assign role';
  end if;

  update profiles
     set role = p_role,
         account_id = target_account
   where id = p_user_id
  returning * into updated;

  if not found then
    raise exception 'user not found';
  end if;

  if p_role = 'doctor' then
    insert into doctors(profile_id) values (p_user_id)
    on conflict (profile_id) do nothing;
  end if;

  return updated;
end;
$$;

revoke all on function admin_assign_user(uuid, user_role, uuid) from public;
grant execute on function admin_assign_user(uuid, user_role, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- book_appointment — atomic: validates availability + overlap, inserts.
-- Caller must be admin, the doctor themselves, or an assigned secretary.
-- ---------------------------------------------------------------------
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

  -- account scoping
  select account_id into clinic_account  from clinics  where id = p_clinic_id;
  select account_id into patient_account from patients where id = p_patient_id;
  if clinic_account is null or patient_account is null then
    raise exception 'clinic or patient not found';
  end if;
  if clinic_account <> caller_account or patient_account <> caller_account then
    raise exception 'forbidden: cross-account';
  end if;

  -- doctor must actually practice at clinic
  if not exists (
    select 1 from doctor_clinics
     where doctor_id = p_doctor_id and clinic_id = p_clinic_id
  ) then
    raise exception 'doctor does not practice at this clinic';
  end if;

  -- caller permission
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

  -- availability window check (clinic-local time = Asia/Manila for MVP)
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
  if not has_slot then
    raise exception 'doctor not available at requested time';
  end if;

  -- overlap check against active appointments
  select count(*) into overlap_count
  from appointments a
  where a.doctor_id = p_doctor_id
    and a.status in ('scheduled','confirmed')
    and tstzrange(a.scheduled_at,
                  a.scheduled_at + make_interval(mins => a.duration_minutes), '[)')
        && tstzrange(p_scheduled_at,
                     p_scheduled_at + make_interval(mins => p_duration_minutes), '[)');
  if overlap_count > 0 then
    raise exception 'doctor double-booked';
  end if;

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

revoke all on function book_appointment(uuid, uuid, uuid, timestamptz, int, text) from public;
grant execute on function book_appointment(uuid, uuid, uuid, timestamptz, int, text) to authenticated;

-- ---------------------------------------------------------------------
-- complete_appointment — sets status='completed' and creates the linked
-- medical_record in a single transaction. Doctor-only.
-- ---------------------------------------------------------------------
create or replace function complete_appointment(
  p_appointment_id  uuid,
  p_chief_complaint text default null,
  p_diagnosis       text default null,
  p_vitals          jsonb default null,
  p_notes           text default null
)
returns medical_records
language plpgsql
security definer
set search_path = public
as $$
declare
  appt       appointments;
  inserted   medical_records;
begin
  select * into appt from appointments where id = p_appointment_id;
  if not found then
    raise exception 'appointment not found';
  end if;
  if appt.doctor_id <> auth.uid() then
    raise exception 'forbidden: only the treating doctor may complete';
  end if;

  update appointments set status = 'completed' where id = p_appointment_id;

  insert into medical_records(
    patient_id, doctor_id, appointment_id, clinic_id,
    visit_date, chief_complaint, diagnosis, vitals, notes
  ) values (
    appt.patient_id, appt.doctor_id, appt.id, appt.clinic_id,
    (appt.scheduled_at at time zone 'Asia/Manila')::date,
    p_chief_complaint, p_diagnosis, p_vitals, p_notes
  )
  returning * into inserted;

  return inserted;
end;
$$;

revoke all on function complete_appointment(uuid, text, text, jsonb, text) from public;
grant execute on function complete_appointment(uuid, text, text, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------
-- bootstrap_first_admin(email, account_name)
-- One-time helper. Promotes a known auth user to admin and creates an
-- account if none is attached. Intentionally requires service_role
-- (revoked from authenticated/anon). Document usage in README.
-- ---------------------------------------------------------------------
create or replace function bootstrap_first_admin(
  p_email        text,
  p_account_name text
)
returns profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  uid    uuid;
  acc_id uuid;
  out_row profiles;
begin
  select id into uid from auth.users where email = p_email;
  if uid is null then
    raise exception 'no auth user with email %', p_email;
  end if;

  select account_id into acc_id from profiles where id = uid;
  if acc_id is null then
    insert into accounts(name) values (p_account_name) returning id into acc_id;
  end if;

  update profiles
     set role = 'admin', account_id = acc_id
   where id = uid
  returning * into out_row;

  return out_row;
end;
$$;

revoke all on function bootstrap_first_admin(text, text) from public;
-- (no grant to authenticated; call via SQL editor / service_role)
