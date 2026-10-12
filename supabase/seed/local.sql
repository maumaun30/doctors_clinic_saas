-- Local development seed: a realistic-looking account to click around in.
-- LOCAL ONLY — run through ./local.sh, which refuses non-local databases.
-- Re-runnable: wipes the previous seed (fixed account id + *@local.test
-- users) before inserting. All names, phones and records are fictional.
--
-- Logins (password for all: password123)
--   admin@local.test      admin
--   dr.reyes@local.test   doctor  (Internal Medicine; Main + Northside)
--   dr.santos@local.test  doctor  (Pediatrics; Main)
--   sec.cruz@local.test   secretary (both Main Clinic doctors)
--   pending@local.test    signed up, awaiting access

begin;

-- ---------- wipe previous seed ----------
do $$
declare acc uuid := '5eed0000-0000-0000-0000-00000000a001';
begin
  delete from medical_records where clinic_id in (select id from clinics where account_id = acc);
  delete from appointments    where clinic_id in (select id from clinics where account_id = acc);
  delete from accounts where id = acc;
  -- Also clear anything hand-made against these logins earlier.
  delete from medical_records where doctor_id in (select id from auth.users where email like '%@local.test');
  delete from appointments    where doctor_id in (select id from auth.users where email like '%@local.test');
  delete from clinics where account_id in (
    select account_id from profiles p join auth.users u on u.id = p.id where u.email like '%@local.test');
  delete from accounts where id in (
    select account_id from profiles p join auth.users u on u.id = p.id where u.email like '%@local.test');
  delete from auth.users where email like '%@local.test';
end $$;

-- ---------- auth users (profiles rows come from the on_auth_user_created trigger) ----------
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', id::uuid, 'authenticated', 'authenticated', email,
       crypt('password123', gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', name),
       now(), now(), '', '', '', ''
from (values
  ('5eed0000-0000-0000-0000-0000000000a1', 'admin@local.test',     'Local Admin'),
  ('5eed0000-0000-0000-0000-0000000000d1', 'dr.reyes@local.test',  'Dr. Ana Reyes'),
  ('5eed0000-0000-0000-0000-0000000000d2', 'dr.santos@local.test', 'Dr. Miguel Santos'),
  ('5eed0000-0000-0000-0000-0000000000e1', 'sec.cruz@local.test',  'Liza Cruz'),
  ('5eed0000-0000-0000-0000-0000000000f1', 'pending@local.test',   'Paolo Lim')
) as u(id, email, name);

insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, id::text, 'email',
       jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true), now(), now(), now()
from auth.users where email like '%@local.test';

-- ---------- account, roles, clinics ----------
insert into accounts (id, name) values ('5eed0000-0000-0000-0000-00000000a001', 'Reyes Family Health');

update profiles p set account_id = '5eed0000-0000-0000-0000-00000000a001', role = v.role::user_role,
                      full_name = v.name, phone = v.phone
from (values
  ('5eed0000-0000-0000-0000-0000000000a1', 'admin',     'Local Admin',       '0917 555 0100'),
  ('5eed0000-0000-0000-0000-0000000000d1', 'doctor',    'Dr. Ana Reyes',     '0917 555 0101'),
  ('5eed0000-0000-0000-0000-0000000000d2', 'doctor',    'Dr. Miguel Santos', '0917 555 0102'),
  ('5eed0000-0000-0000-0000-0000000000e1', 'secretary', 'Liza Cruz',         '0917 555 0103')
) as v(id, role, name, phone)
where p.id = v.id::uuid;

insert into doctors (profile_id, specialization, prc_license_no) values
  ('5eed0000-0000-0000-0000-0000000000d1', 'Internal Medicine', 'LOCAL-0101'),
  ('5eed0000-0000-0000-0000-0000000000d2', 'Pediatrics',        'LOCAL-0102');

