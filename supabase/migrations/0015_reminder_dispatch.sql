-- =====================================================================
-- 0015_reminder_dispatch.sql
-- Real reminder delivery for the appointment_reminders Edge Function.
--
--   * patients.email — where email reminders go.
--   * appointment_reminders — one row per (appointment, channel,
--     scheduled_at) delivery attempt. Lets the function skip anything
--     already sent, so re-running the job (retries, manual invokes)
--     never double-sends. Keyed on scheduled_at too, so a rescheduled
--     appointment gets a fresh reminder for its new time.
--   * appointments_for_reminder() now returns patient_email and skips
--     appointments that already have a successful email reminder.
--
-- appointment_reminders has RLS on and no policies: only service_role
-- (the Edge Function) touches it.
-- =====================================================================

alter table patients add column if not exists email text
  check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');

create table if not exists appointment_reminders (
  id              uuid primary key default gen_random_uuid(),
  appointment_id  uuid not null references appointments(id) on delete cascade,
  channel         text not null check (channel in ('email','sms')),
  scheduled_at    timestamptz not null,   -- appointment time the reminder was for
  status          text not null check (status in ('sent','failed')),
  provider_id     text,                   -- e.g. Resend message id
  error           text,
  attempted_at    timestamptz not null default now()
);
create unique index if not exists appointment_reminders_sent_uq
  on appointment_reminders(appointment_id, channel, scheduled_at)
  where status = 'sent';
create index if not exists appointment_reminders_appt_idx
  on appointment_reminders(appointment_id);

alter table appointment_reminders enable row level security;
revoke all on appointment_reminders from anon, authenticated;

-- Return type changes, so drop + recreate.
drop function if exists appointments_for_reminder(int);

create function appointments_for_reminder(p_days_ahead int default 1)
returns table (
  appointment_id   uuid,
  scheduled_at     timestamptz,
  duration_minutes int,
  patient_name     text,
  patient_phone    text,
  patient_email    text,
  doctor_name      text,
  clinic_name      text,
  clinic_address   text
)
language sql
security definer
set search_path = public
as $$
  select
    a.id,
    a.scheduled_at,
    a.duration_minutes,
    p.full_name,
    p.phone,
    p.email,
    dp.full_name,
    c.name,
    c.address
  from appointments a
  join patients  p  on p.id  = a.patient_id
  join profiles  dp on dp.id = a.doctor_id
  join clinics   c  on c.id  = a.clinic_id
  where a.status in ('scheduled','confirmed')
    and (a.scheduled_at at time zone 'Asia/Manila')::date
        = (now() at time zone 'Asia/Manila')::date + p_days_ahead
    and not exists (
      select 1 from appointment_reminders r
      where r.appointment_id = a.id
        and r.channel = 'email'
        and r.scheduled_at = a.scheduled_at
        and r.status = 'sent'
    )
  order by a.scheduled_at;
$$;

-- service_role / cron only (same policy as 0014).
revoke all on function appointments_for_reminder(int) from public, anon, authenticated;

-- create_patient gains p_email. New signature, so drop the old one
-- rather than leave an ambiguous overload behind.
drop function if exists create_patient(uuid, text, date, sex_type, text, text);

create function create_patient(
  p_clinic_id     uuid,
  p_full_name     text,
  p_date_of_birth date default null,
  p_sex           sex_type default null,
  p_phone         text default null,
  p_address       text default null,
  p_email         text default null
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

  insert into patients(account_id, full_name, date_of_birth, sex, phone, address, email)
  values (caller_account, p_full_name, p_date_of_birth, p_sex, p_phone, p_address, p_email)
  returning * into inserted;

  insert into patient_clinics(patient_id, clinic_id)
  values (inserted.id, p_clinic_id);

  return inserted;
end;
$$;

revoke all on function create_patient(uuid, text, date, sex_type, text, text, text) from public, anon;
grant execute on function create_patient(uuid, text, date, sex_type, text, text, text) to authenticated;
