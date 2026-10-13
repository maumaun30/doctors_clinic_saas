-- =====================================================================
-- 0024 — admin powers require two-factor authentication.
--
-- is_admin() gates every admin-only policy and function. It now also
-- requires the session's authenticator assurance level to be aal2
-- (password + TOTP verified). An admin who signed in with a password
-- only (aal1) gets no admin rights until they complete 2FA; the app
-- sends them to /mfa to enroll or verify.
--
-- Missing `aal` claim: real Supabase user tokens always carry it, so it
-- is only absent for connections without a user JWT (SQL tests, service
-- jobs). Those keep the previous behaviour.
--
-- admin_assign_user() checked the role itself instead of is_admin(), so
-- it gets the same requirement.
--
-- Staff-level RPCs that also accept admins as staff (booking, creating
-- patients) still check the role directly; those aren't admin powers.
-- =====================================================================

create or replace function is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin' and account_id is not null
  )
  and coalesce(auth.jwt() ->> 'aal', 'aal2') = 'aal2'
$$;

CREATE OR REPLACE FUNCTION public.admin_assign_user(p_user_id uuid, p_role user_role, p_account_id uuid DEFAULT NULL::uuid)
 RETURNS profiles
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  caller_role     user_role;
  caller_account  uuid;
  target_account  uuid;
  updated         profiles;
begin
  select role, account_id into caller_role, caller_account
  from profiles where id = auth.uid();

  if caller_role is null or caller_role <> 'admin' or caller_account is null then
    raise exception 'forbidden: admin only';
  end if;
  -- Admin powers need a two-factor session (see is_admin()).
  if not is_admin() then
    raise exception 'forbidden: two-factor authentication required';
  end if;

  if p_role = 'pending' then
    raise exception 'cannot assign role=pending';
  end if;

  target_account := coalesce(p_account_id, caller_account);
  if target_account <> caller_account then
    raise exception 'forbidden: cross-account assignment';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'cannot self-assign role';
  end if;

  update profiles
     set role = p_role,
         account_id = target_account
   where id = p_user_id
  returning * into updated;

  if not found then
    raise exception 'user not found';
  end if;

  if p_role = 'doctor' then
    insert into doctors(profile_id) values (p_user_id)
    on conflict (profile_id) do nothing;
  end if;

  return updated;
end;
$function$;
