-- =====================================================================
-- merge_patients_test.sql  —  finding and merging duplicate patients (0029).
-- =====================================================================
begin;
set local role postgres;

create or replace function _assert(p_cond boolean, p_msg text) returns void
language plpgsql as $$
begin
  if not coalesce(p_cond, false) then raise exception 'ASSERT FAILED: %', p_msg; end if;
  raise notice 'ok: %', p_msg;
end;
$$;
create or replace function _assert_raises(p_sql text, p_like text, p_msg text) returns void
language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm ilike '%' || p_like || '%' then raise notice 'ok: %', p_msg; return; end if;
    raise exception 'ASSERT FAILED: % (wrong error: %)', p_msg, sqlerrm;
  end;
  raise exception 'ASSERT FAILED: % (no error raised)', p_msg;
end;
$$;
create or replace function _as(p_uid uuid, p_aal text default 'aal2') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated', 'aal', p_aal)::text, true);
  if p_uid is null then reset role; else set local role authenticated; end if;
end;
$$;

-- Account with an admin, a doctor and a secretary; two clinics; another account.
insert into accounts(id, name) values
  ('00000000-0000-0000-0000-00000000e9a1', 'Merging'),
  ('00000000-0000-0000-0000-00000000e9a2', 'Elsewhere');
insert into auth.users(id, email) values
  ('00000000-0000-0000-0000-00000000e9ad', 'm-admin@clinic.test'),
  ('00000000-0000-0000-0000-00000000e9d1', 'm-doc@clinic.test'),
  ('00000000-0000-0000-0000-00000000e9e1', 'm-sec@clinic.test'),
  ('00000000-0000-0000-0000-00000000e9bd', 'm-other@clinic.test');
insert into profiles(id, account_id, role, full_name) values
  ('00000000-0000-0000-0000-00000000e9ad', '00000000-0000-0000-0000-00000000e9a1', 'admin',     'M Admin'),
  ('00000000-0000-0000-0000-00000000e9d1', '00000000-0000-0000-0000-00000000e9a1', 'doctor',    'M Doctor'),
  ('00000000-0000-0000-0000-00000000e9e1', '00000000-0000-0000-0000-00000000e9a1', 'secretary', 'M Secretary'),
  ('00000000-0000-0000-0000-00000000e9bd', '00000000-0000-0000-0000-00000000e9a2', 'admin',     'Other Admin')
on conflict (id) do update set account_id = excluded.account_id, role = excluded.role, full_name = excluded.full_name;
insert into doctors(profile_id) values ('00000000-0000-0000-0000-00000000e9d1') on conflict do nothing;
insert into clinics(id, account_id, name) values
  ('00000000-0000-0000-0000-00000000e9c1', '00000000-0000-0000-0000-00000000e9a1', 'North'),
  ('00000000-0000-0000-0000-00000000e9c2', '00000000-0000-0000-0000-00000000e9a1', 'South');

-- f1/f2: same person (name spacing/case differs, same mobile in two formats).
-- f3/f4: same name, different birthdays: two people.
-- f5: unrelated. f9: same name as f1 but in another account.
insert into patients(id, account_id, full_name, date_of_birth, phone, email, address, created_at) values
  ('00000000-0000-0000-0000-00000000e9f1', '00000000-0000-0000-0000-00000000e9a1', 'Juan dela Cruz',   null,         '09171234567',    null,              null,       now() - interval '2 years'),
  ('00000000-0000-0000-0000-00000000e9f2', '00000000-0000-0000-0000-00000000e9a1', 'juan  Dela Cruz ', '1980-05-01', '+63 917 123 4567', 'juan@mail.test', 'Cebu',     now() - interval '1 day'),
  ('00000000-0000-0000-0000-00000000e9f3', '00000000-0000-0000-0000-00000000e9a1', 'Ana Lim',          '1990-01-01', null,             null,              null,       now() - interval '3 days'),
  ('00000000-0000-0000-0000-00000000e9f4', '00000000-0000-0000-0000-00000000e9a1', 'Ana Lim',          '2001-02-02', null,             null,              null,       now() - interval '2 days'),
  ('00000000-0000-0000-0000-00000000e9f5', '00000000-0000-0000-0000-00000000e9a1', 'Pedro Reyes',      '1980-05-01', '0999',           null,              null,       now()),
  ('00000000-0000-0000-0000-00000000e9f9', '00000000-0000-0000-0000-00000000e9a2', 'Juan dela Cruz',   null,         '09171234567',    null,              null,       now());
