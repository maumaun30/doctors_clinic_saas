-- =====================================================================
-- 0031 — cap online bookings per clinic.
--
-- public_book_appointment() already limits each network (hashed IP) to
-- 5 bookings an hour per clinic and each patient to 2 upcoming online
-- bookings. Neither stops a flood from many networks with made-up
-- names, which would fill a doctor's calendar with fake patients.
--
-- This adds a clinic-wide ceiling: at most 30 online bookings created
-- in any hour. Staff bookings are not affected. Over the cap, patients
-- see the usual "booking:" message and are asked to call the clinic.
-- =====================================================================

create index if not exists appointments_online_recent_idx
  on appointments(clinic_id, created_at) where source = 'online';

create or replace function enforce_online_booking_clinic_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.source = 'online' and (
    select count(*) from appointments a
     where a.clinic_id = new.clinic_id
       and a.source = 'online'
       and a.created_at > now() - interval '1 hour'
  ) >= 30 then
    raise exception 'booking: this clinic is getting a lot of online bookings right now — please try again later or call the clinic';
  end if;
  return new;
end;
$$;
revoke all on function enforce_online_booking_clinic_cap() from public, anon, authenticated;

drop trigger if exists online_booking_clinic_cap on appointments;
create trigger online_booking_clinic_cap before insert on appointments
  for each row execute function enforce_online_booking_clinic_cap();
