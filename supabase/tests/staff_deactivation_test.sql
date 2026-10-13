-- =====================================================================
-- staff_deactivation_test.sql  —  removing / restoring staff access (0027).
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

-- Account with an admin, two doctors, a secretary; one clinic; a patient.
insert into accounts(id, name) values
  ('00000000-0000-0000-0000-00000000d0a1', 'Offboarding'),
  ('00000000-0000-0000-0000-00000000d0a2', 'Elsewhere');
insert into auth.users(id, email) values
  ('00000000-0000-0000-0000-00000000d0ad', 'off-admin@clinic.test'),
  ('00000000-0000-0000-0000-00000000d0d1', 'off-doc1@clinic.test'),
  ('00000000-0000-0000-0000-00000000d0d2', 'off-doc2@clinic.test'),
  ('00000000-0000-0000-0000-00000000d0e1', 'off-sec@clinic.test'),
  ('00000000-0000-0000-0000-00000000d0bd', 'off-other-admin@clinic.test');
insert into profiles(id, account_id, role, full_name) values
  ('00000000-0000-0000-0000-00000000d0ad', '00000000-0000-0000-0000-00000000d0a1', 'admin',     'Off Admin'),
  ('00000000-0000-0000-0000-00000000d0d1', '00000000-0000-0000-0000-00000000d0a1', 'doctor',    'Off Doctor One'),
  ('00000000-0000-0000-0000-00000000d0d2', '00000000-0000-0000-0000-00000000d0a1', 'doctor',    'Off Doctor Two'),
  ('00000000-0000-0000-0000-00000000d0e1', '00000000-0000-0000-0000-00000000d0a1', 'secretary', 'Off Secretary'),
  ('00000000-0000-0000-0000-00000000d0bd', '00000000-0000-0000-0000-00000000d0a2', 'admin',     'Other Admin')
on conflict (id) do update set account_id = excluded.account_id, role = excluded.role, full_name = excluded.full_name;
insert into doctors(profile_id) values
  ('00000000-0000-0000-0000-00000000d0d1'), ('00000000-0000-0000-0000-00000000d0d2')
on conflict do nothing;
insert into clinics(id, account_id, name) values
  ('00000000-0000-0000-0000-00000000d0c1', '00000000-0000-0000-0000-00000000d0a1', 'Off Clinic');
insert into doctor_clinics(doctor_id, clinic_id) values
  ('00000000-0000-0000-0000-00000000d0d1', '00000000-0000-0000-0000-00000000d0c1'),
  ('00000000-0000-0000-0000-00000000d0d2', '00000000-0000-0000-0000-00000000d0c1');
insert into doctor_availability(doctor_id, clinic_id, weekday, start_time, end_time)
select '00000000-0000-0000-0000-00000000d0d1', '00000000-0000-0000-0000-00000000d0c1', d, '08:00', '17:00'
from generate_series(0, 6) d;
insert into patients(id, account_id, full_name) values
  ('00000000-0000-0000-0000-00000000d0f1', '00000000-0000-0000-0000-00000000d0a1', 'Off Patient');
-- Doctor One has an upcoming appointment; Doctor Two only a past one.
insert into appointments(id, patient_id, doctor_id, clinic_id, scheduled_at, status) values
  ('00000000-0000-0000-0000-00000000d011', '00000000-0000-0000-0000-00000000d0f1', '00000000-0000-0000-0000-00000000d0d1',
   '00000000-0000-0000-0000-00000000d0c1', now() + interval '2 days', 'scheduled'),
  ('00000000-0000-0000-0000-00000000d012', '00000000-0000-0000-0000-00000000d0f1', '00000000-0000-0000-0000-00000000d0d2',
   '00000000-0000-0000-0000-00000000d0c1', now() - interval '2 days', 'completed');

-- The secretary supports Doctor One at the clinic.
insert into clinic_assignments(secretary_id, doctor_clinic_id)
select '00000000-0000-0000-0000-00000000d0e1', dc.id from doctor_clinics dc
 where dc.doctor_id = '00000000-0000-0000-0000-00000000d0d1';

select _as('00000000-0000-0000-0000-00000000d0e1');
select _assert((select count(*) from appointments) >= 1, 'setup: active secretary sees their doctor''s appointments');

-- ---------- who may change access ----------
select _as('00000000-0000-0000-0000-00000000d0e1');
select _assert_raises($q$ select admin_set_staff_active('00000000-0000-0000-0000-00000000d0d2', false) $q$,
  'forbidden', 'secretary cannot remove a doctor');