insert into clinics (id, account_id, name, address, online_booking, booking_slug) values
  ('5eed0000-0000-0000-0000-0000000000c1', '5eed0000-0000-0000-0000-00000000a001',
   'Main Clinic', '2F Medical Arts Bldg, 123 Rizal Ave, Makati', true, 'main-clinic'),
  ('5eed0000-0000-0000-0000-0000000000c2', '5eed0000-0000-0000-0000-00000000a001',
   'Northside Clinic', '45 Quirino Hwy, Quezon City', false, null);

insert into doctor_clinics (id, doctor_id, clinic_id) values
  ('5eed0000-0000-0000-0000-0000000000b1', '5eed0000-0000-0000-0000-0000000000d1', '5eed0000-0000-0000-0000-0000000000c1'),
  ('5eed0000-0000-0000-0000-0000000000b2', '5eed0000-0000-0000-0000-0000000000d1', '5eed0000-0000-0000-0000-0000000000c2'),
  ('5eed0000-0000-0000-0000-0000000000b3', '5eed0000-0000-0000-0000-0000000000d2', '5eed0000-0000-0000-0000-0000000000c1');

insert into clinic_assignments (doctor_clinic_id, secretary_id) values
  ('5eed0000-0000-0000-0000-0000000000b1', '5eed0000-0000-0000-0000-0000000000e1'),
  ('5eed0000-0000-0000-0000-0000000000b3', '5eed0000-0000-0000-0000-0000000000e1');

-- Reyes: Main Mon/Wed/Fri 09–12 + 13–17, Northside Tue/Thu 09–15. Santos: Main Mon–Fri 08–14.
insert into doctor_availability (doctor_id, clinic_id, weekday, start_time, end_time)
select '5eed0000-0000-0000-0000-0000000000d1'::uuid, '5eed0000-0000-0000-0000-0000000000c1'::uuid, d, s::time, e::time
from unnest(array[1,3,5]) d, (values ('09:00','12:00'), ('13:00','17:00')) t(s, e)
union all
select '5eed0000-0000-0000-0000-0000000000d1', '5eed0000-0000-0000-0000-0000000000c2', d, '09:00', '15:00'
from unnest(array[2,4]) d
union all
select '5eed0000-0000-0000-0000-0000000000d2', '5eed0000-0000-0000-0000-0000000000c1', d, '08:00', '14:00'
from generate_series(1, 5) d;

-- ---------- most-used library ----------
insert into common_medications (account_id, name, default_dosage, default_frequency, default_instructions)
select '5eed0000-0000-0000-0000-00000000a001', * from (values
  ('Amoxicillin',  '500 mg',   '3x a day',        'Take after meals. Finish the full course.'),
  ('Paracetamol',  '500 mg',   'Every 6 hours',   'As needed for fever or pain.'),
  ('Losartan',     '50 mg',    'Once a day',      'Take in the morning.'),
  ('Metformin',    '500 mg',   '2x a day',        'Take with breakfast and dinner.'),
  ('Cetirizine',   '10 mg',    'Once a day',      'May cause drowsiness.'),
  ('Salbutamol',   '2 puffs',  'Every 4–6 hours', 'Use spacer. As needed for wheezing.'),
  ('Omeprazole',   '20 mg',    'Once a day',      '30 minutes before breakfast.')
) v;

insert into common_lab_tests (account_id, name, description)
select '5eed0000-0000-0000-0000-00000000a001', * from (values
  ('CBC',            'Complete blood count'),
  ('FBS',            'Fasting blood sugar — 8–10 hours fasting'),
  ('Lipid profile',  'Total cholesterol, HDL, LDL, triglycerides'),
  ('Urinalysis',     'Routine urine exam'),
  ('Chest X-ray',    'PA view'),
  ('HbA1c',          'Glycated hemoglobin')
) v;

insert into common_conditions (account_id, name, icd_code)
select '5eed0000-0000-0000-0000-00000000a001', * from (values
  ('Hypertension',              'I10'),
  ('Type 2 diabetes mellitus',  'E11.9'),
  ('Acute upper respiratory infection', 'J06.9'),
  ('Bronchial asthma',          'J45.909'),
  ('Allergic rhinitis',         'J30.9'),
  ('Gastroesophageal reflux disease', 'K21.9')
) v;

