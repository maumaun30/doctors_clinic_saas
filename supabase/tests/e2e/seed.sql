-- Fixture for reminders e2e: three appointments tomorrow (Manila time)
-- with the same doctor — one emailable, one without email, one whose
-- address the mock Resend server rejects.
insert into accounts(id, name) values ('00000000-0000-0000-0000-0000000002a1', 'E2E');
insert into auth.users(id, email) values ('00000000-0000-0000-0000-0000000002d1', 'e2edoc@test');
insert into profiles(id, account_id, role, full_name) values
  ('00000000-0000-0000-0000-0000000002d1', '00000000-0000-0000-0000-0000000002a1', 'doctor', 'Dr Santos')
on conflict (id) do update
  set account_id = excluded.account_id, role = excluded.role, full_name = excluded.full_name;
insert into doctors(profile_id) values ('00000000-0000-0000-0000-0000000002d1');
insert into clinics(id, account_id, name, address) values
  ('00000000-0000-0000-0000-0000000002c1', '00000000-0000-0000-0000-0000000002a1', 'Bayside Clinic', '2 Roxas Blvd');
insert into patients(id, account_id, full_name, email) values
  ('00000000-0000-0000-0000-0000000002b1', '00000000-0000-0000-0000-0000000002a1', 'Ana <Reyes>', 'ana@example.com'),
  ('00000000-0000-0000-0000-0000000002b2', '00000000-0000-0000-0000-0000000002a1', 'Ben NoEmail', null),
  ('00000000-0000-0000-0000-0000000002b3', '00000000-0000-0000-0000-0000000002a1', 'Cris Fail', 'fail@example.com');
insert into appointments(patient_id, doctor_id, clinic_id, scheduled_at)
select id, '00000000-0000-0000-0000-0000000002d1', '00000000-0000-0000-0000-0000000002c1',
       ((now() at time zone 'Asia/Manila')::date + 1 + time '09:00'
         + (row_number() over (order by id)) * interval '30 min') at time zone 'Asia/Manila'
from patients where account_id = '00000000-0000-0000-0000-0000000002a1';
