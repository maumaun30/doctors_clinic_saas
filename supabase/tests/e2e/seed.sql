-- Fixture for reminders e2e: four appointments tomorrow (Manila time)
-- with the same doctor:
--   Ana   email + PH mobile          -> both channels sent
--   Ben   no email, landline         -> skipped on both
--   Cris  email + mobile the mocks reject -> fails on both
--   Dee   no email, mobile           -> SMS only
insert into accounts(id, name) values ('00000000-0000-0000-0000-0000000002a1', 'E2E');
insert into auth.users(id, email) values ('00000000-0000-0000-0000-0000000002d1', 'e2edoc@test');
insert into profiles(id, account_id, role, full_name) values
  ('00000000-0000-0000-0000-0000000002d1', '00000000-0000-0000-0000-0000000002a1', 'doctor', 'Dr Santos')
on conflict (id) do update
  set account_id = excluded.account_id, role = excluded.role, full_name = excluded.full_name;
insert into doctors(profile_id) values ('00000000-0000-0000-0000-0000000002d1');
insert into clinics(id, account_id, name, address) values
  ('00000000-0000-0000-0000-0000000002c1', '00000000-0000-0000-0000-0000000002a1', 'Bayside Clinic', '2 Roxas Blvd');
insert into patients(id, account_id, full_name, email, phone) values
  ('00000000-0000-0000-0000-0000000002b1', '00000000-0000-0000-0000-0000000002a1', 'Ana <Reyes>', 'ana@example.com', '+63 917 111 2222'),
  ('00000000-0000-0000-0000-0000000002b2', '00000000-0000-0000-0000-0000000002a1', 'Ben NoEmail', null, '02 8123 4567'),
  ('00000000-0000-0000-0000-0000000002b3', '00000000-0000-0000-0000-0000000002a1', 'Cris Fail', 'fail@example.com', '0999 000 0000'),
  ('00000000-0000-0000-0000-0000000002b4', '00000000-0000-0000-0000-0000000002a1', 'Dee SmsOnly', null, '0918-222-3333');
insert into appointments(patient_id, doctor_id, clinic_id, scheduled_at)
select id, '00000000-0000-0000-0000-0000000002d1', '00000000-0000-0000-0000-0000000002c1',
       ((now() at time zone 'Asia/Manila')::date + 1 + time '09:00'
         + (row_number() over (order by id)) * interval '30 min') at time zone 'Asia/Manila'
from patients where account_id = '00000000-0000-0000-0000-0000000002a1';
