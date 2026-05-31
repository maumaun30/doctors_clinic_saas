-- =====================================================================
-- 0014_lock_down_function_grants.sql
-- Hardening pass for the Supabase Security Advisor lints
--   0028 anon_security_definer_function_executable
--   0029 authenticated_security_definer_function_executable
--
-- Every SECURITY DEFINER function in `public` is exposed by PostgREST at
-- /rest/v1/rpc/<name> and runs with the owner's privileges (bypassing
-- RLS). Supabase's default privileges grant EXECUTE explicitly to the
-- `anon` role on new functions, so the earlier `revoke all ... from
-- public` statements did NOT keep unauthenticated callers out. This
-- migration fixes that.
--
-- Policy:
--   1. No SECURITY DEFINER function in public is callable by `anon`.
--      The app requires a session for everything, so anon never needs any.
--   2. Trigger functions, the audit account-resolver, and the
--      service_role-only RPCs are not callable by `authenticated` either
--      (triggers fire as the definer; the others are SQL-editor / cron
--      only). Only postgres / service_role retain access.
--   3. RLS helper predicates and the genuine app RPCs are re-granted to
--      `authenticated` explicitly, so RLS evaluation and the app keep
--      working regardless of how the original grant was wired.
--
-- Idempotent: safe to re-run.
-- =====================================================================

-- 1) Revoke anon (and the PUBLIC pseudo-role) from every SECURITY
--    DEFINER function in public.
do $$
declare fn record;
begin
  for fn in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
  loop
    execute format('revoke execute on function %s from public, anon;', fn.sig);
  end loop;
end$$;

-- 2) Revoke authenticated from functions no client should ever call
--    directly: trigger functions, the audit resolver, and the
--    service_role-only RPCs.
do $$
declare fn record;
begin
  for fn in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.proname in (
        'audit_trigger',
        'handle_new_auth_user',
        '_resolve_account_id',
        'bootstrap_first_admin',
        'appointments_for_reminder'
      )
  loop
    execute format('revoke execute on function %s from authenticated;', fn.sig);
  end loop;
end$$;

-- 3) Re-assert authenticated EXECUTE on everything else: the RLS helper
--    predicates (referenced inside policies — required) and the real app
--    RPCs. Belt-and-suspenders so RLS and the UI cannot break.
do $$
declare fn record;
begin
  for fn in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.proname not in (
        'audit_trigger',
        'handle_new_auth_user',
        '_resolve_account_id',
        'bootstrap_first_admin',
        'appointments_for_reminder'
      )
  loop
    execute format('grant execute on function %s to authenticated;', fn.sig);
  end loop;
end$$;
