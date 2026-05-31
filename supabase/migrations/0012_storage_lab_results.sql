-- =====================================================================
-- 0012_storage_lab_results.sql
-- Defense-in-depth for the `lab-results` Storage bucket.
--
-- Supabase enables RLS on storage.objects by default with NO permissive
-- policies for this bucket, so anon/authenticated already can't touch
-- it — only service_role (which bypasses RLS) can. We make that
-- intent explicit with a RESTRICTIVE policy: regardless of what other
-- policies might be added later (e.g. by accident in the dashboard),
-- non-service_role traffic is denied for this bucket.
--
-- Run AFTER you've created the `lab-results` bucket in the dashboard.
-- Safe to re-run.
-- =====================================================================

drop policy if exists lab_results_service_role_only on storage.objects;

create policy lab_results_service_role_only
  on storage.objects
  as restrictive
  for all
  to public
  using (
    bucket_id <> 'lab-results'           -- this policy doesn't restrict other buckets
    or (select auth.role()) = 'service_role'
  )
  with check (
    bucket_id <> 'lab-results'
    or (select auth.role()) = 'service_role'
  );

-- Notes:
--   * RESTRICTIVE policies AND with any permissive policies; ALL must
--     pass. So even if someone later adds a permissive "anyone can read
--     lab-results" policy by mistake, this restrictive one still blocks
--     non-service_role callers.
--   * `to public` means the policy applies to every role; the check
--     inside narrows it to service_role for the lab-results bucket only.
--   * Our application talks to this bucket exclusively through the
--     service_role client in supabase/server-side actions
--     (lib/actions/lab-files.ts), so legitimate uploads/downloads keep
--     working.
