-- =====================================================================
-- availability_test.sql  —  only admins write working hours (0023).
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
create or replace function _as(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), true);
  if p_uid is null then reset role; else set local role authenticated; end if;
end;
$$;

insert into accounts(id, name) values ('00000000-0000-0000-0000-000000000aa1', 'Avail');
insert into auth.users(id, email) values
  ('00000000-0000-0000-0000-000000000aad', 'av-admin@clinic.test'),
  ('00000000-0000-0000-0000-000000000ad1', 'av-doc@clinic.test');
insert into profiles(id, account_id, role, full_name) values
  ('00000000-0000-0000-0000-000000000aad', '00000000-0000-0000-0000-000000000aa1', 'admin',  'Av Admin'),
  ('00000000-0000-0000-0000-000000000ad1', '00000000-0000-0000-0000-000000000aa1', 'doctor', 'Av Doc')
on conflict (id) do update set account_id = excluded.account_id, role = excluded.role, full_name = excluded.full_name;
insert into doctors(profile_id) values ('00000000-0000-0000-0000-000000000ad1');
insert into clinics(id, account_id, name) values ('00000000-0000-0000-0000-000000000ac1', '00000000-0000-0000-0000-000000000aa1', 'Av Clinic');
insert into doctor_clinics(doctor_id, clinic_id) values ('00000000-0000-0000-0000-000000000ad1', '00000000-0000-0000-0000-000000000ac1');

select _as('00000000-0000-0000-0000-000000000ad1');
select _assert_raises($q$ insert into doctor_availability(doctor_id, clinic_id, weekday, start_time, end_time)
  values ('00000000-0000-0000-0000-000000000ad1', '00000000-0000-0000-0000-000000000ac1', 1, '09:00', '12:00') $q$,
  'row-level security', 'doctor cannot write own hours');

select _as('00000000-0000-0000-0000-000000000aad');
insert into doctor_availability(doctor_id, clinic_id, weekday, start_time, end_time)
  values ('00000000-0000-0000-0000-000000000ad1', '00000000-0000-0000-0000-000000000ac1', 1, '09:00', '12:00');
select _assert(exists(select 1 from doctor_availability where doctor_id = '00000000-0000-0000-0000-000000000ad1'),
  'admin can write a doctor''s hours');

select _as('00000000-0000-0000-0000-000000000ad1');
select _assert((select count(*) from doctor_availability where doctor_id = '00000000-0000-0000-0000-000000000ad1') = 1,
  'doctor can still read own hours');

select _as(null);
drop function _assert(boolean, text);
drop function _assert_raises(text, text, text);
drop function _as(uuid);
rollback;
