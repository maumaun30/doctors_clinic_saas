-- =====================================================================
-- 0002_rls.sql  —  Row-level security policies.
-- Strategy:
--   * Every table gets RLS enabled.
--   * Helper functions (security definer) centralize membership checks
--     so policies stay readable and we avoid recursive RLS evaluation.
--   * Everything is scoped by account_id so multiple tenants are isolated.
-- =====================================================================

-- ---------- helpers ----------
-- All helpers are security definer + STABLE + search_path locked.
-- They read profiles/junction tables on behalf of the caller without
-- triggering the calling table's RLS (which would recurse).

create or replace function current_role_v()
returns user_role
language sql stable security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function current_account_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select account_id from profiles where id = auth.uid()
$$;

create or replace function is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin' and account_id is not null
  )
$$;

create or replace function is_doctor_at(p_clinic_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from doctor_clinics dc
    where dc.doctor_id = auth.uid()
      and dc.clinic_id = p_clinic_id
  )
$$;

-- Is the caller a secretary assigned to ANY (doctor, this clinic) pairing?
create or replace function is_assigned_secretary_clinic(p_clinic_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from clinic_assignments ca
    join doctor_clinics dc on dc.id = ca.doctor_clinic_id
    where ca.secretary_id = auth.uid()
      and dc.clinic_id = p_clinic_id
  )
$$;

-- Is the caller a secretary assigned to this exact (doctor, clinic) pair?
create or replace function is_assigned_secretary_for(p_doctor_id uuid, p_clinic_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from clinic_assignments ca
    join doctor_clinics dc on dc.id = ca.doctor_clinic_id
    where ca.secretary_id = auth.uid()
      and dc.doctor_id    = p_doctor_id
      and dc.clinic_id    = p_clinic_id
  )
$$;

-- Patient-touch check used by patient RLS:
-- a caller may see a patient if (admin of same account) OR
-- (doctor with any record/appointment for that patient) OR
-- (secretary assigned to any clinic where the patient has an appointment).
create or replace function can_touch_patient(p_patient_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select
    -- admin within the same account
    exists (
      select 1 from patients p
      where p.id = p_patient_id
        and p.account_id = current_account_id()
        and is_admin()
    )
    or
    -- doctor: has an appointment OR medical_record with this patient
    exists (
      select 1 from appointments a
      where a.patient_id = p_patient_id and a.doctor_id = auth.uid()
    )
    or exists (
      select 1 from medical_records m
      where m.patient_id = p_patient_id and m.doctor_id = auth.uid()
    )
    or
    -- secretary: assigned to a clinic where this patient has an appointment
    exists (
      select 1
      from appointments a
      join doctor_clinics dc
        on dc.doctor_id = a.doctor_id and dc.clinic_id = a.clinic_id
      join clinic_assignments ca on ca.doctor_clinic_id = dc.id
      where a.patient_id = p_patient_id
        and ca.secretary_id = auth.uid()
    )
$$;

-- =====================================================================
-- Enable RLS
-- =====================================================================
alter table accounts             enable row level security;
alter table profiles             enable row level security;
alter table doctors              enable row level security;
alter table clinics              enable row level security;
alter table doctor_clinics       enable row level security;
alter table clinic_assignments   enable row level security;
alter table doctor_availability  enable row level security;
alter table patients             enable row level security;
alter table appointments         enable row level security;
alter table medical_records      enable row level security;

-- =====================================================================
-- accounts: an admin sees their own account row. No insert/update/delete
-- via PostgREST; that goes through service_role only (RPCs).
-- =====================================================================
create policy accounts_select_own
  on accounts for select
  using (id = current_account_id());

-- =====================================================================
-- profiles
--   * any authenticated user can see their own profile row (needed so
--     the pending screen can read role/account_id).
--   * admins see all profiles in their account.
--   * users may update only their own non-privileged fields (full_name,
--     phone). role / account_id changes go through admin RPCs.
-- =====================================================================
create policy profiles_select_self
  on profiles for select
  using (id = auth.uid());

create policy profiles_select_same_account_admin
  on profiles for select
  using (is_admin() and account_id = current_account_id());

create policy profiles_update_self
  on profiles for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    -- prevent self-promotion: role + account_id must not change here.
    and role       = (select role       from profiles where id = auth.uid())
    and account_id is not distinct from (select account_id from profiles where id = auth.uid())
  );

