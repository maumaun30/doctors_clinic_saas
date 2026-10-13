-- =====================================================================
-- 0028_exports_bucket.sql
-- Private Storage bucket for whole-clinic data exports.
--
-- The export ZIP is built by a server route (app/api/export/clinic) that
-- has already checked the caller is an admin with 2FA. It writes the ZIP
-- here with the service_role client and hands the browser a short-lived
-- signed URL, so large exports don't hit the hosting response-size limit.
-- Only the latest export per account is kept.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('exports', 'exports', false, 200 * 1024 * 1024, array['application/zip'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Same pattern as lab-results (0012): nothing but service_role touches it.
drop policy if exists exports_service_role_only on storage.objects;
create policy exports_service_role_only
  on storage.objects
  as restrictive
  for all
  to public
  using (bucket_id <> 'exports' or (select auth.role()) = 'service_role')
  with check (bucket_id <> 'exports' or (select auth.role()) = 'service_role');
