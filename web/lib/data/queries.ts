// Framework-agnostic query helpers. Take a SupabaseClient so they can be
// reused from Server Components, Server Actions, and (later) Expo.
import type { SupabaseClient } from "@supabase/supabase-js";

export async function getMyProfile(sb: SupabaseClient) {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data, error } = await sb
    .from("profiles")
    .select("id, role, account_id, full_name, phone")
    .eq("id", user.id)
    .single();
  if (error) throw error;
  return data;
}

export async function listClinics(sb: SupabaseClient) {
  const { data, error } = await sb.from("clinics").select("*").order("name");
  if (error) throw error;
  return data;
}

export async function listPatients(sb: SupabaseClient) {
  const { data, error } = await sb
    .from("patients")
    .select("id, full_name, date_of_birth, sex, phone")
    .order("full_name");
  if (error) throw error;
  return data;
}

export async function getPatient(sb: SupabaseClient, id: string) {
  const { data, error } = await sb.from("patients").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

export async function listAppointments(
  sb: SupabaseClient,
  opts?: { from?: string; to?: string; clinicId?: string },
) {
  let q = sb
    .from("appointments")
    .select(
      "id, scheduled_at, duration_minutes, status, notes, patient_id, doctor_id, clinic_id",
    )
    .order("scheduled_at");
  if (opts?.from) q = q.gte("scheduled_at", opts.from);
  if (opts?.to) q = q.lte("scheduled_at", opts.to);
  if (opts?.clinicId) q = q.eq("clinic_id", opts.clinicId);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function listMedicalRecords(sb: SupabaseClient, patientId: string) {
  const { data, error } = await sb
    .from("medical_records")
    .select("*")
    .eq("patient_id", patientId)
    .order("visit_date", { ascending: false });
  if (error) throw error;
  return data;
}

export async function listPendingUsers(sb: SupabaseClient) {
  const { data, error } = await sb
    .from("profiles")
    .select("id, full_name, phone, role, account_id")
    .eq("role", "pending");
  if (error) throw error;
  return data;
}