-- ---------- patients ----------
insert into patients (id, account_id, full_name, date_of_birth, sex, phone, email, address)
select ('5eed0000-0000-0000-0000-0000000001' || lpad(n::text, 2, '0'))::uuid,
       '5eed0000-0000-0000-0000-00000000a001', name, dob::date, sex::sex_type, phone, email, addr
from (values
  (1,  'Maria Santos',        '1958-03-14', 'female', '0917 210 0001', 'maria.santos@example.com', 'Makati'),
  (2,  'Jose dela Cruz',      '1965-11-02', 'male',   '0917 210 0002', null,                       'Pasay'),
  (3,  'Andrea Villanueva',   '1990-07-21', 'female', '0917 210 0003', 'andrea.v@example.com',     'Taguig'),
  (4,  'Ramon Bautista',      '1972-01-30', 'male',   '0917 210 0004', null,                       'Makati'),
  (5,  'Kristine Mendoza',    '1988-05-09', 'female', '0917 210 0005', 'kmendoza@example.com',     'Manila'),
  (6,  'Paolo Garcia',        '2016-09-12', 'male',   '0917 210 0006', 'garcia.family@example.com','Makati'),
  (7,  'Bea Garcia',          '2019-02-25', 'female', '0917 210 0006', 'garcia.family@example.com','Makati'),
  (8,  'Ernesto Ramos',       '1950-12-05', 'male',   '0917 210 0008', null,                       'Quezon City'),
  (9,  'Liza Aquino',         '1995-04-17', 'female', '0917 210 0009', 'liza.aquino@example.com',  'Quezon City'),
  (10, 'Miguel Torres',       '1983-08-08', 'male',   '0917 210 0010', null,                       'Caloocan'),
  (11, 'Sofia Navarro',       '2012-06-30', 'female', '0917 210 0011', 'navarro.home@example.com', 'Mandaluyong'),
  (12, 'Antonio Castillo',    '1960-10-19', 'male',   '0917 210 0012', null,                       'Quezon City'),
  (13, 'Grace Fernandez',     '1979-03-03', 'female', '0917 210 0013', 'grace.f@example.com',      'Makati'),
  (14, 'Daniel Reyes',        '2021-01-15', 'male',   '0917 210 0014', 'reyes.dan@example.com',    'Pasig'),
  (15, 'Carmela Ocampo',      '1969-07-07', 'female', '0917 210 0015', null,                       'Quezon City'),
  (16, 'Noel Pascual',        '1992-12-24', 'male',   '0917 210 0016', 'noel.p@example.com',       'Taguig')
) as v(n, name, dob, sex, phone, email, addr);

-- Patients 8, 10, 12, 15 are Northside regulars; 9 visits both.
insert into patient_clinics (patient_id, clinic_id)
select p.id, case when right(p.id::text, 2)::int in (8, 10, 12, 15)
                  then '5eed0000-0000-0000-0000-0000000000c2'::uuid
                  else '5eed0000-0000-0000-0000-0000000000c1'::uuid end
from patients p where p.account_id = '5eed0000-0000-0000-0000-00000000a001'
union all
select '5eed0000-0000-0000-0000-000000000109', '5eed0000-0000-0000-0000-0000000000c2';

