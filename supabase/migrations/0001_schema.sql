-- =====================================================================
-- 0001_schema.sql  —  Core schema for doctors_clinic_saas
-- All identifiers snake_case. All ids uuid. All timestamps timestamptz UTC.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------- enums ----------
create type user_role as enum ('pending', 'admin', 'doctor', 'secretary');
create type appointment_status as enum (
  'scheduled', 'confirmed', 'completed', 'cancelled', 'no_show'
);
create type sex_type as enum ('male', 'female', 'other');

-- ---------- accounts (future billing/tenant) ----------
create table accounts (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

-- ---------- profiles (1:1 with auth.users) ----------
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  account_id  uuid references accounts(id) on delete set null,
  role        user_role not null default 'pending',
  full_name   text,
  phone       text,
  created_at  timestamptz not null default now()
);
create index profiles_account_id_idx on profiles(account_id);
create index profiles_role_idx        on profiles(role);

-- ---------- doctors ----------
create table doctors (
  profile_id       uuid primary key references profiles(id) on delete cascade,
  specialization   text,
  prc_license_no   text unique
);

-- ---------- clinics ----------
create table clinics (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts(id) on delete cascade,
  name        text not null,
  address     text,
  created_at  timestamptz not null default now()
);
create index clinics_account_id_idx on clinics(account_id);

-- ---------- doctor_clinics (which doctors practice at which clinics) ----------
create table doctor_clinics (
  id         uuid primary key default gen_random_uuid(),
  doctor_id  uuid not null references doctors(profile_id) on delete cascade,
  clinic_id  uuid not null references clinics(id)         on delete cascade,
  created_at timestamptz not null default now(),
  unique (doctor_id, clinic_id)
);
create index doctor_clinics_clinic_idx on doctor_clinics(clinic_id);
create index doctor_clinics_doctor_idx on doctor_clinics(doctor_id);

-- ---------- clinic_assignments (secretary <-> doctor_clinic) ----------
create table clinic_assignments (
  id                uuid primary key default gen_random_uuid(),
  doctor_clinic_id  uuid not null references doctor_clinics(id) on delete cascade,
  secretary_id      uuid not null references profiles(id)       on delete cascade,
  created_at        timestamptz not null default now(),
  unique (doctor_clinic_id, secretary_id)
);
create index clinic_assignments_secretary_idx on clinic_assignments(secretary_id);
create index clinic_assignments_dc_idx        on clinic_assignments(doctor_clinic_id);

-- ---------- doctor_availability ----------
create table doctor_availability (
  id          uuid primary key default gen_random_uuid(),
  doctor_id   uuid not null references doctors(profile_id) on delete cascade,
  clinic_id   uuid not null references clinics(id)         on delete cascade,
  weekday     smallint not null check (weekday between 0 and 6),
  start_time  time not null,
  end_time    time not null,
  check (end_time > start_time)
);
create index doctor_availability_doctor_idx on doctor_availability(doctor_id, clinic_id);

-- ---------- patients ----------
create table patients (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references accounts(id) on delete cascade,
  full_name     text not null,
  date_of_birth date,
  sex           sex_type,
  phone         text,
  address       text,
  created_at    timestamptz not null default now()
);
create index patients_account_idx on patients(account_id);

-- ---------- appointments ----------
create table appointments (
  id                uuid primary key default gen_random_uuid(),
  patient_id        uuid not null references patients(id) on delete restrict,
  doctor_id         uuid not null references doctors(profile_id) on delete restrict,
  clinic_id         uuid not null references clinics(id)  on delete restrict,
  scheduled_at      timestamptz not null,
  duration_minutes  int not null default 30 check (duration_minutes > 0),
  status            appointment_status not null default 'scheduled',
  created_by        uuid references profiles(id) on delete set null,
  notes             text,
  created_at        timestamptz not null default now()
);
create index appointments_doctor_time_idx on appointments(doctor_id, scheduled_at);
create index appointments_clinic_time_idx on appointments(clinic_id, scheduled_at);
create index appointments_patient_idx     on appointments(patient_id);

-- Prevent double-booking the same doctor at the same exact start time.
-- (RPC enforces interval-overlap; this is a hard backstop.)
create unique index appointments_no_doctor_dupe
  on appointments(doctor_id, scheduled_at)
  where status in ('scheduled','confirmed');

-- ---------- medical_records ----------
create table medical_records (
  id               uuid primary key default gen_random_uuid(),
  patient_id       uuid not null references patients(id)        on delete cascade,
  doctor_id        uuid not null references doctors(profile_id) on delete restrict,
  appointment_id   uuid references appointments(id) on delete set null,
  clinic_id        uuid not null references clinics(id) on delete restrict,
  visit_date       date not null default current_date,
  chief_complaint  text,
  diagnosis        text,
  vitals           jsonb,
  notes            text,
  created_at       timestamptz not null default now()
);
create index medical_records_patient_idx on medical_records(patient_id);
create index medical_records_doctor_idx  on medical_records(doctor_id);
create index medical_records_clinic_idx  on medical_records(clinic_id);

-- =====================================================================
-- Trigger: auto-provision a profiles row on new auth.users.
-- New users land as role='pending' with no account_id. An admin must
-- assign them via an RPC (see 0003_rpcs.sql).
-- =====================================================================
create or replace function handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name',
             new.raw_user_meta_data->>'name',
             new.email)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();
