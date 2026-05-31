import Link from "next/link";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { setAppointmentStatus } from "@/lib/actions/appointments";
import { Icon } from "@/app/_components/icons";
import VisitForm from "./visit-form";
import RescheduleForm from "./reschedule-form";
import LabFiles from "./lab-files";

const STATUS_BADGE: Record<string, { cls: string; label: string }> = {
  scheduled: { cls: "badge", label: "Scheduled" },
  confirmed: { cls: "badge badge-blue", label: "Confirmed" },
  completed: { cls: "badge badge-green", label: "Completed" },
  cancelled: { cls: "badge badge-red", label: "Cancelled" },
  no_show: { cls: "badge badge-red", label: "No-show" },
};

export default async function VisitPage({
  params,
}: { params: Promise<{ appointmentId: string }> }) {
  const { appointmentId } = await params;
  const sb = await createClient();

  const [apptRes, meds, labs, conds] = await Promise.all([
    sb.from("appointments").select("*").eq("id", appointmentId).single(),
    sb.from("common_medications").select("*").order("name"),
    sb.from("common_lab_tests").select("*").order("name"),
    sb.from("common_conditions").select("*").order("name"),
  ]);
  if (apptRes.error) throw apptRes.error;
  const appt = apptRes.data;

  const closed = appt.status === "completed" || appt.status === "cancelled" || appt.status === "no_show";

  let record: any = null;
  let prescriptions: any[] = [];
  let labOrders: any[] = [];
  let labFilesByOrder: Record<string, any[]> = {};
  if (closed) {
    const r = await sb.from("medical_records").select("*")
      .eq("appointment_id", appointmentId).maybeSingle();
    record = r.data;
    if (record) {
      const [rxRes, lRes] = await Promise.all([
        sb.from("prescriptions").select("*").eq("medical_record_id", record.id).order("created_at"),
        sb.from("lab_orders").select("*").eq("medical_record_id", record.id).order("created_at"),
      ]);
      prescriptions = rxRes.data ?? [];
      labOrders = lRes.data ?? [];
      if (labOrders.length > 0) {
        const ids = labOrders.map(l => l.id);
        const { data: files } = await sb.from("lab_result_files")
          .select("id, lab_order_id, file_name, size_bytes, content_type")
          .in("lab_order_id", ids)
          .order("uploaded_at");
        for (const f of files ?? []) {
          (labFilesByOrder[f.lab_order_id] ??= []).push(f);
        }
      }
    }
  }

  async function changeStatus(formData: FormData) {
    "use server";
    await setAppointmentStatus({
      appointment_id: appointmentId,
      status: formData.get("status") as any,
    });
    revalidatePath(`/visits/${appointmentId}`);
    revalidatePath("/schedule");
  }

  const fmt = (iso: string) => new Date(iso).toLocaleString("en-PH", { timeZone: "Asia/Manila" });
  const badge = STATUS_BADGE[appt.status] ?? STATUS_BADGE.scheduled;

  return (
    <>
      <div className="page-head">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Link href="/schedule" className="btn btn-ghost btn-icon" aria-label="Back"><Icon name="back" /></Link>
          <div>
            <h1 style={{ fontSize: 20 }}>Visit</h1>
            <div className="sub">{fmt(appt.scheduled_at)} · {appt.duration_minutes} min</div>
          </div>
        </div>
        <div className="head-actions">
          <span className={badge.cls}><span className="dot" />{badge.label}</span>
        </div>
      </div>

      {!closed && (
        <div className="stack">
          <div className="card" style={{ padding: 20 }}>
            <div className="section-title">Reschedule</div>
            <RescheduleForm
              appointmentId={appointmentId}
              doctorId={appt.doctor_id}
              clinicId={appt.clinic_id}
              currentDuration={appt.duration_minutes}
            />
          </div>

          <div className="card" style={{ padding: 20 }}>
            <div className="section-title">Status</div>
            <form action={changeStatus} style={{ display: "flex", gap: 8 }}>
              <select name="status" defaultValue={appt.status} className="select">
                <option value="scheduled">Scheduled</option>
                <option value="confirmed">Confirmed</option>
                <option value="cancelled">Cancelled</option>
                <option value="no_show">No-show</option>
              </select>
              <button type="submit" className="btn btn-secondary">Update</button>
            </form>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <div className="section-title">Complete visit</div>
            <VisitForm
              appointmentId={appointmentId}
              meds={meds.data ?? []}
              labs={labs.data ?? []}
              conditions={conds.data ?? []}
            />
          </div>
        </div>
      )}

      {closed && (
        <>
          {!record && (
            <div className="card empty">
              This appointment is <strong>{appt.status}</strong>. No medical record was written.
            </div>
          )}
          {record && (
            <div className="stack">
              <div className="head-actions">
                <Link href={`/visits/${appointmentId}/rx`} className="btn btn-secondary"><Icon name="print" /> Print prescription</Link>
              </div>

              {record.vitals && Object.keys(record.vitals).length > 0 && (
                <div className="card" style={{ padding: 20 }}>
                  <div className="section-title">Vitals</div>
                  <dl className="kv">
                    {Object.entries(record.vitals).map(([k, v]) => (
                      <div key={k} style={{ display: "contents" }}><dt>{k}</dt><dd>{String(v)}</dd></div>
                    ))}
                  </dl>
                </div>
              )}
              {record.chief_complaint && (
                <div className="card" style={{ padding: 20 }}>
                  <div className="section-title">Chief complaint</div>
                  <p style={{ margin: 0 }}>{record.chief_complaint}</p>
                </div>
              )}
              {record.diagnosis && (
                <div className="card" style={{ padding: 20 }}>
                  <div className="section-title">Diagnosis</div>
                  <p style={{ margin: 0 }}>{record.diagnosis}</p>
                </div>
              )}
              {prescriptions.length > 0 && (
                <div className="card">
                  <div className="section-bar">Prescriptions <span className="count">· {prescriptions.length}</span></div>
                  {prescriptions.map(p => (
                    <div key={p.id} className="queue-row" style={{ gridTemplateColumns: "1fr" }}>
                      <div>
                        <div className="strong">
                          {p.name}
                          <span style={{ color: "var(--fg-muted)", fontWeight: 400 }}>
                            {[p.dosage, p.frequency, p.duration].filter(Boolean).map((x: string) => ` · ${x}`).join("")}
                          </span>
                        </div>
                        {p.instructions && <div className="hint" style={{ marginTop: 2 }}>{p.instructions}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {labOrders.length > 0 && (
                <div className="card">
                  <div className="section-bar">Lab orders <span className="count">· {labOrders.length}</span></div>
                  {labOrders.map(l => (
                    <div key={l.id} className="queue-row" style={{ gridTemplateColumns: "1fr" }}>
                      <div>
                        <div className="strong">{l.name} <span className="badge" style={{ marginLeft: 6 }}>{l.status}</span></div>
                        {l.result && <div className="hint" style={{ marginTop: 2 }}>Result: {l.result}</div>}
                        <div style={{ marginTop: 8 }}>
                          <LabFiles labOrderId={l.id} files={labFilesByOrder[l.id] ?? []} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {record.notes && (
                <div className="card" style={{ padding: 20 }}>
                  <div className="section-title">Notes</div>
                  <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{record.notes}</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}