select _as('00000000-0000-0000-0000-00000000d0ad', 'aal1');
select _assert_raises($q$ select admin_set_staff_active('00000000-0000-0000-0000-00000000d0d2', false) $q$,
  'forbidden', 'admin without 2FA cannot remove access');

select _as('00000000-0000-0000-0000-00000000d0bd');
select _assert_raises($q$ select admin_set_staff_active('00000000-0000-0000-0000-00000000d0d2', false) $q$,
  'not_found', 'admin of another account cannot remove access');

select _as('00000000-0000-0000-0000-00000000d0ad');
select _assert_raises($q$ select admin_set_staff_active('00000000-0000-0000-0000-00000000d0ad', false) $q$,
  'cannot_change_self', 'admin cannot remove their own access');
select _assert_raises($q$ select admin_set_staff_active('00000000-0000-0000-0000-00000000d0d1', false) $q$,
  'upcoming_appointments:1', 'doctor with upcoming appointments cannot be removed yet');
select _assert_raises($q$ update profiles set deactivated_at = now() where id = '00000000-0000-0000-0000-00000000d0e1' $q$,
  'row-level security', 'admin cannot set deactivated_at directly (must use the audited function)');

-- ---------- remove Doctor Two and the secretary ----------
select admin_set_staff_active('00000000-0000-0000-0000-00000000d0d2', false);
select admin_set_staff_active('00000000-0000-0000-0000-00000000d0e1', false);
select _assert((select count(*) from audit_log where table_name = 'profiles'
                and row_id = '00000000-0000-0000-0000-00000000d0d2' and after ->> 'access' = 'removed') = 1,
  'removal is written to the audit log');
select _assert((select doctor_count from my_billing_status()) = 1, 'removed doctor no longer counts as a seat');
select _assert(exists(select 1 from staff_profiles where id = '00000000-0000-0000-0000-00000000d0d2' and not active),
  'colleagues still see the removed doctor''s name (history), marked inactive');

-- ---------- the removed secretary has no access ----------
select _as('00000000-0000-0000-0000-00000000d0e1');
select _assert(current_account_id() is null, 'removed user has no account');
select _assert((select count(*) from appointments) = 0, 'removed secretary sees no appointments');
select _assert((select count(*) from patients) = 0, 'removed secretary sees no patients');
select _assert((select count(*) from staff_profiles) = 0, 'removed secretary sees no colleagues');
select _assert_raises($q$ select book_appointment('00000000-0000-0000-0000-00000000d0f1', '00000000-0000-0000-0000-00000000d0d1',
  '00000000-0000-0000-0000-00000000d0c1', ((now() at time zone 'Asia/Manila')::date + 3 + time '10:00') at time zone 'Asia/Manila') $q$,
  'access_removed', 'removed secretary cannot book through the booking function either');
select _assert_raises($q$ update profiles set deactivated_at = null where id = '00000000-0000-0000-0000-00000000d0e1' $q$,
  'row-level security', 'removed user cannot reactivate themselves');

-- ---------- the removed doctor can't be booked ----------
select _as('00000000-0000-0000-0000-00000000d0ad');
select _assert((select count(*) from available_slots('00000000-0000-0000-0000-00000000d0d2',
  '00000000-0000-0000-0000-00000000d0c1', (now() at time zone 'Asia/Manila')::date + 3)) = 0,
  'removed doctor has no open slots');
select _as(null);
select _assert_raises($q$ insert into appointments(patient_id, doctor_id, clinic_id, scheduled_at, status) values
  ('00000000-0000-0000-0000-00000000d0f1', '00000000-0000-0000-0000-00000000d0d2', '00000000-0000-0000-0000-00000000d0c1',
   now() + interval '3 days', 'scheduled') $q$,
  'doctor_inactive', 'no new appointment can be created for a removed doctor, by any path');

-- ---------- restore ----------
select _as('00000000-0000-0000-0000-00000000d0ad');
select admin_set_staff_active('00000000-0000-0000-0000-00000000d0e1', true);
select _as('00000000-0000-0000-0000-00000000d0e1');
select _assert(current_account_id() = '00000000-0000-0000-0000-00000000d0a1', 'restored secretary has their account back');

select _as(null);
drop function _assert(boolean, text);
drop function _assert_raises(text, text, text);
drop function _as(uuid, text);
rollback;
