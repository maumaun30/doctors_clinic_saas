-- =====================================================================
-- 0006_reminders_view.sql
-- Helper for the appointment-reminders Edge Function. Returns active
-- appointments whose PH-local date is tomorrow, with patient + clinic
-- contact info. SECURITY DEFINER so the function (running as
-- service_role anyway) can call it cleanly.
-- =====================================================================

create or replace function appointments_for_reminder(p_days_ahead int default 1)
returns table (
  appointment_id   uuid,
  scheduled_at     timestamptz,
  duration_minutes int,
  patient_name     text,
  patient_phone    text,
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
  order by a.scheduled_at;
$$;

revoke all on function appointments_for_reminder(int) from public;
-- callable only via service_role; not granted to authenticated.
