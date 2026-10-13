-- Browser end-to-end test fixture (web/e2e). LOCAL / CI ONLY — loaded by
-- web/e2e/global-setup.ts, which refuses non-local databases.
--
-- Separate from local.sql on purpose: its own account and *@e2e.test
-- logins, so running the tests never touches the demo logins (or the
-- authenticator you set up for admin@local.test). Re-runnable: wipes the
-- previous fixture first, including the admin's 2FA factor.
--
-- Logins (password for all: e2e-test-password)
--   admin@e2e.test    admin (no 2FA yet; the test enrolls it)
--   doctor@e2e.test   doctor at E2E Clinic, open every day 00:00–23:59
--   sec@e2e.test      secretary for that doctor

begin;

-- ---------- wipe previous fixture ----------
do $$
declare acc uuid := 'e2e00000-0000-0000-0000-00000000a001';
begin
  delete from medical_records where clinic_id in (select id from clinics where account_id = acc);
  delete from appointments    where clinic_id in (select id from clinics where account_id = acc);
  delete from accounts where id = acc;
  delete from auth.users where email like '%@e2e.test';
end $$;

-- ---------- auth users (profiles rows come from the on_auth_user_created trigger) ----------
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', id::uuid, 'authenticated', 'authenticated', email,
       crypt('e2e-test-password', gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', name),
       now(), now(), '', '', '', ''
from (values
  ('e2e00000-0000-0000-0000-0000000000a1', 'admin@e2e.test',  'E2E Admin'),
  ('e2e00000-0000-0000-0000-0000000000d1', 'doctor@e2e.test', 'Dr. E2E Doctor'),
  ('e2e00000-0000-0000-0000-0000000000e1', 'sec@e2e.test',    'E2E Secretary')
) as u(id, email, name);

insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, id::text, 'email',
       jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true), now(), now(), now()
from auth.users where email like '%@e2e.test';

-- ---------- account, roles, clinic ----------
insert into accounts (id, name) values ('e2e00000-0000-0000-0000-00000000a001', 'E2E Health');

update profiles p set account_id = 'e2e00000-0000-0000-0000-00000000a001', role = v.role::user_role, full_name = v.name
from (values
  ('e2e00000-0000-0000-0000-0000000000a1', 'admin',     'E2E Admin'),
  ('e2e00000-0000-0000-0000-0000000000d1', 'doctor',    'Dr. E2E Doctor'),
  ('e2e00000-0000-0000-0000-0000000000e1', 'secretary', 'E2E Secretary')
) as v(id, role, name)
where p.id = v.id::uuid;

insert into doctors (profile_id, specialization, prc_license_no) values
  ('e2e00000-0000-0000-0000-0000000000d1', 'Family Medicine', 'E2E-0001');

insert into clinics (id, account_id, name, address, online_booking, booking_slug) values
  ('e2e00000-0000-0000-0000-0000000000c1', 'e2e00000-0000-0000-0000-00000000a001',
   'E2E Clinic', '1 Test St, Makati', true, 'e2e-clinic');

insert into doctor_clinics (id, doctor_id, clinic_id) values
  ('e2e00000-0000-0000-0000-0000000000b1', 'e2e00000-0000-0000-0000-0000000000d1', 'e2e00000-0000-0000-0000-0000000000c1');
insert into clinic_assignments (doctor_clinic_id, secretary_id) values
  ('e2e00000-0000-0000-0000-0000000000b1', 'e2e00000-0000-0000-0000-0000000000e1');

-- Open all day, every day, so tests find times whenever they run.
insert into doctor_availability (doctor_id, clinic_id, weekday, start_time, end_time)
select 'e2e00000-0000-0000-0000-0000000000d1', 'e2e00000-0000-0000-0000-0000000000c1', d, '00:00', '23:59'
from generate_series(0, 6) d;

insert into common_medications (account_id, name, default_dosage, default_frequency, default_instructions) values
  ('e2e00000-0000-0000-0000-00000000a001', 'Paracetamol', '500 mg', 'Every 6 hours', 'As needed for fever or pain.');

-- ---------- a patient with an open appointment for the doctor to see ----------
insert into patients (id, account_id, full_name, date_of_birth, sex, phone) values
  ('e2e00000-0000-0000-0000-000000000101', 'e2e00000-0000-0000-0000-00000000a001',
   'Elena Test', '1985-04-12', 'female', '0917 000 0101');
insert into patient_clinics (patient_id, clinic_id) values
  ('e2e00000-0000-0000-0000-000000000101', 'e2e00000-0000-0000-0000-0000000000c1');
-- Two days ago, so it never collides with a slot the booking tests pick.
insert into appointments (id, patient_id, doctor_id, clinic_id, scheduled_at, status, notes) values
  ('e2e00000-0000-0000-0000-000000000201', 'e2e00000-0000-0000-0000-000000000101',
   'e2e00000-0000-0000-0000-0000000000d1', 'e2e00000-0000-0000-0000-0000000000c1',
   date_trunc('hour', now()) - interval '2 days', 'confirmed', 'Cough for 5 days');

-- Tomorrow 10:00 Manila, with a known reminder-link token for the patient-link test.
insert into appointments (id, patient_id, doctor_id, clinic_id, scheduled_at, status, patient_token) values
  ('e2e00000-0000-0000-0000-000000000202', 'e2e00000-0000-0000-0000-000000000101',
   'e2e00000-0000-0000-0000-0000000000d1', 'e2e00000-0000-0000-0000-0000000000c1',
   ((now() at time zone 'Asia/Manila')::date + 1 + time '10:00') at time zone 'Asia/Manila', 'scheduled',
   'e2e00000000000000001');

commit;
