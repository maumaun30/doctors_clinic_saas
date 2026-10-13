-- =====================================================================
-- setup_checklist_test.sql  —  hiding the setup checklist (0033).
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

insert into accounts(id, name) values ('00000000-0000-0000-0000-00000000c4a1', 'Checklist');
insert into auth.users(id, email) values
  ('00000000-0000-0000-0000-00000000c4ad', 'cl-admin@clinic.test'),
  ('00000000-0000-0000-0000-00000000c4e1', 'cl-sec@clinic.test');
insert into profiles(id, account_id, role, full_name) values
  ('00000000-0000-0000-0000-00000000c4ad', '00000000-0000-0000-0000-00000000c4a1', 'admin',     'CL Admin'),
  ('00000000-0000-0000-0000-00000000c4e1', '00000000-0000-0000-0000-00000000c4a1', 'secretary', 'CL Secretary')
on conflict (id) do update set account_id = excluded.account_id, role = excluded.role, full_name = excluded.full_name;

select _as('00000000-0000-0000-0000-00000000c4e1');
select _assert_raises($q$ select admin_set_setup_checklist_hidden(true) $q$, 'forbidden', 'secretary cannot hide the checklist');
select _as('00000000-0000-0000-0000-00000000c4ad', 'aal1');
select _assert_raises($q$ select admin_set_setup_checklist_hidden(true) $q$, 'forbidden', 'admin without 2FA cannot hide it');

select _as('00000000-0000-0000-0000-00000000c4ad');
select admin_set_setup_checklist_hidden(true);
select _assert((select setup_checklist_hidden_at is not null from accounts), 'admin hides the checklist');
select admin_set_setup_checklist_hidden(false);
select _assert((select setup_checklist_hidden_at is null from accounts), 'admin shows it again');
with u as (update accounts set setup_checklist_hidden_at = now() returning 1)
select _assert((select count(*) from u) = 0, 'accounts still cannot be updated directly');

select _as(null);
drop function _assert(boolean, text);
drop function _assert_raises(text, text, text);
drop function _as(uuid, text);
rollback;
