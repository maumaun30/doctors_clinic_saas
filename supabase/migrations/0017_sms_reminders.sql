-- =====================================================================
-- 0017_sms_reminders.sql
-- appointments_for_reminder gains p_channel ('email' | 'sms') so each
-- channel is deduped independently against appointment_reminders: an
-- email already sent does not suppress the SMS, and vice versa.
-- Default stays 'email', so existing callers keep their behaviour.
-- =====================================================================

drop function if exists appointments_for_reminder(int);

create function appointments_for_reminder(
  p_days_ahead int  default 1,
  p_channel    text default 'email'
)
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
  where p_channel in ('email','sms')
    and a.status in ('scheduled','confirmed')
    and (a.scheduled_at at time zone 'Asia/Manila')::date
        = (now() at time zone 'Asia/Manila')::date + p_days_ahead
    and not exists (
      select 1 from appointment_reminders r
      where r.appointment_id = a.id
        and r.channel = p_channel
        and r.scheduled_at = a.scheduled_at
        and r.status = 'sent'
    )
  order by a.scheduled_at;
$$;

-- service_role / cron only (same policy as 0014).
revoke all on function appointments_for_reminder(int, text) from public, anon, authenticated;
