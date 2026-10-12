-- =====================================================================
-- 0023 — only admins manage doctors' working hours.
--
-- Hours are now edited from the admin Doctors page; the Availability page
-- is read-only for everyone. Drop the policy that let a doctor write their
-- own rows. Reads are unchanged (doctor sees own, admin sees account,
-- assigned secretaries see their doctors'); admins keep
-- doctor_availability_admin_write.
-- =====================================================================

drop policy if exists doctor_availability_doctor_write on doctor_availability;
