import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

export type PatientRecord = Awaited<ReturnType<typeof loadPatientRecord>>;

/**
 * Everything the caller may see about one patient, for a privacy request
 * (printable record + JSON). Uses the caller's session, so RLS decides:
 * admins get every visit in the account, doctors the visits they wrote.
 * Returns null if the patient isn't visible.
 */
export async function loadPatientRecord(sb: SupabaseClient, patientId: string) {
  const { data: patient } = await sb.from("patients")
    .select("id, full_name, date_of_birth, sex, phone, email, address, created_at, clinics:patient_clinics(clinic:clinics(name))")
    .eq("id", patientId).maybeSingle();
  if (!patient) return null;

  const [conditions, visits, appointments] = await Promise.all([
    sb.from("patient_conditions").select("name, status, since, resolved_at, notes, created_at")
      .eq("patient_id", patientId).order("created_at"),
    sb.from("medical_records")
      .select(`id, visit_date, chief_complaint, diagnosis, vitals, notes, created_at,
        doctor:doctors(prc_license_no, profile:staff_profiles(full_name)), clinic:clinics(name),
        prescriptions(name, dosage, frequency, duration, instructions, created_at),
        lab_orders(name, status, result, result_at, created_at, files:lab_result_files(file_name, content_type, size_bytes, uploaded_at))`)
      .eq("patient_id", patientId).order("visit_date", { ascending: false }),
    sb.from("appointments")
      .select("scheduled_at, duration_minutes, status, source, notes, doctor:doctors(profile:staff_profiles(full_name)), clinic:clinics(name)")
      .eq("patient_id", patientId).order("scheduled_at", { ascending: false }),
  ]);
  for (const r of [conditions, visits, appointments]) if (r.error) throw new Error(r.error.message);

  const p = patient as any;
  return {
    exported_at: new Date().toISOString(),
    patient: {
      id: p.id, full_name: p.full_name, date_of_birth: p.date_of_birth, sex: p.sex,
      phone: p.phone, email: p.email, address: p.address, registered_at: p.created_at,
      clinics: (p.clinics ?? []).map((c: any) => c.clinic?.name).filter(Boolean) as string[],
    },
    conditions: conditions.data ?? [],
    visits: ((visits.data ?? []) as any[]).map(v => ({
      visit_date: v.visit_date as string,
      clinic: v.clinic?.name as string | undefined,
      doctor: v.doctor?.profile?.full_name as string | undefined,
      doctor_prc_license: v.doctor?.prc_license_no as string | null,
      chief_complaint: v.chief_complaint as string | null,
      diagnosis: v.diagnosis as string | null,
      vitals: v.vitals as Record<string, unknown> | null,
      notes: v.notes as string | null,
      prescriptions: v.prescriptions ?? [],
      lab_orders: v.lab_orders ?? [],
    })),
    appointments: ((appointments.data ?? []) as any[]).map(a => ({
      scheduled_at: a.scheduled_at as string, duration_minutes: a.duration_minutes as number,
      status: a.status as string, booked_online: a.source === "online", notes: a.notes as string | null,
      doctor: a.doctor?.profile?.full_name as string | undefined, clinic: a.clinic?.name as string | undefined,
    })),
  };
}

/** Record that a patient's data was exported (shows in the audit log). */
export async function auditPatientExport(actorId: string, accountId: string, patientId: string, format: "print" | "json") {
  await createAdminClient().from("audit_log").insert({
    actor_id: actorId, account_id: accountId, table_name: "exports", row_id: patientId, operation: "INSERT",
    after: { kind: "patient", format },
  });
}
