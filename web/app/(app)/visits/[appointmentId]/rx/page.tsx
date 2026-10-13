import { createClient } from "@/lib/supabase/server";
import PrintTrigger from "./print-trigger";

export default async function RxPrintPage({
  params,
}: { params: Promise<{ appointmentId: string }> }) {
  const { appointmentId } = await params;
  const sb = await createClient();

  const { data: appt, error } = await sb
    .from("appointments").select("*").eq("id", appointmentId).single();
  if (error) throw error;

  const [{ data: doctor }, { data: clinic }, { data: patient }, { data: record }] = await Promise.all([
    sb.from("doctors")
      .select("specialization, prc_license_no, profiles:staff_profiles!inner(full_name)")
      .eq("profile_id", appt.doctor_id).single(),
    sb.from("clinics").select("name, address").eq("id", appt.clinic_id).single(),
    sb.from("patients").select("full_name, date_of_birth, sex").eq("id", appt.patient_id).single(),
    sb.from("medical_records").select("id, visit_date, diagnosis")
      .eq("appointment_id", appointmentId).maybeSingle(),
  ]);

  let rx: any[] = [];
  if (record) {
    const { data } = await sb.from("prescriptions")
      .select("*").eq("medical_record_id", record.id).order("created_at");
    rx = data ?? [];
  }

  const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-PH", { timeZone: "Asia/Manila" });

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 16, color: "#111" }}>
      <PrintTrigger />

      <style>{`
        @media print {
          aside, button, a, summary { display: none !important; }
          body { background: white !important; }
          .no-print { display: none !important; }
          main { padding: 0 !important; }
        }
      `}</style>

      <header style={{ borderBottom: "2px solid #111", paddingBottom: 8, marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>{(clinic as any)?.name}</h1>
        <div style={{ color: "#444" }}>{(clinic as any)?.address}</div>
        <div style={{ marginTop: 8 }}>
          <strong>{(doctor as any)?.profiles.full_name}</strong>
          {(doctor as any)?.specialization && ` — ${(doctor as any).specialization}`}
          {(doctor as any)?.prc_license_no && ` · PRC ${(doctor as any).prc_license_no}`}
        </div>
      </header>

      <section style={{ marginBottom: 16 }}>
        <table style={{ width: "100%", fontSize: 14 }}>
          <tbody>
            <tr>
              <td><strong>Patient:</strong> {(patient as any)?.full_name}</td>
              <td style={{ textAlign: "right" }}>
                <strong>Date:</strong> {fmtDate(record?.visit_date ?? appt.scheduled_at)}
              </td>
            </tr>
            <tr>
              <td>
                {(patient as any)?.date_of_birth && <>DOB: {(patient as any).date_of_birth} · </>}
                {(patient as any)?.sex && <>Sex: {(patient as any).sex}</>}
              </td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </section>

      {record?.diagnosis && (
        <section style={{ marginBottom: 16 }}>
          <strong>Diagnosis:</strong> {record.diagnosis}
        </section>
      )}

      <section>
        <h2 style={{ fontSize: 28, margin: 0 }}>℞</h2>
        {rx.length === 0
          ? <p style={{ color: "#888" }}>No medications prescribed.</p>
          : (
            <ol style={{ fontSize: 15, lineHeight: 1.5 }}>
              {rx.map(p => (
                <li key={p.id} style={{ marginBottom: 8 }}>
                  <strong>{p.name}</strong>
                  {p.dosage && ` — ${p.dosage}`}
                  {p.frequency && `, ${p.frequency}`}
                  {p.duration && ` for ${p.duration}`}
                  {p.instructions && <div style={{ color: "#444" }}>{p.instructions}</div>}
                </li>
              ))}
            </ol>
          )}
      </section>

      <footer style={{ marginTop: 60, borderTop: "1px solid #444", paddingTop: 8 }}>
        <div style={{ textAlign: "right" }}>
          <div>_____________________________</div>
          <div>{(doctor as any)?.profiles.full_name}</div>
          {(doctor as any)?.prc_license_no && <div>PRC {(doctor as any).prc_license_no}</div>}
        </div>
      </footer>
    </div>
  );
}
