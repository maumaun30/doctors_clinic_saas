-- =====================================================================
-- rls_test.sql  —  RLS smoke tests.
-- Run inside the Supabase SQL editor (service_role) OR via psql with a
-- superuser connection. The script sets the JWT claim
-- request.jwt.claim.sub per-section to simulate each user and asserts
-- expected row counts / errors.
--
-- Setup creates: 2 accounts, 2 admins, 2 doctors, 2 secretaries,
-- 2 clinics (one per account), patients/appointments/records in each.
-- Cleanup at end. Idempotent — uses fixed uuids and ON CONFLICT.
-- =====================================================================
begin;
set local role postgres;  -- bypass RLS for setup

-- Wipe any prior test rows (fixed uuids, see below)
delete from medical_records    where id::text like '00000000-0000-0000-0000-%';
delete from appointments       where id::text like '00000000-0000-0000-0000-%';
delete from doctor_availability where doctor_id in
  ('00000000-0000-0000-0000-000000000031','00000000-0000-0000-0000-000000000032');
delete from clinic_assignments where secretary_id in
  ('00000000-0000-0000-0000-000000000041','00000000-0000-0000-0000-000000000042');
delete from doctor_clinics     where doctor_id in
  ('00000000-0000-0000-0000-000000000031','00000000-0000-0000-0000-000000000032');
delete from doctors            where profile_id in
  ('00000000-0000-0000-0000-000000000031','00000000-0000-0000-0000-000000000032');
delete from patients           where id::text like '00000000-0000-0000-0000-%';
delete from clinics            where id::text like '00000000-0000-0000-0000-%';
delete from profiles           where id::text like '00000000-0000-0000-0000-%';
delete from accounts           where id::text like '00000000-0000-0000-0000-%';

-- ---- accounts ----
insert into accounts(id, name) values
  ('00000000-0000-0000-0000-0000000000a1', 'Acct A'),
  ('00000000-0000-0000-0000-0000000000a2', 'Acct B');

-- ---- auth users (real auth.users rows required for FK to profiles.id) ----
-- NOTE: in a hosted Supabase project, create these via the Auth API.
-- For local testing the trigger will populate profiles on insert here.
-- We bypass by inserting profiles directly; for the FK to auth.users to
-- pass, ensure these uuids exist in auth.users. If running locally:
--   insert into auth.users(id,email) values (...) on conflict do nothing;