-- ---------- appointments ----------
-- (patient #, doctor, clinic, day offset from today, Manila time, status, note)
-- Kids (6, 7, 11, 14) see Dr. Santos; Northside patients see Dr. Reyes there.
create temp table seed_appts as
select ('5eed0000-0000-0000-0000-0000000001' || lpad(p::text, 2, '0'))::uuid as patient_id,
       case doc when 'R' then '5eed0000-0000-0000-0000-0000000000d1'::uuid
                else '5eed0000-0000-0000-0000-0000000000d2'::uuid end as doctor_id,
       case clinic when 'M' then '5eed0000-0000-0000-0000-0000000000c1'::uuid
                   else '5eed0000-0000-0000-0000-0000000000c2'::uuid end as clinic_id,
       ((now() at time zone 'Asia/Manila')::date + day_off + t::time) at time zone 'Asia/Manila' as scheduled_at,
       status::appointment_status, note
from (values
  -- three weeks ago → last week
  (1,  'R','M', -20, '09:00', 'completed', 'BP follow-up'),
  (3,  'R','M', -20, '10:00', 'completed', 'Cough for 5 days'),
  (6,  'S','M', -19, '08:30', 'completed', 'Fever'),
  (8,  'R','N', -18, '09:30', 'completed', 'Diabetes check'),
  (12, 'R','N', -18, '11:00', 'no_show',   null),
  (4,  'R','M', -15, '13:30', 'completed', 'Annual physical'),
  (11, 'S','M', -14, '09:00', 'completed', 'Asthma follow-up'),
  (5,  'R','M', -13, '14:00', 'cancelled', 'Patient rescheduled'),
  (13, 'R','M', -13, '15:00', 'completed', 'Heartburn'),
  (10, 'R','N', -11, '10:00', 'completed', 'Back pain'),
  (2,  'R','M',  -8, '09:30', 'completed', 'Hypertension maintenance'),
  (7,  'S','M',  -7, '10:30', 'completed', 'Allergic rash'),
  (14, 'S','M',  -6, '09:00', 'no_show',   null),
  (15, 'R','N',  -4, '13:00', 'completed', 'Lab results review'),
  (9,  'R','M',  -3, '16:00', 'completed', 'Sneezing, itchy eyes'),
  (16, 'R','M',  -1, '09:00', 'cancelled', null),
  -- today
  (1,  'R','M',   0, '09:00', 'completed', 'BP recheck'),
  (5,  'R','M',   0, '09:30', 'completed', 'Rescheduled consult'),
  (6,  'S','M',   0, '10:00', 'no_show',   null),
  (3,  'R','M',   0, '10:30', 'confirmed', 'Follow-up on cough'),
  (14, 'S','M',   0, '11:00', 'confirmed', 'Well-baby check'),
  (13, 'R','M',   0, '13:30', 'scheduled', 'GERD follow-up'),
  (16, 'R','M',   0, '14:30', 'scheduled', 'New patient'),
  (11, 'S','M',   0, '13:00', 'scheduled', null),
  -- upcoming
  (8,  'R','N',   1, '09:00', 'confirmed', 'HbA1c review'),
  (12, 'R','N',   1, '10:00', 'scheduled', 'Rebooked after no-show'),
  (2,  'R','M',   2, '09:30', 'scheduled', null),
  (7,  'S','M',   2, '10:00', 'scheduled', 'Rash follow-up'),
  (4,  'R','M',   3, '13:00', 'scheduled', 'Lipid results'),
  (9,  'R','N',   3, '11:00', 'scheduled', null),
  (10, 'R','N',   6, '09:30', 'scheduled', null),
  (15, 'R','N',   8, '10:00', 'scheduled', null),
  (6,  'S','M',   9, '08:30', 'scheduled', 'Vaccination'),
  (5,  'R','M',  10, '15:00', 'scheduled', null)
) as v(p, doc, clinic, day_off, t, status, note);

insert into appointments (patient_id, doctor_id, clinic_id, scheduled_at, duration_minutes, status, created_by, notes)
select patient_id, doctor_id, clinic_id, scheduled_at, 30, status,
       '5eed0000-0000-0000-0000-0000000000e1', note
from seed_appts;

-- ---------- visit records for completed appointments ----------
insert into medical_records (patient_id, doctor_id, appointment_id, clinic_id, visit_date,
                             chief_complaint, diagnosis, vitals, notes)
select a.patient_id, a.doctor_id, a.id, a.clinic_id, (a.scheduled_at at time zone 'Asia/Manila')::date,
       coalesce(a.notes, 'Consult'),
       case
         when a.notes ilike '%BP%' or a.notes ilike '%hypertension%' then 'Hypertension, controlled'
         when a.notes ilike '%cough%' or a.notes ilike '%fever%'      then 'Acute upper respiratory infection'
         when a.notes ilike '%diabetes%' or a.notes ilike '%lab%'     then 'Type 2 diabetes mellitus'
         when a.notes ilike '%asthma%'                                then 'Bronchial asthma, mild intermittent'
         when a.notes ilike '%sneez%' or a.notes ilike '%rash%'       then 'Allergic rhinitis'
         when a.notes ilike '%heartburn%'                             then 'Gastroesophageal reflux disease'
         when a.notes ilike '%back%'                                  then 'Mechanical low back pain'
         else 'Healthy, no acute findings'
       end,
       jsonb_build_object('bp', (110 + (random() * 40)::int) || '/' || (70 + (random() * 20)::int),
                          'hr', 64 + (random() * 30)::int,
                          'temp', round((36.4 + random() * 1.6)::numeric, 1),
                          'weight_kg', 18 + (random() * 70)::int),
       'Advised to return if symptoms persist.'
from appointments a
where a.status = 'completed' and a.clinic_id in (select id from clinics where account_id = '5eed0000-0000-0000-0000-00000000a001');

insert into prescriptions (medical_record_id, patient_id, medication_id, name, dosage, frequency, duration, instructions)
select r.id, r.patient_id, m.id, m.name, m.default_dosage, m.default_frequency, '7 days', m.default_instructions
from medical_records r
join common_medications m on m.account_id = '5eed0000-0000-0000-0000-00000000a001' and m.name =
  case
    when r.diagnosis like 'Hypertension%'   then 'Losartan'
    when r.diagnosis like 'Acute upper%'    then 'Amoxicillin'
    when r.diagnosis like 'Type 2%'         then 'Metformin'
    when r.diagnosis like 'Bronchial%'      then 'Salbutamol'
    when r.diagnosis like 'Allergic%'       then 'Cetirizine'
    when r.diagnosis like 'Gastro%'         then 'Omeprazole'
    when r.diagnosis like 'Mechanical%'     then 'Paracetamol'
  end
where r.clinic_id in (select id from clinics where account_id = '5eed0000-0000-0000-0000-00000000a001');

insert into lab_orders (medical_record_id, patient_id, lab_test_id, name, status, result, result_at)
select r.id, r.patient_id, l.id, l.name,
       case when r.visit_date < current_date - 7 then 'completed' else 'ordered' end::lab_status,
       case when r.visit_date < current_date - 7 then 'Within normal limits' end,
       case when r.visit_date < current_date - 7 then r.created_at + interval '2 days' end
from medical_records r
join common_lab_tests l on l.account_id = '5eed0000-0000-0000-0000-00000000a001' and l.name =
  case
    when r.diagnosis like 'Type 2%'       then 'HbA1c'
    when r.diagnosis like 'Hypertension%' then 'Lipid profile'
    when r.chief_complaint = 'Annual physical' then 'CBC'
  end
where r.clinic_id in (select id from clinics where account_id = '5eed0000-0000-0000-0000-00000000a001');

insert into patient_conditions (patient_id, condition_id, name, status, since, originating_medical_record_id)
select distinct on (r.patient_id, c.id) r.patient_id, c.id, c.name, 'active', r.visit_date, r.id
from medical_records r
join common_conditions c on c.account_id = '5eed0000-0000-0000-0000-00000000a001' and c.name =
  case
    when r.diagnosis like 'Hypertension%'  then 'Hypertension'
    when r.diagnosis like 'Type 2%'        then 'Type 2 diabetes mellitus'
    when r.diagnosis like 'Bronchial%'     then 'Bronchial asthma'
    when r.diagnosis like 'Gastro%'        then 'Gastroesophageal reflux disease'
  end
where r.clinic_id in (select id from clinics where account_id = '5eed0000-0000-0000-0000-00000000a001')
order by r.patient_id, c.id, r.visit_date;

-- ---------- an open staff invite ----------
insert into staff_invites (account_id, email, role, invited_by)
values ('5eed0000-0000-0000-0000-00000000a001', 'new.doctor@local.test', 'doctor',
        '5eed0000-0000-0000-0000-0000000000a1');

commit;
