-- =====================================================================
-- admin_mfa_test.sql  —  admin powers require a 2FA (aal2) session (0024).
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
-- Act as a user with a given assurance level (null = no aal claim at all).
create or replace function _as(p_uid uuid, p_aal text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), true);
  perform set_config('request.jwt.claims',
    case when p_aal is null then json_build_object('sub', p_uid, 'role', 'authenticated')::text
         else json_build_object('sub', p_uid, 'role', 'authenticated', 'aal', p_aal)::text end, true);
  if p_uid is null then reset role; else set local role authenticated; end if;
end;
$$;

insert into accounts(id, name) values ('00000000-0000-0000-0000-000000000ba1', 'MFA');
insert into auth.users(id, email) values
  ('00000000-0000-0000-0000-000000000bad', 'mfa-admin@clinic.test'),
  ('00000000-0000-0000-0000-000000000b01', 'mfa-newbie@clinic.test');
insert into profiles(id, account_id, role, full_name) values
  ('00000000-0000-0000-0000-000000000bad', '00000000-0000-0000-0000-000000000ba1', 'admin',   'MFA Admin'),
  ('00000000-0000-0000-0000-000000000b01', null,                                   'pending', 'Newbie')
on conflict (id) do update set account_id = excluded.account_id, role = excluded.role, full_name = excluded.full_name;

-- ---- password-only session (aal1) ----
select _as('00000000-0000-0000-0000-000000000bad', 'aal1');
select _assert(not is_admin(), 'aal1 admin is not treated as admin');
select _assert_raises($q$ insert into clinics(account_id, name) values ('00000000-0000-0000-0000-000000000ba1', 'Sneaky') $q$,
  'row-level security', 'aal1 admin cannot add a clinic');
select _assert_raises($q$ select admin_assign_user('00000000-0000-0000-0000-000000000b01', 'secretary') $q$,
  'two-factor', 'aal1 admin cannot assign roles');

-- ---- 2FA session (aal2) ----
select _as('00000000-0000-0000-0000-000000000bad', 'aal2');
select _assert(is_admin(), 'aal2 admin is admin');
insert into clinics(account_id, name) values ('00000000-0000-0000-0000-000000000ba1', 'MFA Clinic');
select _assert(exists(select 1 from clinics where name = 'MFA Clinic'), 'aal2 admin can add a clinic');

-- ---- no aal claim (non-user connections) keeps old behaviour ----
select _as('00000000-0000-0000-0000-000000000bad', null);
select _assert(is_admin(), 'missing aal claim is not blocked');

select _as(null, null);
drop function _assert(boolean, text);
drop function _assert_raises(text, text, text);
drop function _as(uuid, text);
rollback;
