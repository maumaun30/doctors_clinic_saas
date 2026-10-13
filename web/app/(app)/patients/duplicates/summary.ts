import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PatientSummary = {
  id: string; full_name: string; date_of_birth: string | null; sex: string | null;
  phone: string | null; email: string | null; address: string | null; created_at: string;
  clinics: string[]; appointments: number; visits: number; last_visit: string | null;
};

/** Details plus history counts for comparing possible duplicates. */
export async function loadSummaries(sb: SupabaseClient, ids: string[]): Promise<Map<string, PatientSummary>> {
  const out = new Map<string, PatientSummary>();
  if (!ids.length) return out;
  const [pRes, aRes, vRes] = await Promise.all([
    sb.from("patients")
      .select("id, full_name, date_of_birth, sex, phone, email, address, created_at, clinics:patient_clinics(clinic:clinics(name))")
      .in("id", ids),
    sb.from("appointments").select("patient_id").in("patient_id", ids),
    sb.from("medical_records").select("patient_id, visit_date").in("patient_id", ids),
  ]);
  for (const r of [pRes, aRes, vRes]) if (r.error) throw new Error(r.error.message);
  for (const p of (pRes.data ?? []) as any[]) {
    out.set(p.id, {
      id: p.id, full_name: p.full_name, date_of_birth: p.date_of_birth, sex: p.sex,
      phone: p.phone, email: p.email, address: p.address, created_at: p.created_at,
      clinics: (p.clinics ?? []).map((c: any) => c.clinic?.name).filter(Boolean),
      appointments: 0, visits: 0, last_visit: null,
    });
  }
  for (const a of aRes.data ?? []) { const s = out.get(a.patient_id); if (s) s.appointments++; }
  for (const v of vRes.data ?? []) {
    const s = out.get(v.patient_id);
    if (!s) continue;
    s.visits++;
    if (!s.last_visit || v.visit_date > s.last_visit) s.last_visit = v.visit_date;
  }
  return out;
}

/** Default "keep": the record with more history, else the older one. */
export function suggestKeep(a: PatientSummary, b: PatientSummary): string {
  const weight = (s: PatientSummary) => s.visits * 10 + s.appointments;
  if (weight(a) !== weight(b)) return weight(a) > weight(b) ? a.id : b.id;
  return a.created_at <= b.created_at ? a.id : b.id;
}
