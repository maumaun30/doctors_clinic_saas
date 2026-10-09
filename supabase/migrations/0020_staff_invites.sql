-- =====================================================================
-- 0020_staff_invites.sql
-- Admins invite staff by email with the role preset, instead of new
-- sign-ins waiting in "Pending users".
--
--   * staff_invites — one row per invite; admins of the account manage
--     them through RLS. At most one open invite per (account, email).
--     Expires after 7 days. Writes respect read-only billing gating.
--   * accept_pending_invite() — called by the app for a signed-in user
--     who is still pending. Matches their *verified* email to an open,
--     unexpired invite, assigns role + account (creating the doctors row
--     for doctors, like admin_assign_user) and marks the invite accepted.
--     Never changes a user who already has an account.
-- =====================================================================

create table if not exists staff_invites (
  id           uuid primary key default gen_random_uuid(),
  account_id   uuid not null references accounts(id) on delete cascade,
  email        text not null check (email = lower(btrim(email)) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role         user_role not null check (role in ('admin', 'doctor', 'secretary')),
  invited_by   uuid references profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '7 days',
  accepted_at  timestamptz,
  accepted_by  uuid references profiles(id) on delete set null,
  revoked_at   timestamptz
);
create unique index if not exists staff_invites_open_uq
  on staff_invites(account_id, email)
  where accepted_at is null and revoked_at is null;
create index if not exists staff_invites_email_idx on staff_invites(email);

alter table staff_invites enable row level security;

drop policy if exists staff_invites_admin_select on staff_invites;
create policy staff_invites_admin_select on staff_invites for select to authenticated
  using (is_admin() and account_id = current_account_id());

drop policy if exists staff_invites_admin_insert on staff_invites;
create policy staff_invites_admin_insert on staff_invites for insert to authenticated
  with check (is_admin() and account_id = current_account_id() and invited_by = auth.uid());

-- Admins may only revoke (or extend) open invites; accepting goes through the RPC.
drop policy if exists staff_invites_admin_update on staff_invites;
create policy staff_invites_admin_update on staff_invites for update to authenticated
  using (is_admin() and account_id = current_account_id() and accepted_at is null)
  with check (is_admin() and account_id = current_account_id() and accepted_at is null);

-- Read-only accounts can't send invites (same trigger as 0018).
drop trigger if exists zz_account_writable_staff_invites on staff_invites;
create trigger zz_account_writable_staff_invites before insert or update or delete on staff_invites
  for each row execute function enforce_account_writable();

-- ---------------------------------------------------------------------
create or replace function accept_pending_invite()
returns table (role user_role, account_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_email   text;
  v_profile profiles;
  v_invite  staff_invites;
begin
  if v_uid is null then return; end if;

  select lower(u.email::text) into v_email
    from auth.users u
   where u.id = v_uid and u.email_confirmed_at is not null;
  if v_email is null then return; end if;           -- unverified email: no match

  select * into v_profile from profiles p where p.id = v_uid for update;
  if v_profile.id is null or v_profile.account_id is not null then return; end if;

  select * into v_invite
    from staff_invites i
   where i.email = v_email
     and i.accepted_at is null
     and i.revoked_at is null
     and i.expires_at > now()
   order by i.created_at desc
   limit 1
   for update;
  if v_invite.id is null then return; end if;

  update profiles p
     set role = v_invite.role, account_id = v_invite.account_id
   where p.id = v_uid;

  if v_invite.role = 'doctor' then
    insert into doctors(profile_id) values (v_uid) on conflict (profile_id) do nothing;
  end if;

  update staff_invites i
     set accepted_at = now(), accepted_by = v_uid
   where i.id = v_invite.id;

  return query select v_invite.role, v_invite.account_id;
end;
$$;

revoke all on function accept_pending_invite() from public, anon;
grant execute on function accept_pending_invite() to authenticated;
