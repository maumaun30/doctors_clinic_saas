-- =====================================================================
-- 0007_clinical_extensions.sql
-- Prescriptions, lab orders/results, patient conditions (problem list).
-- Plus "common" libraries the doctor picks from tag-style during a
-- visit. Each per-visit/per-patient row stores a NAME SNAPSHOT so
-- editing the library later doesn't mutate history.
-- =====================================================================

create type condition_status as enum ('active', 'resolved');
create type lab_status       as enum ('ordered', 'in_progress', 'completed', 'cancelled');

-- =====================================================================
-- COMMON LIBRARIES (account-scoped, admin-managed, readable by all staff)
-- =====================================================================

create table common_medications (
  id                    uuid primary key default gen_random_uuid(),
  account_id            uuid not null references accounts(id) on delete cascade,
  name                  text not null,
  default_dosage        text,
  default_frequency     text,
  default_instructions  text,
  created_at            timestamptz not null default now(),
  unique (account_id, name)
);
create index common_medications_account_idx on common_medications(account_id);

create table common_lab_tests (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts(id) on delete cascade,
  name        text not null,
  description text,
  created_at  timestamptz not null default now(),
  unique (account_id, name)
);
create index common_lab_tests_account_idx on common_lab_tests(account_id);

create table common_conditions (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts(id) on delete cascade,
  name        text not null,
  icd_code    text,
  created_at  timestamptz not null default now(),
  unique (account_id, name)
);
create index common_conditions_account_idx on common_conditions(account_id);

-- =====================================================================
-- PER-VISIT / PER-PATIENT CLINICAL TABLES
-- =====================================================================

-- Prescriptions: tied to a visit (medical_record). Snapshot the name.
create table prescriptions (
  id                 uuid primary key default gen_random_uuid(),
  medical_record_id  uuid not null references medical_records(id) on delete cascade,
  patient_id         uuid not null references patients(id) on delete cascade,
  medication_id      uuid references common_medications(id) on delete set null,
  name               text not null,           -- snapshot
  dosage             text,
  frequency          text,
  duration           text,
  instructions       text,
  created_at         timestamptz not null default now()
);
create index prescriptions_patient_idx on prescriptions(patient_id);
create index prescriptions_record_idx  on prescriptions(medical_record_id);

-- Lab orders/results
create table lab_orders (
  id                 uuid primary key default gen_random_uuid(),
  medical_record_id  uuid not null references medical_records(id) on delete cascade,
  patient_id         uuid not null references patients(id) on delete cascade,
  lab_test_id        uuid references common_lab_tests(id) on delete set null,
  name               text not null,           -- snapshot
  status             lab_status not null default 'ordered',
  result             text,
  result_at          timestamptz,
  created_at         timestamptz not null default now()
);
create index lab_orders_patient_idx on lab_orders(patient_id);
create index lab_orders_record_idx  on lab_orders(medical_record_id);

-- Patient problem list. NOT per-visit — patient-level, but created
-- during a visit so we keep the originating medical_record_id.
create table patient_conditions (
  id                          uuid primary key default gen_random_uuid(),
  patient_id                  uuid not null references patients(id) on delete cascade,
  condition_id                uuid references common_conditions(id) on delete set null,
  name                        text not null,    -- snapshot
  status                      condition_status not null default 'active',
  since                       date,
  resolved_at                 date,
  notes                       text,
  originating_medical_record_id uuid references medical_records(id) on delete set null,
  created_at                  timestamptz not null default now()
);
create index patient_conditions_patient_idx on patient_conditions(patient_id);

-- =====================================================================
-- RLS
-- =====================================================================
alter table common_medications  enable row level security;
alter table common_lab_tests    enable row level security;
alter table common_conditions   enable row level security;
alter table prescriptions       enable row level security;
alter table lab_orders          enable row level security;
alter table patient_conditions  enable row level security;

-- Common libraries: read for all staff in account, write for admins.
create policy common_meds_select_same_account
  on common_medications for select
  using (account_id = current_account_id());
create policy common_meds_admin_write
  on common_medications for all
  using (is_admin() and account_id = current_account_id())
  with check (is_admin() and account_id = current_account_id());

create policy common_labs_select_same_account
  on common_lab_tests for select
  using (account_id = current_account_id());
create policy common_labs_admin_write
  on common_lab_tests for all
  using (is_admin() and account_id = current_account_id())
  with check (is_admin() and account_id = current_account_id());

create policy common_conds_select_same_account
  on common_conditions for select
  using (account_id = current_account_id());
create policy common_conds_admin_write
  on common_conditions for all
  using (is_admin() and account_id = current_account_id())
  with check (is_admin() and account_id = current_account_id());

-- Helper: can the caller see THIS medical_record? Mirrors the
-- medical_records SELECT policy (doctor of the record OR admin in same
-- account). Secretaries cannot.
create or replace function can_read_medical_record(p_record_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from medical_records m
    where m.id = p_record_id
      and ( m.doctor_id = auth.uid()
            or ( is_admin() and exists (
                   select 1 from clinics c
                   where c.id = m.clinic_id and c.account_id = current_account_id())))
  )
$$;

-- Prescriptions / lab_orders: gated through the parent medical_record,
-- so secretaries are excluded automatically.
create policy prescriptions_select
  on prescriptions for select
  using (can_read_medical_record(medical_record_id));
create policy prescriptions_doctor_write
  on prescriptions for all
  using (exists (
    select 1 from medical_records m
    where m.id = prescriptions.medical_record_id and m.doctor_id = auth.uid()))
  with check (exists (
    select 1 from medical_records m
    where m.id = prescriptions.medical_record_id and m.doctor_id = auth.uid()));
