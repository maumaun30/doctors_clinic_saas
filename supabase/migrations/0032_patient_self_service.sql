-- =====================================================================
-- 0032 — patients confirm or cancel from a link in their reminder.
--
--   * appointments.patient_token: random 80-bit token (20 hex chars,
--     short enough for an SMS). The link /a/<token> is the patient's
--     only credential, so it's never shown to staff-facing APIs beyond
--     what RLS already exposes, and works only for this appointment.
--   * appointments.patient_response / patient_responded_at: what the
--     patient did, shown to staff.
--   * public_appointment(token): what the patient page shows. Both RPCs
--     are for the app server only (service key), like 0016's.
--   * public_respond_appointment(token, 'confirm' | 'cancel'): only for
--     upcoming scheduled/confirmed visits; cancelling closes 2 hours
--     before the start (after that: call the clinic).
--   * appointments_for_reminder() now also returns the token.
-- =====================================================================

alter table appointments
  add column if not exists patient_token text not null unique
    default encode(extensions.gen_random_bytes(10), 'hex'),
  add column if not exists patient_response text check (patient_response in ('confirmed', 'cancelled')),
  add column if not exists patient_responded_at timestamptz;

-- ---------- patient page ----------
create or replace function public_appointment(p_token text)
returns table (
  scheduled_at     timestamptz,
  duration_minutes int,
  status           appointment_status,
  patient_response text,
  patient_first_name text,
  doctor_name      text,
  clinic_name      text,
  clinic_address   text,
  can_confirm      boolean,
  can_cancel       boolean
)
language sql
stable security definer
set search_path = public
as $$
  select a.scheduled_at, a.duration_minutes, a.status, a.patient_response,
         split_part(btrim(p.full_name), ' ', 1),
         dp.full_name, c.name, c.address,
         a.status = 'scheduled' and a.scheduled_at > now(),
         a.status in ('scheduled', 'confirmed') and a.scheduled_at > now() + interval '2 hours'
    from appointments a
    join patients p  on p.id = a.patient_id
    join profiles dp on dp.id = a.doctor_id
    join clinics  c  on c.id = a.clinic_id
   where p_token ~ '^[0-9a-f]{20}$' and a.patient_token = p_token
$$;

-- Called only by the app server (service key), like the 0016 public_* RPCs.
revoke all on function public_appointment(text) from public, anon, authenticated;

create or replace function public_respond_appointment(p_token text, p_action text)
returns appointment_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v appointments;
begin
  if p_action not in ('confirm', 'cancel') then
    raise exception 'respond: unknown action';
  end if;
  select * into v from appointments
   where p_token ~ '^[0-9a-f]{20}$' and patient_token = p_token
   for update;
  if v.id is null then
    raise exception 'respond: this link isn''t valid';
  end if;
  if v.status not in ('scheduled', 'confirmed') or v.scheduled_at <= now() then
    raise exception 'respond: this appointment can''t be changed online any more — please call the clinic';
  end if;

  if p_action = 'confirm' then
    if v.status = 'confirmed' then return v.status; end if;
    update appointments
       set status = 'confirmed', patient_response = 'confirmed', patient_responded_at = now()
     where id = v.id;
    return 'confirmed';
  end if;

  if v.scheduled_at <= now() + interval '2 hours' then
    raise exception 'respond: it''s too close to your appointment to cancel online — please call the clinic';
  end if;
  update appointments
     set status = 'cancelled', patient_response = 'cancelled', patient_responded_at = now()
   where id = v.id;
  return 'cancelled';
end;
$$;

revoke all on function public_respond_appointment(text, text) from public, anon, authenticated;

-- ---------- reminders carry the link token ----------
drop function if exists appointments_for_reminder(int, text);
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
  clinic_address   text,
  patient_token    text
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
    c.address,
    a.patient_token
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
