-- =====================================================================
-- reminders_test.sql  —  appointment reminder RPC + delivery log.
-- Same conventions as rls_test.sql: fixed uuids, runs in a transaction,
-- rolls back at the end.
-- =====================================================================
begin;
set local role postgres;

create or replace function _assert(p_cond boolean, p_msg text) returns void
language plpgsql as $$
begin
  if not coalesce(p_cond, false) then
    raise exception 'ASSERT FAILED: %', p_msg;
  end if;
  raise notice 'ok: %', p_msg;
end;
$$;

insert into accounts(id, name) values ('00000000-0000-0000-0000-0000000001a1', 'Reminder Acct');
insert into auth.users(id, email) values
  ('00000000-0000-0000-0000-0000000001d1', 'remdoc@test'),
  ('00000000-0000-0000-0000-0000000001ad', 'remadmin@test');
insert into profiles(id, account_id, role, full_name) values
  ('00000000-0000-0000-0000-0000000001d1', '00000000-0000-0000-0000-0000000001a1', 'doctor', 'Dr Rem'),
  ('00000000-0000-0000-0000-0000000001ad', '00000000-0000-0000-0000-0000000001a1', 'admin',  'Rem Admin')
on conflict (id) do update
  set account_id = excluded.account_id, role = excluded.role, full_name = excluded.full_name;
insert into doctors(profile_id) values ('00000000-0000-0000-0000-0000000001d1');
insert into clinics(id, account_id, name, address) values
  ('00000000-0000-0000-0000-0000000001c1', '00000000-0000-0000-0000-0000000001a1', 'Rem Clinic', '1 Rizal St');

-- create_patient accepts email (as the admin, through RLS)
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000001ad', true);
set local role authenticated;
select _assert(
  (select email from create_patient(
     '00000000-0000-0000-0000-0000000001c1', 'Juan Rem', null, null, '0917', null, 'juan@example.com'))
  = 'juan@example.com',
  'create_patient stores email');

-- reminder RPC + log are service-only
do $$
begin
  perform * from appointments_for_reminder(1);
  raise exception 'ASSERT FAILED: authenticated called appointments_for_reminder';
exception when insufficient_privilege then
  raise notice 'ok: authenticated cannot call appointments_for_reminder';
end$$;
do $$
begin
  perform 1 from appointment_reminders;
  raise exception 'ASSERT FAILED: authenticated read appointment_reminders';
exception when insufficient_privilege then
  raise notice 'ok: authenticated cannot read appointment_reminders';
end$$;
reset role;

-- email format check
do $$
begin
  update patients set email = 'not-an-email' where full_name = 'Juan Rem';
  raise exception 'ASSERT FAILED: invalid email accepted';
exception when check_violation then
  raise notice 'ok: invalid email rejected';
end$$;

-- appointment tomorrow 10:00 Manila time
insert into appointments(id, patient_id, doctor_id, clinic_id, scheduled_at)
select '00000000-0000-0000-0000-0000000001e1', id,
       '00000000-0000-0000-0000-0000000001d1', '00000000-0000-0000-0000-0000000001c1',
       ((now() at time zone 'Asia/Manila')::date + 1 + time '10:00') at time zone 'Asia/Manila'
from patients where full_name = 'Juan Rem';

create temp table _due on commit drop as
  select * from appointments_for_reminder(1)
  where appointment_id = '00000000-0000-0000-0000-0000000001e1';
select _assert((select count(*) from _due) = 1, 'tomorrow''s appointment is due');
select _assert((select patient_email from _due) = 'juan@example.com', 'RPC returns patient_email');

-- a failed attempt does not suppress the retry
insert into appointment_reminders(appointment_id, channel, scheduled_at, status, error)
select appointment_id, 'email', scheduled_at, 'failed', '500' from _due;
select _assert(
  exists(select 1 from appointments_for_reminder(1) where appointment_id = '00000000-0000-0000-0000-0000000001e1'),
  'failed send is retried');

-- a sent reminder suppresses it
insert into appointment_reminders(appointment_id, channel, scheduled_at, status, provider_id)
select appointment_id, 'email', scheduled_at, 'sent', 're_1' from _due;
select _assert(
  not exists(select 1 from appointments_for_reminder(1) where appointment_id = '00000000-0000-0000-0000-0000000001e1'),
  'sent reminder is not resent');

-- a second 'sent' row for the same slot is rejected
do $$
begin
  insert into appointment_reminders(appointment_id, channel, scheduled_at, status)
  select appointment_id, 'email', scheduled_at, 'sent' from _due;
  raise exception 'ASSERT FAILED: duplicate sent row accepted';
exception when unique_violation then
  raise notice 'ok: duplicate sent row rejected';
end$$;

-- rescheduling (same day) makes it due again
update appointments set scheduled_at = scheduled_at + interval '2 hours'
 where id = '00000000-0000-0000-0000-0000000001e1';
select _assert(
  exists(select 1 from appointments_for_reminder(1) where appointment_id = '00000000-0000-0000-0000-0000000001e1'),
  'rescheduled appointment gets a fresh reminder');

-- cancelled appointments are never due
update appointments set status = 'cancelled' where id = '00000000-0000-0000-0000-0000000001e1';
select _assert(
  not exists(select 1 from appointments_for_reminder(1) where appointment_id = '00000000-0000-0000-0000-0000000001e1'),
  'cancelled appointment is not reminded');

drop function _assert(boolean, text);
rollback;