create policy prescriptions_admin_write
  on prescriptions for all
  using (is_admin() and exists (
    select 1 from medical_records m join clinics c on c.id = m.clinic_id
    where m.id = prescriptions.medical_record_id and c.account_id = current_account_id()))
  with check (is_admin() and exists (
    select 1 from medical_records m join clinics c on c.id = m.clinic_id
    where m.id = prescriptions.medical_record_id and c.account_id = current_account_id()));

create policy lab_orders_select
  on lab_orders for select
  using (can_read_medical_record(medical_record_id));
create policy lab_orders_doctor_write
  on lab_orders for all
  using (exists (
    select 1 from medical_records m
    where m.id = lab_orders.medical_record_id and m.doctor_id = auth.uid()))
  with check (exists (
    select 1 from medical_records m
    where m.id = lab_orders.medical_record_id and m.doctor_id = auth.uid()));
create policy lab_orders_admin_write
  on lab_orders for all
  using (is_admin() and exists (
    select 1 from medical_records m join clinics c on c.id = m.clinic_id
    where m.id = lab_orders.medical_record_id and c.account_id = current_account_id()))
  with check (is_admin() and exists (
    select 1 from medical_records m join clinics c on c.id = m.clinic_id
    where m.id = lab_orders.medical_record_id and c.account_id = current_account_id()));

-- patient_conditions: same trust model as medical_records but at the
-- patient level (so a doctor who ever treated the patient can see the
-- problem list).
create policy patient_conditions_select
  on patient_conditions for select
  using (
    is_admin() and exists (
      select 1 from patients p where p.id = patient_conditions.patient_id
        and p.account_id = current_account_id())
    or exists (
      select 1 from medical_records m
      where m.patient_id = patient_conditions.patient_id and m.doctor_id = auth.uid())
    or exists (
      select 1 from appointments a
      where a.patient_id = patient_conditions.patient_id and a.doctor_id = auth.uid())
  );

create policy patient_conditions_doctor_write
  on patient_conditions for all
  using (exists (
    select 1 from medical_records m
    where m.patient_id = patient_conditions.patient_id and m.doctor_id = auth.uid()))
  with check (exists (
    select 1 from medical_records m
    where m.patient_id = patient_conditions.patient_id and m.doctor_id = auth.uid()));

create policy patient_conditions_admin_write
  on patient_conditions for all
  using (is_admin() and exists (
    select 1 from patients p where p.id = patient_conditions.patient_id
      and p.account_id = current_account_id()))
  with check (is_admin() and exists (
    select 1 from patients p where p.id = patient_conditions.patient_id
      and p.account_id = current_account_id()));

-- =====================================================================
-- RPC: complete_visit_full
-- Single transaction: flip appointment -> completed, create
-- medical_record, and bulk-insert prescriptions / labs / conditions.
-- Replaces complete_appointment for the new tag-style UI.
-- =====================================================================

create or replace function complete_visit_full(
  p_appointment_id   uuid,
  p_chief_complaint  text,
  p_diagnosis        text,
  p_vitals           jsonb,
  p_notes            text,
  p_prescriptions    jsonb default '[]'::jsonb,  -- [{medication_id?, name, dosage?, frequency?, duration?, instructions?}]
  p_labs             jsonb default '[]'::jsonb,  -- [{lab_test_id?, name}]
  p_conditions       jsonb default '[]'::jsonb   -- [{condition_id?, name, status?, since?}]
)
returns medical_records
language plpgsql
security definer
set search_path = public
as $$
declare
  appt    appointments;
  mr      medical_records;
  item    jsonb;
begin
  select * into appt from appointments where id = p_appointment_id;
  if not found then raise exception 'appointment not found'; end if;
  if appt.doctor_id <> auth.uid() then
    raise exception 'forbidden: only the treating doctor may complete';
  end if;

  update appointments set status = 'completed' where id = p_appointment_id;

  insert into medical_records(
    patient_id, doctor_id, appointment_id, clinic_id,
    visit_date, chief_complaint, diagnosis, vitals, notes
  ) values (
    appt.patient_id, appt.doctor_id, appt.id, appt.clinic_id,
    (appt.scheduled_at at time zone 'Asia/Manila')::date,
    p_chief_complaint, p_diagnosis, p_vitals, p_notes
  )
  returning * into mr;

  for item in select * from jsonb_array_elements(coalesce(p_prescriptions, '[]'::jsonb)) loop
    insert into prescriptions(
      medical_record_id, patient_id, medication_id, name,
      dosage, frequency, duration, instructions
    ) values (
      mr.id, mr.patient_id,
      nullif(item->>'medication_id','')::uuid,
      item->>'name',
      item->>'dosage', item->>'frequency', item->>'duration', item->>'instructions'
    );
  end loop;

  for item in select * from jsonb_array_elements(coalesce(p_labs, '[]'::jsonb)) loop
    insert into lab_orders(medical_record_id, patient_id, lab_test_id, name)
    values (mr.id, mr.patient_id,
            nullif(item->>'lab_test_id','')::uuid,
            item->>'name');
  end loop;

  for item in select * from jsonb_array_elements(coalesce(p_conditions, '[]'::jsonb)) loop
    insert into patient_conditions(
      patient_id, condition_id, name, status, since,
      originating_medical_record_id
    ) values (
      mr.patient_id,
      nullif(item->>'condition_id','')::uuid,
      item->>'name',
      coalesce((item->>'status')::condition_status, 'active'),
      nullif(item->>'since','')::date,
      mr.id
    );
  end loop;

  return mr;
end;
$$;

revoke all on function complete_visit_full(uuid, text, text, jsonb, text, jsonb, jsonb, jsonb) from public;
grant execute on function complete_visit_full(uuid, text, text, jsonb, text, jsonb, jsonb, jsonb) to authenticated;
