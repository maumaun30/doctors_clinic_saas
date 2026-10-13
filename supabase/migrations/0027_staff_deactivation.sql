-- =====================================================================
-- 0027_staff_deactivation.sql
-- Remove (and restore) a staff member's access.
--
-- Staff are deactivated, never deleted: their name must stay on past
-- appointments, visit records, prescriptions and the audit log.
--
--   * profiles.deactivated_at: set = no access. current_account_id(),
--     current_role_v() and is_admin() treat the person as having no
--     account, so every account-scoped RLS check fails for them.
--     (The app also bans the auth user, so they can't sign in or refresh
--     a session; see lib/actions/staff.ts.)
--   * Deactivated doctors can't be booked: no slots, hidden from the
--     public booking page, and a trigger rejects any new or moved active
--     appointment for them.
--   * admin_set_staff_active(): the only way to change it. Admin with
--     2FA, same account, not yourself; a doctor with upcoming appointments
--     must have them moved or cancelled first. Written to the audit log.
--   * Deactivated doctors don't count toward billing seats.
-- =====================================================================

alter table profiles add column if not exists deactivated_at timestamptz;
alter table profiles add column if not exists deactivated_by uuid references profiles(id) on delete set null;

-- ---------- identity helpers: deactivated = no account ----------
create or replace function current_account_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select account_id from profiles where id = auth.uid() and deactivated_at is null
$$;

create or replace function current_role_v()
returns user_role
language sql stable security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid() and deactivated_at is null
$$;

create or replace function is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin' and account_id is not null and deactivated_at is null
  )
  and coalesce(auth.jwt() ->> 'aal', 'aal2') = 'aal2'
$$;

-- Users must not be able to reactivate themselves (or change who did it).
drop policy if exists profiles_update_self on profiles;
create policy profiles_update_self
  on profiles for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role       = (select role       from profiles where id = auth.uid())
    and account_id is not distinct from (select account_id from profiles where id = auth.uid())
    and deactivated_at is not distinct from (select deactivated_at from profiles where id = auth.uid())
    and deactivated_by is not distinct from (select deactivated_by from profiles where id = auth.uid())
  );

-- Admins change access only through admin_set_staff_active (audited).
drop policy if exists profiles_admin_update_same_account on profiles;
create policy profiles_admin_update_same_account
  on profiles for update
  using (is_admin() and account_id = current_account_id())
  with check (
    is_admin() and account_id = current_account_id()
    and deactivated_at is not distinct from (select p.deactivated_at from profiles p where p.id = profiles.id)
    and deactivated_by is not distinct from (select p.deactivated_by from profiles p where p.id = profiles.id)
  );

-- ---------- colleagues view: expose whether someone is active ----------
create or replace view staff_profiles
with (security_invoker = false, security_barrier = true) as
select p.id, p.account_id, p.role, p.full_name, p.avatar_path,
       p.deactivated_at is null as active
from profiles p
where p.account_id = current_account_id()
  and p.role in ('admin', 'doctor', 'secretary');

-- ---------- deactivated doctors can't be booked ----------
create or replace function available_slots(
  p_doctor_id        uuid,
  p_clinic_id        uuid,
  p_date_local       date,
  p_duration_minutes int default 30,
  p_step_minutes     int default 15
)
returns table (slot_start timestamptz)
language plpgsql
stable security definer
set search_path = public
as $$
begin
  if p_duration_minutes <= 0 or p_step_minutes <= 0 then return; end if;
  if exists (select 1 from profiles where id = p_doctor_id and deactivated_at is not null) then return; end if;

  return query
  with candidates as (
    select distinct (g.local_ts at time zone 'Asia/Manila') as ss
    from doctor_availability da
    cross join lateral generate_series(
      p_date_local + da.start_time,
      p_date_local + da.end_time - make_interval(mins => p_duration_minutes),
      make_interval(mins => p_step_minutes)
    ) as g(local_ts)
    where da.doctor_id = p_doctor_id
      and da.clinic_id = p_clinic_id
      and da.weekday   = extract(dow from p_date_local)::smallint
  )
  select c.ss
  from candidates c
  where c.ss > now()
    and not exists (
      select 1 from appointments a
      where a.doctor_id = p_doctor_id
        and a.status in ('scheduled','confirmed')
        and tstzrange(a.scheduled_at,
                      a.scheduled_at + make_interval(mins => a.duration_minutes), '[)')
            && tstzrange(c.ss, c.ss + make_interval(mins => p_duration_minutes), '[)')
    )
  order by c.ss;
end;
$$;

create or replace function public_booking_info(p_slug text)
returns table (
  clinic_id      uuid,
  clinic_name    text,
  clinic_address text,
  doctors        jsonb
)
language sql
stable security definer
set search_path = public
as $$
  select c.id, c.name, c.address,
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'id', d.profile_id,
                    'name', p.full_name,
                    'specialization', d.specialization)
                  order by p.full_name)
           from doctor_clinics dc
           join doctors  d on d.profile_id = dc.doctor_id
           join profiles p on p.id = d.profile_id
           where dc.clinic_id = c.id
             and p.deactivated_at is null
         ), '[]'::jsonb)
  from clinics c
  where c.booking_slug = lower(p_slug)
    and c.online_booking
    and account_is_active(c.account_id);
