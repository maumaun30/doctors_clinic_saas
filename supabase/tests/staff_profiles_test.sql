-- =====================================================================
-- staff_profiles_test.sql  —  colleagues' name/role/picture (0026).
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
create or replace function _as(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  if p_uid is null then reset role; else set local role authenticated; end if;
end;
$$;

insert into accounts(id, name) values
  ('00000000-0000-0000-0000-00000000c0a1', 'Staff A'),
  ('00000000-0000-0000-0000-00000000c0a2', 'Staff B');
insert into auth.users(id, email) values
  ('00000000-0000-0000-0000-00000000c0d1', 'sp-doc@clinic.test'),
  ('00000000-0000-0000-0000-00000000c0e1', 'sp-sec@clinic.test'),
  ('00000000-0000-0000-0000-00000000c0d2', 'sp-other@clinic.test'),
  ('00000000-0000-0000-0000-00000000c0f1', 'sp-pending@clinic.test');
insert into profiles(id, account_id, role, full_name, phone) values
  ('00000000-0000-0000-0000-00000000c0d1', '00000000-0000-0000-0000-00000000c0a1', 'doctor',    'SP Doctor',    '0917 000 0001'),
  ('00000000-0000-0000-0000-00000000c0e1', '00000000-0000-0000-0000-00000000c0a1', 'secretary', 'SP Secretary', '0917 000 0002'),
  ('00000000-0000-0000-0000-00000000c0d2', '00000000-0000-0000-0000-00000000c0a2', 'doctor',    'Other Doctor', null),
  ('00000000-0000-0000-0000-00000000c0f1', null,                                   'pending',   'SP Pending',   null)
on conflict (id) do update set account_id = excluded.account_id, role = excluded.role,
  full_name = excluded.full_name, phone = excluded.phone;
insert into doctors(profile_id) values ('00000000-0000-0000-0000-00000000c0d1'), ('00000000-0000-0000-0000-00000000c0d2')
on conflict do nothing;

-- ---- secretary ----
select _as('00000000-0000-0000-0000-00000000c0e1');
select _assert(not exists(select 1 from profiles where id = '00000000-0000-0000-0000-00000000c0d1'),
  'secretary still cannot read the doctor''s profiles row (phone stays private)');
select _assert(exists(select 1 from staff_profiles where id = '00000000-0000-0000-0000-00000000c0d1' and full_name = 'SP Doctor'),
  'secretary sees same-account doctor in staff_profiles');
select _assert(not exists(select 1 from staff_profiles where id = '00000000-0000-0000-0000-00000000c0d2'),
  'secretary does not see another account''s doctor');
select _assert(exists(select 1 from doctors where profile_id = '00000000-0000-0000-0000-00000000c0d1'),
  'secretary sees same-account doctor in doctors');
select _assert(not exists(select 1 from doctors where profile_id = '00000000-0000-0000-0000-00000000c0d2'),
  'secretary does not see another account''s doctor in doctors');
select _assert(not exists(select 1 from information_schema.columns where table_name = 'staff_profiles' and column_name = 'phone'),
  'staff_profiles has no phone column');

-- ---- pending user (no account) sees nobody ----
select _as('00000000-0000-0000-0000-00000000c0f1');
select _assert((select count(*) from staff_profiles) = 0, 'pending user sees no staff');

-- ---- anon cannot read it ----
select _as(null);
set local role anon;
select _assert(not has_table_privilege('anon', 'staff_profiles', 'select'), 'anon has no access');
reset role;

drop function _assert(boolean, text);
drop function _as(uuid);
rollback;