insert into patient_clinics(patient_id, clinic_id) values
  ('00000000-0000-0000-0000-00000000e9f1', '00000000-0000-0000-0000-00000000e9c1'),
  ('00000000-0000-0000-0000-00000000e9f2', '00000000-0000-0000-0000-00000000e9c1'),
  ('00000000-0000-0000-0000-00000000e9f2', '00000000-0000-0000-0000-00000000e9c2');

-- The duplicate has history: an appointment, a visit with a prescription and lab, a problem.
insert into appointments(id, patient_id, doctor_id, clinic_id, scheduled_at, status) values
  ('00000000-0000-0000-0000-00000000e911', '00000000-0000-0000-0000-00000000e9f2', '00000000-0000-0000-0000-00000000e9d1',
   '00000000-0000-0000-0000-00000000e9c2', now() - interval '1 hour', 'completed');
insert into medical_records(id, patient_id, doctor_id, appointment_id, clinic_id, diagnosis) values
  ('00000000-0000-0000-0000-00000000e921', '00000000-0000-0000-0000-00000000e9f2', '00000000-0000-0000-0000-00000000e9d1',
   '00000000-0000-0000-0000-00000000e911', '00000000-0000-0000-0000-00000000e9c2', 'URTI');
insert into prescriptions(medical_record_id, patient_id, name) values
  ('00000000-0000-0000-0000-00000000e921', '00000000-0000-0000-0000-00000000e9f2', 'Paracetamol');
insert into lab_orders(medical_record_id, patient_id, name) values
  ('00000000-0000-0000-0000-00000000e921', '00000000-0000-0000-0000-00000000e9f2', 'CBC');
insert into patient_conditions(patient_id, name) values
  ('00000000-0000-0000-0000-00000000e9f2', 'Asthma');

-- ---------- suggestions ----------
select _as('00000000-0000-0000-0000-00000000e9e1');
select _assert_raises($q$ select * from admin_find_duplicate_patients() $q$, 'forbidden', 'secretary cannot list duplicates');
select _as('00000000-0000-0000-0000-00000000e9ad', 'aal1');
select _assert_raises($q$ select * from admin_find_duplicate_patients() $q$, 'forbidden', 'admin without 2FA cannot list duplicates');

select _as('00000000-0000-0000-0000-00000000e9ad');
select _assert((select reason from admin_find_duplicate_patients()
                 where patient_a = '00000000-0000-0000-0000-00000000e9f1' and patient_b = '00000000-0000-0000-0000-00000000e9f2')
               = 'Same name and mobile', 'same name + same mobile in another format is suggested (older first)');
select _assert(not exists (select 1 from admin_find_duplicate_patients()
                 where '00000000-0000-0000-0000-00000000e9f3' in (patient_a, patient_b)),
  'same name with different birthdays is not suggested');
select _assert(not exists (select 1 from admin_find_duplicate_patients()
                 where '00000000-0000-0000-0000-00000000e9f5' in (patient_a, patient_b)),
  'same birthday without matching contact details is not suggested');
select _assert(not exists (select 1 from admin_find_duplicate_patients()
                 where '00000000-0000-0000-0000-00000000e9f9' in (patient_a, patient_b)),
  'patients in another account are never suggested');

-- "Not duplicates" hides a pair.
insert into patient_not_duplicates(account_id, patient_a, patient_b, dismissed_by) values
  ('00000000-0000-0000-0000-00000000e9a1', '00000000-0000-0000-0000-00000000e9f1', '00000000-0000-0000-0000-00000000e9f2',
   '00000000-0000-0000-0000-00000000e9ad');