create policy profiles_admin_update_same_account
  on profiles for update
  using (is_admin() and account_id = current_account_id())
  with check (is_admin() and account_id = current_account_id());

-- =====================================================================
-- doctors
-- =====================================================================
create policy doctors_select_same_account
  on doctors for select
  using (
    exists (
      select 1 from profiles p
      where p.id = doctors.profile_id
        and p.account_id = current_account_id()
    )
  );

create policy doctors_admin_write
  on doctors for all
  using (
    is_admin() and exists (
      select 1 from profiles p
      where p.id = doctors.profile_id and p.account_id = current_account_id()
    )
  )
  with check (
    is_admin() and exists (
      select 1 from profiles p
      where p.id = doctors.profile_id and p.account_id = current_account_id()
    )
  );

create policy doctors_update_self
  on doctors for update
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- =====================================================================
-- clinics
-- =====================================================================
create policy clinics_select_same_account
  on clinics for select
  using (account_id = current_account_id());

create policy clinics_admin_write
  on clinics for all
  using (is_admin() and account_id = current_account_id())
  with check (is_admin() and account_id = current_account_id());

-- =====================================================================
-- doctor_clinics
-- =====================================================================
create policy doctor_clinics_select_account
  on doctor_clinics for select
  using (
    exists (
      select 1 from clinics c
      where c.id = doctor_clinics.clinic_id
        and c.account_id = current_account_id()
    )
  );

create policy doctor_clinics_admin_write
  on doctor_clinics for all
  using (
    is_admin() and exists (
      select 1 from clinics c
      where c.id = doctor_clinics.clinic_id
        and c.account_id = current_account_id()
    )
  )
  with check (
    is_admin() and exists (
      select 1 from clinics c
      where c.id = doctor_clinics.clinic_id
        and c.account_id = current_account_id()
    )
  );

-- =====================================================================
-- clinic_assignments
-- =====================================================================
create policy clinic_assignments_select_account
  on clinic_assignments for select
  using (
    exists (
      select 1
      from doctor_clinics dc
      join clinics c on c.id = dc.clinic_id
      where dc.id = clinic_assignments.doctor_clinic_id
        and c.account_id = current_account_id()
    )
  );

create policy clinic_assignments_admin_write
  on clinic_assignments for all
  using (
    is_admin() and exists (
      select 1
      from doctor_clinics dc
      join clinics c on c.id = dc.clinic_id
      where dc.id = clinic_assignments.doctor_clinic_id
        and c.account_id = current_account_id()
    )
  )
  with check (
    is_admin() and exists (
      select 1
      from doctor_clinics dc
      join clinics c on c.id = dc.clinic_id
      where dc.id = clinic_assignments.doctor_clinic_id
        and c.account_id = current_account_id()
    )
  );

-- =====================================================================
-- doctor_availability
--   * doctor manages own
--   * admin manages all in account
--   * secretaries assigned to that (doctor,clinic) may read it
-- =====================================================================
create policy doctor_availability_select
  on doctor_availability for select
  using (
    doctor_id = auth.uid()
    or (is_admin() and exists (
          select 1 from clinics c
          where c.id = doctor_availability.clinic_id
            and c.account_id = current_account_id()))
    or is_assigned_secretary_for(doctor_availability.doctor_id, doctor_availability.clinic_id)
  );

create policy doctor_availability_doctor_write
  on doctor_availability for all
  using (doctor_id = auth.uid())
  with check (doctor_id = auth.uid());