$$;
revoke all on function public_booking_info(text) from public, anon, authenticated;

-- Backstop for every booking path (staff, online, reschedule).
create or replace function enforce_doctor_active()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('scheduled', 'confirmed')
     and (tg_op = 'INSERT' or new.doctor_id is distinct from old.doctor_id
          or new.scheduled_at is distinct from old.scheduled_at
          or new.status is distinct from old.status)
     and exists (select 1 from profiles where id = new.doctor_id and deactivated_at is not null)
  then
    raise exception 'doctor_inactive: this doctor no longer has access and can''t be booked'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function enforce_doctor_active() from public, anon, authenticated;

drop trigger if exists appointments_doctor_active on appointments;
create trigger appointments_doctor_active
  before insert or update on appointments
  for each row execute function enforce_doctor_active();

-- ---------- billing: only active doctors are seats ----------
create or replace function my_billing_status()
returns table (
  account_id          uuid,
  is_active           boolean,
  trial_ends_at       timestamptz,
  subscription_status text,
  current_period_end  timestamptz,
  seat_quantity       int,
  doctor_count        int,
  has_customer        boolean
)
language sql
stable security definer
set search_path = public
as $$
  select a.id,
         account_is_active(a.id),
         a.trial_ends_at,
         a.subscription_status,
         a.current_period_end,
         a.seat_quantity,
         (select count(*)::int from profiles p
           where p.account_id = a.id and p.role = 'doctor' and p.deactivated_at is null),
         a.stripe_customer_id is not null
  from accounts a
  where a.id = current_account_id();
$$;

-- ---------- the admin action ----------
create or replace function admin_set_staff_active(p_user_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target   profiles;
  v_upcoming int;
  v_now      timestamptz := now();
begin
  if not is_admin() then
    raise exception 'forbidden: only admins with two-factor authentication can change access';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'cannot_change_self: you can''t remove your own access';
  end if;

  select * into v_target from profiles
   where id = p_user_id and account_id = current_account_id()
     and role in ('admin', 'doctor', 'secretary')
   for update;
  if not found then
    raise exception 'not_found: no such staff member in this account';
  end if;
  if (v_target.deactivated_at is null) = p_active then
    return; -- already in the requested state
  end if;

  if not p_active and v_target.role = 'doctor' then
    select count(*) into v_upcoming from appointments
     where doctor_id = p_user_id and status in ('scheduled', 'confirmed') and scheduled_at > v_now;
    if v_upcoming > 0 then
      raise exception 'upcoming_appointments:%', v_upcoming;
    end if;
  end if;

  update profiles
     set deactivated_at = case when p_active then null else v_now end,
         deactivated_by = case when p_active then null else auth.uid() end
   where id = p_user_id;

  insert into audit_log(actor_id, account_id, table_name, row_id, operation, before, after)
  values (auth.uid(), v_target.account_id, 'profiles', p_user_id, 'UPDATE',
          jsonb_build_object('access', case when p_active then 'removed' else 'active' end, 'name', v_target.full_name),
          jsonb_build_object('access', case when p_active then 'active' else 'removed' end, 'name', v_target.full_name));
end;
$$;
revoke all on function admin_set_staff_active(uuid, boolean) from public, anon;
grant execute on function admin_set_staff_active(uuid, boolean) to authenticated;

-- ---------- blanket guards for removed users ----------
-- Some policies grant access by a direct match (doctor_id = auth.uid(),
-- a secretary's clinic assignment) without going through
-- current_account_id(). Rather than rewrite each one, two guards cover
-- every path for a removed user:
--   1. a RESTRICTIVE policy on every account-data table (direct reads and
--      writes through the API), and
--   2. the write-guard trigger (also fires inside SECURITY DEFINER RPCs
--      such as book_appointment / complete_visit_full).
create or replace function caller_is_active()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select not exists (select 1 from profiles where id = auth.uid() and deactivated_at is not null)
$$;
revoke all on function caller_is_active() from public, anon;
grant execute on function caller_is_active() to authenticated;

do $$
declare t text;
begin
  for t in select unnest(array[
    'accounts', 'appointments', 'appointment_reminders', 'audit_log',
    'clinic_assignments', 'clinics', 'common_conditions', 'common_lab_tests', 'common_medications',
    'doctor_availability', 'doctor_clinics', 'doctors',
    'lab_orders', 'lab_result_files', 'medical_records',
    'patient_clinics', 'patient_conditions', 'patients', 'prescriptions', 'staff_invites'
  ])
  loop
    execute format('drop policy if exists zz_caller_active on %I', t);
    execute format(
      'create policy zz_caller_active on %I as restrictive for all to authenticated
         using ((select caller_is_active())) with check ((select caller_is_active()))', t);
  end loop;
end$$;

create or replace function enforce_account_writable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account     uuid;
  v_deactivated timestamptz;
begin
  if auth.uid() is null then
    return coalesce(new, old);          -- service_role / system work
  end if;
  select account_id, deactivated_at into v_account, v_deactivated from profiles where id = auth.uid();
  if v_deactivated is not null then
    raise exception 'access_removed: your access to this clinic was removed'
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