select _assert((select count(*) from admin_find_duplicate_patients()) = 0, 'dismissed pair is no longer suggested');
delete from patient_not_duplicates;

select _as('00000000-0000-0000-0000-00000000e9d1');
select _assert_raises($q$ insert into patient_not_duplicates(account_id, patient_a, patient_b) values
  ('00000000-0000-0000-0000-00000000e9a1', '00000000-0000-0000-0000-00000000e9f3', '00000000-0000-0000-0000-00000000e9f4') $q$,
  'row-level security', 'doctor cannot mark patients as not duplicates');

-- ---------- merge: who may ----------
select _assert_raises($q$ select admin_merge_patients('00000000-0000-0000-0000-00000000e9f1', '00000000-0000-0000-0000-00000000e9f2') $q$,
  'forbidden', 'doctor cannot merge');
select _as('00000000-0000-0000-0000-00000000e9ad', 'aal1');
select _assert_raises($q$ select admin_merge_patients('00000000-0000-0000-0000-00000000e9f1', '00000000-0000-0000-0000-00000000e9f2') $q$,
  'forbidden', 'admin without 2FA cannot merge');
select _as('00000000-0000-0000-0000-00000000e9bd');
select _assert_raises($q$ select admin_merge_patients('00000000-0000-0000-0000-00000000e9f1', '00000000-0000-0000-0000-00000000e9f2') $q$,
  'not_found', 'admin of another account cannot merge');
select _as('00000000-0000-0000-0000-00000000e9ad');
select _assert_raises($q$ select admin_merge_patients('00000000-0000-0000-0000-00000000e9f1', '00000000-0000-0000-0000-00000000e9f9') $q$,
  'not_found', 'cannot merge a patient from another account');
select _assert_raises($q$ select admin_merge_patients('00000000-0000-0000-0000-00000000e9f1', '00000000-0000-0000-0000-00000000e9f1') $q$,
  'same_patient', 'cannot merge a patient into itself');

-- ---------- merge f2 into f1 ----------
select _assert((select admin_merge_patients('00000000-0000-0000-0000-00000000e9f1', '00000000-0000-0000-0000-00000000e9f2'))
               = '{"appointments":1,"visits":1,"prescriptions":1,"lab_orders":1,"conditions":1}'::jsonb,
  'merge reports what moved');
select _assert(not exists (select 1 from patients where id = '00000000-0000-0000-0000-00000000e9f2'), 'duplicate is deleted');
select _assert((select count(*) from appointments where patient_id = '00000000-0000-0000-0000-00000000e9f1') = 1
           and (select count(*) from medical_records where patient_id = '00000000-0000-0000-0000-00000000e9f1') = 1
           and (select count(*) from prescriptions where patient_id = '00000000-0000-0000-0000-00000000e9f1') = 1
           and (select count(*) from lab_orders where patient_id = '00000000-0000-0000-0000-00000000e9f1') = 1
           and (select count(*) from patient_conditions where patient_id = '00000000-0000-0000-0000-00000000e9f1') = 1,
  'history moved to the kept patient');
select _assert((select count(*) from patient_clinics where patient_id = '00000000-0000-0000-0000-00000000e9f1') = 2,
  'kept patient is linked to both clinics (no duplicate link)');
select _assert((select full_name = 'Juan dela Cruz' and phone = '09171234567' and date_of_birth = '1980-05-01'
                   and email = 'juan@mail.test' and address = 'Cebu'
                from patients where id = '00000000-0000-0000-0000-00000000e9f1'),
  'kept details win; blanks are filled from the duplicate');
select _assert(exists (select 1 from audit_log where table_name = 'patients' and row_id = '00000000-0000-0000-0000-00000000e9f1'
                and after ->> 'merged_into' = '00000000-0000-0000-0000-00000000e9f1'
                and before -> 'merged_patient' ->> 'id' = '00000000-0000-0000-0000-00000000e9f2'),
  'merge is written to the audit log with the removed record');

rollback;
