-- =====================================================================
-- 0011_lab_result_files.sql
-- Multiple files (PDF / image scans) per lab_order. Files themselves
-- live in Supabase Storage bucket `lab-results`; we store metadata +
-- path only. Uploads go through a Server Action that uses the
-- service_role client and writes the row here, so no Storage RLS is
-- required — read access is gated by this table's RLS, and downloads
-- happen via short-lived signed URLs generated server-side.
-- =====================================================================

create table lab_result_files (
  id            uuid primary key default gen_random_uuid(),
  lab_order_id  uuid not null references lab_orders(id) on delete cascade,
  file_path     text not null,                  -- storage object path
  file_name     text not null,
  content_type  text,
  size_bytes    integer,
  uploaded_by   uuid references profiles(id) on delete set null,
  uploaded_at   timestamptz not null default now()
);
create index lab_result_files_order_idx on lab_result_files(lab_order_id);

alter table lab_result_files enable row level security;

-- Read: same gate as the parent lab_order (i.e. treating doctor or
-- account admin; secretaries blocked).
create policy lab_result_files_select
  on lab_result_files for select
  using (exists (
    select 1 from lab_orders lo
    where lo.id = lab_result_files.lab_order_id
      and can_read_medical_record(lo.medical_record_id)
  ));

-- Write: treating doctor of the parent record, or admin in account.
create policy lab_result_files_doctor_write
  on lab_result_files for all
  using (exists (
    select 1 from lab_orders lo
    join medical_records m on m.id = lo.medical_record_id
    where lo.id = lab_result_files.lab_order_id and m.doctor_id = auth.uid()))
  with check (exists (
    select 1 from lab_orders lo
    join medical_records m on m.id = lo.medical_record_id
    where lo.id = lab_result_files.lab_order_id and m.doctor_id = auth.uid()));

create policy lab_result_files_admin_write
  on lab_result_files for all
  using (is_admin() and exists (
    select 1 from lab_orders lo
    join medical_records m on m.id = lo.medical_record_id
    join clinics c on c.id = m.clinic_id
    where lo.id = lab_result_files.lab_order_id and c.account_id = current_account_id()))
  with check (is_admin() and exists (
    select 1 from lab_orders lo
    join medical_records m on m.id = lo.medical_record_id
    join clinics c on c.id = m.clinic_id
    where lo.id = lab_result_files.lab_order_id and c.account_id = current_account_id()));
