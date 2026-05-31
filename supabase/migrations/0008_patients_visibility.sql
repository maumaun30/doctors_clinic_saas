-- =====================================================================
-- 0008_patients_visibility.sql
-- Bugfix: the original patients_select policy hid patients from any
-- staff member who hadn't yet booked an appointment or written a record
-- for them — including the creator. In practice, all clinic staff need
-- to see the patient list to book/search. Demographics are not
-- clinical. Clinical tables (medical_records, prescriptions, lab_orders,
-- patient_conditions) remain tightly gated.
-- =====================================================================

drop policy if exists patients_select on patients;

create policy patients_select
  on patients for select
  using (
    account_id = current_account_id()
    and current_role_v() in ('admin','doctor','secretary')
  );
