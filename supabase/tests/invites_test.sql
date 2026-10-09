-- =====================================================================
-- invites_test.sql  —  staff_invites + accept_pending_invite() (0020).
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

-- accounts A (inviting) and B (other)
insert into accounts(id, name) values
  ('00000000-0000-0000-0000-0000000008a1', 'Invite A'),
  ('00000000-0000-0000-0000-0000000008a2', 'Invite B');
insert into auth.users(id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000008ad', 'admin-a@clinic.test', now()),
  ('00000000-0000-0000-0000-0000000008bd', 'admin-b@clinic.test', now()),
  ('00000000-0000-0000-0000-0000000008d1', 'NewDoc@Clinic.Test',  now()),   -- mixed case on purpose
  ('00000000-0000-0000-0000-0000000008e1', 'unverified@clinic.test', null),
  ('00000000-0000-0000-0000-0000000008f1', 'late@clinic.test', now()),
  ('00000000-0000-0000-0000-0000000008c1', 'sec@clinic.test', now());
insert into profiles(id, account_id, role, full_name) values
  ('00000000-0000-0000-0000-0000000008ad', '00000000-0000-0000-0000-0000000008a1', 'admin', 'Admin A'),
  ('00000000-0000-0000-0000-0000000008bd', '00000000-0000-0000-0000-0000000008a2', 'admin', 'Admin B'),
  ('00000000-0000-0000-0000-0000000008d1', null, 'pending', 'New Doc'),
  ('00000000-0000-0000-0000-0000000008e1', null, 'pending', 'Unverified'),
  ('00000000-0000-0000-0000-0000000008f1', null, 'pending', 'Late'),
  ('00000000-0000-0000-0000-0000000008c1', '00000000-0000-0000-0000-0000000008a2', 'secretary', 'Already Staff')
on conflict (id) do update set account_id = excluded.account_id, role = excluded.role, full_name = excluded.full_name;

-- ---- admin A creates invites ----
select _as('00000000-0000-0000-0000-0000000008ad');
insert into staff_invites(account_id, email, role, invited_by) values
  ('00000000-0000-0000-0000-0000000008a1', 'newdoc@clinic.test',     'doctor',    '00000000-0000-0000-0000-0000000008ad'),
  ('00000000-0000-0000-0000-0000000008a1', 'unverified@clinic.test', 'secretary', '00000000-0000-0000-0000-0000000008ad'),
  ('00000000-0000-0000-0000-0000000008a1', 'late@clinic.test',       'secretary', '00000000-0000-0000-0000-0000000008ad'),
  ('00000000-0000-0000-0000-0000000008a1', 'sec@clinic.test',        'secretary', '00000000-0000-0000-0000-0000000008ad');
select _assert((select count(*) from staff_invites) = 4, 'admin sees own account invites');
select _assert_raises($q$ insert into staff_invites(account_id, email, role, invited_by) values
  ('00000000-0000-0000-0000-0000000008a1', 'newdoc@clinic.test', 'doctor', '00000000-0000-0000-0000-0000000008ad') $q$,
  'duplicate key', 'one open invite per email');
select _assert_raises($q$ insert into staff_invites(account_id, email, role, invited_by) values
  ('00000000-0000-0000-0000-0000000008a2', 'x@clinic.test', 'doctor', '00000000-0000-0000-0000-0000000008ad') $q$,
  'row-level security', 'cannot invite into another account');
select _assert_raises($q$ insert into staff_invites(account_id, email, role, invited_by) values
  ('00000000-0000-0000-0000-0000000008a1', 'p@clinic.test', 'pending', '00000000-0000-0000-0000-0000000008ad') $q$,
  'check constraint', 'cannot invite as pending');
select _assert_raises($q$ insert into staff_invites(account_id, email, role, invited_by) values
  ('00000000-0000-0000-0000-0000000008a1', 'Mixed@clinic.test', 'doctor', '00000000-0000-0000-0000-0000000008ad') $q$,
  'check constraint', 'emails must be stored lowercase');

-- ---- other admins / non-admins can't see them ----
select _as('00000000-0000-0000-0000-0000000008bd');
select _assert((select count(*) from staff_invites) = 0, 'admin of another account sees none');
select _as('00000000-0000-0000-0000-0000000008d1');
select _assert((select count(*) from staff_invites) = 0, 'pending user sees no invites');

-- ---- acceptance ----
select _as('00000000-0000-0000-0000-0000000008d1');
select _assert((select role = 'doctor' from accept_pending_invite()), 'verified invitee accepts (case-insensitive email)');
select _as(null);
select _assert((select role = 'doctor' and account_id = '00000000-0000-0000-0000-0000000008a1'
                  from profiles where id = '00000000-0000-0000-0000-0000000008d1'), 'invitee got role + account');
select _assert(exists(select 1 from doctors where profile_id = '00000000-0000-0000-0000-0000000008d1'), 'doctor row created');
select _assert((select accepted_by = '00000000-0000-0000-0000-0000000008d1' from staff_invites where email = 'newdoc@clinic.test'),
  'invite marked accepted');
select _as('00000000-0000-0000-0000-0000000008d1');
select _assert(not exists(select 1 from accept_pending_invite()), 'accepting twice is a no-op');

select _as('00000000-0000-0000-0000-0000000008e1');
select _assert(not exists(select 1 from accept_pending_invite()), 'unverified email cannot accept');

select _as(null);
update staff_invites set expires_at = now() - interval '1 minute' where email = 'late@clinic.test';
select _as('00000000-0000-0000-0000-0000000008f1');
select _assert(not exists(select 1 from accept_pending_invite()), 'expired invite cannot be accepted');

select _as('00000000-0000-0000-0000-0000000008c1');
select _assert(not exists(select 1 from accept_pending_invite()), 'existing staff of another account is not moved');
select _as(null);
select _assert((select account_id = '00000000-0000-0000-0000-0000000008a2' from profiles where id = '00000000-0000-0000-0000-0000000008c1'),
  'existing staff keeps their account');

-- ---- revoke ----
select _as('00000000-0000-0000-0000-0000000008ad');
update staff_invites set revoked_at = now() where email = 'unverified@clinic.test';
select _as(null);
update auth.users set email_confirmed_at = now() where id = '00000000-0000-0000-0000-0000000008e1';
select _as('00000000-0000-0000-0000-0000000008e1');
select _assert(not exists(select 1 from accept_pending_invite()), 'revoked invite cannot be accepted');

-- admins cannot rewrite accepted invites
select _as('00000000-0000-0000-0000-0000000008ad');
update staff_invites set role = 'admin' where email = 'newdoc@clinic.test';
select _as(null);
select _assert((select role = 'doctor' from staff_invites where email = 'newdoc@clinic.test'), 'accepted invite is immutable');

-- ---- read-only accounts can't invite ----
update accounts set trial_ends_at = now() - interval '1 day' where id = '00000000-0000-0000-0000-0000000008a1';
select _as('00000000-0000-0000-0000-0000000008ad');
select _assert_raises($q$ insert into staff_invites(account_id, email, role, invited_by) values
  ('00000000-0000-0000-0000-0000000008a1', 'ro@clinic.test', 'secretary', '00000000-0000-0000-0000-0000000008ad') $q$,
  'account_read_only', 'read-only account cannot invite');
select _as(null);

-- grants
select _assert(not has_function_privilege('anon', 'accept_pending_invite()', 'execute'), 'anon cannot call accept_pending_invite');

drop function _assert(boolean, text);
drop function _assert_raises(text, text, text);
drop function _as(uuid);
rollback;
