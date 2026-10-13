-- =====================================================================
-- 0030 — admins without two-factor get no data access at all.
--
-- 0024 made is_admin() require aal2, but staff-level paths still let an
-- admin who signed in with a password only (aal1) act as staff: book
-- appointments, add patients, and read patients/appointments through
-- policies that check the role directly. The app already sends such
-- admins to /mfa; this closes the same gap for direct API calls.
--
--   * caller_is_active() — used by the restrictive zz_caller_active
--     policy on every account-data table — is now false for an aal1
--     admin, so they read and write nothing.
--   * enforce_account_writable() — the write trigger on those tables,
--     which also fires for writes made inside security-definer RPCs —
--     raises mfa_required for them.
--
-- Doctors and secretaries are unaffected. A missing `aal` claim (SQL
-- tests, service jobs) counts as aal2, as in is_admin().
-- =====================================================================

create or replace function caller_is_active()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select not exists (
    select 1 from profiles
     where id = auth.uid()
       and (deactivated_at is not null
            or (role = 'admin' and coalesce(auth.jwt() ->> 'aal', 'aal2') <> 'aal2'))
  )
$$;

create or replace function enforce_account_writable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account     uuid;
  v_role        user_role;
  v_deactivated timestamptz;
begin
  if auth.uid() is null then
    return coalesce(new, old);          -- service_role / system work
  end if;
  select account_id, role, deactivated_at into v_account, v_role, v_deactivated from profiles where id = auth.uid();
  if v_deactivated is not null then
    raise exception 'access_removed: your access to this clinic was removed'
      using errcode = 'P0001';
  end if;
  if v_role = 'admin' and coalesce(auth.jwt() ->> 'aal', 'aal2') <> 'aal2' then
    raise exception 'mfa_required: finish two-factor sign-in first'
      using errcode = 'P0001';
  end if;
  if v_account is not null and not account_is_active(v_account) then
    raise exception 'account_read_only: subscription inactive — ask an admin to subscribe under Admin → Billing'
      using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end;
$$;
revoke all on function enforce_account_writable() from public, anon, authenticated;