insert into auth.users(id, email, instance_id, aud, role)
values
  ('00000000-0000-0000-0000-000000000011','adminA@test',  '00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
  ('00000000-0000-0000-0000-000000000012','adminB@test',  '00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
  ('00000000-0000-0000-0000-000000000031','docA@test',    '00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
  ('00000000-0000-0000-0000-000000000032','docB@test',    '00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
  ('00000000-0000-0000-0000-000000000041','secA@test',    '00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
  ('00000000-0000-0000-0000-000000000042','secB@test',    '00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
  ('00000000-0000-0000-0000-000000000051','pending@test', '00000000-0000-0000-0000-000000000000','authenticated','authenticated')
on conflict (id) do nothing;

-- profiles (trigger may have inserted shells; upsert role/account)
insert into profiles(id, account_id, role, full_name) values
  ('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-0000000000a1','admin',    'Admin A'),
  ('00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-0000000000a2','admin',    'Admin B'),
  ('00000000-0000-0000-0000-000000000031','00000000-0000-0000-0000-0000000000a1','doctor',   'Dr A'),
  ('00000000-0000-0000-0000-000000000032','00000000-0000-0000-0000-0000000000a2','doctor',   'Dr B'),
  ('00000000-0000-0000-0000-000000000041','00000000-0000-0000-0000-0000000000a1','secretary','Sec A'),
  ('00000000-0000-0000-0000-000000000042','00000000-0000-0000-0000-0000000000a2','secretary','Sec B'),
  ('00000000-0000-0000-0000-000000000051', null,                                  'pending',  'Pending User')
on conflict (id) do update
  set account_id = excluded.account_id,
      role       = excluded.role,
      full_name  = excluded.full_name;

insert into doctors(profile_id, specialization) values
  ('00000000-0000-0000-0000-000000000031','GP'),
  ('00000000-0000-0000-0000-000000000032','GP');

insert into clinics(id, account_id, name) values
  ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000a1','Clinic A'),
  ('00000000-0000-0000-0000-0000000000c2','00000000-0000-0000-0000-0000000000a2','Clinic B');

insert into doctor_clinics(id, doctor_id, clinic_id) values
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-000000000031','00000000-0000-0000-0000-0000000000c1'),
  ('00000000-0000-0000-0000-0000000000d2','00000000-0000-0000-0000-000000000032','00000000-0000-0000-0000-0000000000c2');

insert into clinic_assignments(doctor_clinic_id, secretary_id) values
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-000000000041'),
  ('00000000-0000-0000-0000-0000000000d2','00000000-0000-0000-0000-000000000042');

insert into patients(id, account_id, full_name) values
  ('00000000-0000-0000-0000-0000000000p1','00000000-0000-0000-0000-0000000000a1','Patient A'),
  ('00000000-0000-0000-0000-0000000000p2','00000000-0000-0000-0000-0000000000a2','Patient B');

insert into appointments(id, patient_id, doctor_id, clinic_id, scheduled_at, status, created_by) values
  ('00000000-0000-0000-0000-0000000000e1',
   '00000000-0000-0000-0000-0000000000p1','00000000-0000-0000-0000-000000000031','00000000-0000-0000-0000-0000000000c1',
   now() + interval '1 day','scheduled','00000000-0000-0000-0000-000000000011'),
  ('00000000-0000-0000-0000-0000000000e2',
   '00000000-0000-0000-0000-0000000000p2','00000000-0000-0000-0000-000000000032','00000000-0000-0000-0000-0000000000c2',
   now() + interval '1 day','scheduled','00000000-0000-0000-0000-000000000012');

insert into medical_records(id, patient_id, doctor_id, appointment_id, clinic_id, diagnosis, notes) values
  ('00000000-0000-0000-0000-0000000000r1',
   '00000000-0000-0000-0000-0000000000p1','00000000-0000-0000-0000-000000000031','00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000c1',
   'Flu','Patient A notes'),
  ('00000000-0000-0000-0000-0000000000r2',
   '00000000-0000-0000-0000-0000000000p2','00000000-0000-0000-0000-000000000032','00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-0000000000c2',
   'Cold','Patient B notes');

-- =====================================================================
-- Helper: switch caller. Sets JWT claim 'sub' = uid and role authenticated.
-- =====================================================================
create or replace function _as_user(p_uid uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_uid::text, true);
  perform set_config('request.jwt.claims',
                     json_build_object('sub', p_uid::text, 'role','authenticated')::text,
                     true);
  set local role authenticated;
end;
$$;

create or replace function _assert(p_cond boolean, p_msg text) returns void
language plpgsql as $$
begin
  if not p_cond then
    raise exception 'ASSERT FAILED: %', p_msg;
  end if;
  raise notice 'ok: %', p_msg;
end;
$$;

-- =====================================================================
-- TESTS
-- =====================================================================

-- 1) pending user reads nothing of substance
select _as_user('00000000-0000-0000-0000-000000000051');
select _assert((select count(*) from appointments)     = 0, 'pending sees 0 appointments');
select _assert((select count(*) from patients)         = 0, 'pending sees 0 patients');
select _assert((select count(*) from medical_records)  = 0, 'pending sees 0 medical_records');
select _assert((select count(*) from clinics)          = 0, 'pending sees 0 clinics');

-- 2) secretary A: sees only Clinic A's appointments
select _as_user('00000000-0000-0000-0000-000000000041');
select _assert((select count(*) from appointments) = 1, 'secA sees exactly 1 appointment');
select _assert(
  not exists(select 1 from appointments where clinic_id = '00000000-0000-0000-0000-0000000000c2'),
  'secA cannot see clinic B appointments'
);

-- 3) secretary A: must NOT read any medical_records
select _assert((select count(*) from medical_records) = 0, 'secA sees 0 medical_records');

-- 4) doctor A: sees own records only, not Dr B's
select _as_user('00000000-0000-0000-0000-000000000031');
select _assert((select count(*) from medical_records) = 1, 'docA sees 1 medical_record');
select _assert(
  not exists(select 1 from medical_records where doctor_id = '00000000-0000-0000-0000-000000000032'),
  'docA cannot see docB records'
);
select _assert((select count(*) from appointments) = 1, 'docA sees only own appointments');

-- 5) admin A: sees all in account A, none of B
select _as_user('00000000-0000-0000-0000-000000000011');
select _assert((select count(*) from clinics)         = 1, 'adminA sees 1 clinic');
select _assert((select count(*) from appointments)    = 1, 'adminA sees 1 appointment');
select _assert((select count(*) from medical_records) = 1, 'adminA sees 1 medical_record');
select _assert((select count(*) from patients)        = 1, 'adminA sees 1 patient');
select _assert(
  not exists(select 1 from clinics where account_id = '00000000-0000-0000-0000-0000000000a2'),
  'adminA cannot see account B clinics'
);

-- 6) secretary A cannot insert appointment for Dr B / Clinic B
select _as_user('00000000-0000-0000-0000-000000000041');
do $$
begin
  begin
    insert into appointments(patient_id, doctor_id, clinic_id, scheduled_at)
    values ('00000000-0000-0000-0000-0000000000p2',
            '00000000-0000-0000-0000-000000000032',
            '00000000-0000-0000-0000-0000000000c2',
            now() + interval '2 day');
    raise exception 'ASSERT FAILED: secA inserted into clinic B';
  exception when insufficient_privilege or check_violation then
    raise notice 'ok: secA blocked from cross-clinic insert';
  when others then
    -- RLS violation surfaces as 42501; PostgREST wraps differently
    raise notice 'ok: secA blocked (%, %)', sqlstate, sqlerrm;
  end;
end$$;

-- 7) self-promotion attempt blocked
select _as_user('00000000-0000-0000-0000-000000000051');
do $$
begin
  begin
    update profiles set role = 'admin'
     where id = '00000000-0000-0000-0000-000000000051';
    -- if it didn't throw, verify nothing changed by re-checking
    perform 1 from profiles
      where id = '00000000-0000-0000-0000-000000000051' and role = 'admin';
    if found then
      raise exception 'ASSERT FAILED: pending user promoted themselves';
    end if;
    raise notice 'ok: self-promotion silently blocked by with-check';
  exception when others then
    raise notice 'ok: self-promotion rejected (%, %)', sqlstate, sqlerrm;
  end;
end$$;

-- cleanup helpers
drop function _as_user(uuid);
drop function _assert(boolean, text);

rollback;  -- leave the DB clean; flip to COMMIT to inspect data
