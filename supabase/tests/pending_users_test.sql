-- =====================================================================
-- pending_users_test.sql  —  list_pending_users() (0004, fixed in 0019).
-- Regression: auth.users.email is varchar(255) on Supabase; the RPC
-- returned it uncast into a `text` column and failed with 42804.
-- =====================================================================
begin;
set local role postgres;

create or replace function _assert(p_cond boolean, p_msg text) returns void
language plpgsql as $$
begin
  if not coalesce(p_cond, false) then
    raise exception 'ASSERT FAILED: %', p_msg;
  end if;
  raise notice 'ok: %', p_msg;
end;
$$;

insert into accounts(id, name) values ('00000000-0000-0000-0000-0000000007a1', 'Pending Acct');
insert into auth.users(id, email) values
  ('00000000-0000-0000-0000-0000000007ad', 'padmin@test'),
  ('00000000-0000-0000-0000-0000000007b1', 'newbie@test');
insert into profiles(id, account_id, role, full_name) values
  ('00000000-0000-0000-0000-0000000007ad', '00000000-0000-0000-0000-0000000007a1', 'admin', 'P Admin'),
  ('00000000-0000-0000-0000-0000000007b1', null, 'pending', 'New Person')
on conflict (id) do update
  set account_id = excluded.account_id, role = excluded.role, full_name = excluded.full_name;

-- admin sees the pending user, with email
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000007ad', true);
set local role authenticated;
select _assert(
  (select email from list_pending_users() where id = '00000000-0000-0000-0000-0000000007b1') = 'newbie@test',
  'admin lists pending users with email (varchar email cast to text)');
select _assert(
  not exists(select 1 from list_pending_users() where id = '00000000-0000-0000-0000-0000000007ad'),
  'non-pending users are not listed');
reset role;

-- pending user (not admin) is refused
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000007b1', true);
set local role authenticated;
do $$
begin
  perform * from list_pending_users();
  raise exception 'ASSERT FAILED: non-admin listed pending users';
exception when others then
  if sqlerrm like 'ASSERT FAILED%' then raise; end if;
  raise notice 'ok: non-admin is refused (%)', sqlerrm;
end$$;
reset role;

drop function _assert(boolean, text);
rollback;
