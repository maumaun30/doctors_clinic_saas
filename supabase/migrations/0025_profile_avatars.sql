-- =====================================================================
-- 0025_profile_avatars.sql
-- Profile pictures for staff.
--
--   * profiles.avatar_path: object path inside the `avatars` bucket.
--     Must live under the user's own folder (<profile id>/...), so a user
--     can't point their profile at someone else's picture.
--   * `avatars` bucket: public read (pictures show in the app chrome and
--     staff lists), small images only.
--   * Writes to the bucket are service_role only: the app uploads through
--     a Server Action (lib/actions/avatar.ts) that checks the session.
-- =====================================================================

alter table profiles add column if not exists avatar_path text;

alter table profiles drop constraint if exists profiles_avatar_path_own_folder;
alter table profiles add constraint profiles_avatar_path_own_folder
  check (avatar_path is null or avatar_path like id::text || '/%');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2 * 1024 * 1024, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Same defense-in-depth pattern as lab-results (0012): RESTRICTIVE
-- policies block non-service_role writes even if a permissive policy is
-- added later. Reads are left alone (public bucket).
drop policy if exists avatars_insert_service_role_only on storage.objects;
create policy avatars_insert_service_role_only
  on storage.objects as restrictive for insert to public
  with check (bucket_id <> 'avatars' or (select auth.role()) = 'service_role');

drop policy if exists avatars_update_service_role_only on storage.objects;
create policy avatars_update_service_role_only
  on storage.objects as restrictive for update to public
  using (bucket_id <> 'avatars' or (select auth.role()) = 'service_role')
  with check (bucket_id <> 'avatars' or (select auth.role()) = 'service_role');

drop policy if exists avatars_delete_service_role_only on storage.objects;
create policy avatars_delete_service_role_only
  on storage.objects as restrictive for delete to public
  using (bucket_id <> 'avatars' or (select auth.role()) = 'service_role');