create policy doctor_availability_admin_write
  on doctor_availability for all
  using (
    is_admin() and exists (
      select 1 from clinics c
      where c.id = doctor_availability.clinic_id
        and c.account_id = current_account_id()
    )
  )
  with check (
    is_admin() and exists (
      select 1 from clinics c
      where c.id = doctor_availability.clinic_id
        and c.account_id = current_account_id()
    )
  );

-- =====================================================================
-- patients (demographics — secretaries can read/write these)
-- =====================================================================
create policy patients_select
  on patients for select
  using (
    account_id = current_account_id()
    and (is_admin() or can_touch_patient(id))
  );

create policy patients_admin_write
  on patients for all
  using (is_admin() and account_id = current_account_id())
  with check (is_admin() and account_id = current_account_id());

create policy patients_secretary_or_doctor_insert
  on patients for insert
  with check (
    account_id = current_account_id()
    and current_role_v() in ('secretary','doctor','admin')
  );

create policy patients_secretary_or_doctor_update
  on patients for update
  using (
    account_id = current_account_id()
    and (is_admin() or can_touch_patient(id))
  )
  with check (account_id = current_account_id());

-- =====================================================================
-- appointments
--   * admin: all in account
--   * doctor: own appointments
--   * secretary: appointments at a (doctor,clinic) they're assigned to
-- =====================================================================
create policy appointments_select
  on appointments for select
  using (
    (is_admin() and exists (
       select 1 from clinics c
       where c.id = appointments.clinic_id and c.account_id = current_account_id()))
    or doctor_id = auth.uid()
    or is_assigned_secretary_for(doctor_id, clinic_id)
  );

create policy appointments_insert
  on appointments for insert
  with check (
    (is_admin() and exists (
       select 1 from clinics c
       where c.id = appointments.clinic_id and c.account_id = current_account_id()))
    or doctor_id = auth.uid()
    or is_assigned_secretary_for(doctor_id, clinic_id)
  );

create policy appointments_update
  on appointments for update
  using (
    (is_admin() and exists (
       select 1 from clinics c
       where c.id = appointments.clinic_id and c.account_id = current_account_id()))
    or doctor_id = auth.uid()
    or is_assigned_secretary_for(doctor_id, clinic_id)
  )
  with check (
    (is_admin() and exists (
       select 1 from clinics c
       where c.id = appointments.clinic_id and c.account_id = current_account_id()))
    or doctor_id = auth.uid()
    or is_assigned_secretary_for(doctor_id, clinic_id)
  );

create policy appointments_delete
  on appointments for delete
  using (
    (is_admin() and exists (
       select 1 from clinics c
       where c.id = appointments.clinic_id and c.account_id = current_account_id()))
    or doctor_id = auth.uid()
  );

-- =====================================================================
-- medical_records  — TIGHTER than appointments.
-- Only the treating doctor and admins (same account) can read/write.
-- Secretaries are explicitly EXCLUDED from clinical fields.
-- =====================================================================
create policy medical_records_select
  on medical_records for select
  using (
    doctor_id = auth.uid()
    or (is_admin() and exists (
          select 1 from clinics c
          where c.id = medical_records.clinic_id
            and c.account_id = current_account_id()))
  );

create policy medical_records_doctor_write
  on medical_records for all
  using (doctor_id = auth.uid())
  with check (doctor_id = auth.uid());

-- Admin may correct/delete records in their account but should not be
-- the routine author. (Insert by admin allowed; UI should discourage.)
create policy medical_records_admin_write
  on medical_records for all
  using (
    is_admin() and exists (
      select 1 from clinics c
      where c.id = medical_records.clinic_id and c.account_id = current_account_id())
  )
  with check (
    is_admin() and exists (
      select 1 from clinics c
      where c.id = medical_records.clinic_id and c.account_id = current_account_id())
  );
