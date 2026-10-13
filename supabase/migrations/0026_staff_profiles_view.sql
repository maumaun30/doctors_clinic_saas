-- =====================================================================
-- 0026_staff_profiles_view.sql
-- Let staff see who their colleagues are.
--
-- profiles RLS only allows reading your own row (admins: the whole
-- account), so a secretary joining appointments -> doctors -> profiles got
-- no rows: an empty Schedule, no doctors in the booking form, no names on
-- visits. (The doctors read policy had the same problem; fixed below.)
-- Widening the profiles policy would also expose phone numbers.
--
-- Instead, this view exposes only the public bits of a staff profile
-- (name, role, picture) for people in the caller's own account. It runs
-- with the owner's rights (security_invoker = false) and does its own
-- account filtering. PostgREST embeds it through profiles' foreign keys,
-- e.g. doctors?select=profile:staff_profiles(full_name, avatar_path).
-- =====================================================================

create or replace view staff_profiles
with (security_invoker = false, security_barrier = true) as
select p.id, p.account_id, p.role, p.full_name, p.avatar_path
from profiles p
where p.account_id = current_account_id()
  and p.role in ('admin', 'doctor', 'secretary');

revoke all on staff_profiles from public, anon;
grant select on staff_profiles to authenticated;

comment on view staff_profiles is
  'Name, role and picture of staff in the caller''s account. Phone and other profile fields stay behind profiles RLS.';

-- The doctors read policy checked the doctor's account through profiles,
-- which non-admins can't read, so secretaries saw no doctors at all.
-- Check it through the view instead (same account rule).
drop policy if exists doctors_select_same_account on doctors;
create policy doctors_select_same_account
  on doctors for select
  using (exists (select 1 from staff_profiles s where s.id = doctors.profile_id));
