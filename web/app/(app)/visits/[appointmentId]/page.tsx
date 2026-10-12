import Link from "next/link";
import { PageHeader } from "@/app/_components/page-header";
import { Section } from "@/app/_components/section";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { setAppointmentStatus } from "@/lib/actions/appointments";
import { Icon } from "@/app/_components/icons";
import VisitForm from "./visit-form";
import RescheduleForm from "./reschedule-form";
import LabFiles from "./lab-files";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Badge, type BadgeVariant } from "@/components/ui/badge";

const STATUS_BADGE: Record<string, { variant: BadgeVariant; label: string }> = {
  scheduled: { variant: "secondary", label: "Scheduled" },
  confirmed: { variant: "info",             label: "Confirmed" },
  completed: { variant: "success",           label: "Completed" },
  cancelled: { variant: "destructive",     label: "Cancelled" },
  no_show: { variant: "destructive",     label: "No-show" },
};

export default async function VisitPage({
  params,
}: { params: Promise<{ appointmentId: string }> }) {
  const { appointmentId } = await params;
  const sb = await createClient();

  const [apptRes, meds, labs, conds] = await Promise.all([
    sb.from("appointments").select("*, patient:patients(id, full_name)").eq("id", appointmentId).single(),
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
      <PageHeader
        leading={<>
          <Button asChild variant="ghost" size="icon"><Link href="/schedule" aria-label="Back to schedule"><Icon name="back" /></Link></Button>
          <span className="page-icon"><Icon name="calendar" /></span>
        </>}
        title={appt.patient
          ? <Link href={`/patients/${appt.patient.id}`} style={{ color: "inherit", textDecoration: "none" }}>{appt.patient.full_name}</Link>
          : "Visit"}
        sub={`Visit · ${fmt(appt.scheduled_at)} · ${appt.duration_minutes} min`}
        actions={<>
          <Badge variant={badge.variant}><span className="dot" />{badge.label}</Badge>
          {closed && record && (
            <Button asChild variant="outline">(<Link href={`/visits/${appointmentId}/rx`}><Icon name="print" />Print prescription</Link>)</Button>
          )}
        </>} />

      {!closed && (
        <div>
          <Section id="reschedule" title="Reschedule" description="Pick a new open slot. The patient’s reminders follow the new time.">
            <RescheduleForm
              appointmentId={appointmentId}
              doctorId={appt.doctor_id}
              clinicId={appt.clinic_id}
              currentDuration={appt.duration_minutes}
            />
          </Section>

          <Section title="Status" description="Confirm, cancel or mark as no-show. Completing happens below.">
            <form action={changeStatus} style={{ display: "flex", gap: 8 }}>
              <NativeSelect name="status" defaultValue={appt.status}>
                <NativeSelectOption value="scheduled">Scheduled</NativeSelectOption>
                <NativeSelectOption value="confirmed">Confirmed</NativeSelectOption>
                <NativeSelectOption value="cancelled">Cancelled</NativeSelectOption>
                <NativeSelectOption value="no_show">No-show</NativeSelectOption>
              </NativeSelect>
              <Button variant="outline" type="submit">Update</Button>
            </form>
          </Section>

          <Section title="Complete visit" description="Vitals, diagnosis, prescriptions and labs. Saving closes the visit and writes the medical record.">
            <VisitForm
              appointmentId={appointmentId}
              meds={meds.data ?? []}
              labs={labs.data ?? []}
              conditions={conds.data ?? []}
            />
          </Section>
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
            <div>

              {record.vitals && Object.keys(record.vitals).length > 0 && (
                <Section title="Vitals">
                  <dl className="kv">
                    {Object.entries(record.vitals).map(([k, v]) => (
                      <div key={k} style={{ display: "contents" }}><dt>{k}</dt><dd>{String(v)}</dd></div>
                    ))}
                  </dl>
                </Section>
              )}
              {record.chief_complaint && (
                <Section title="Chief complaint">
                  <p style={{ margin: 0 }}>{record.chief_complaint}</p>
                </Section>
              )}
              {record.diagnosis && (
                <Section title="Diagnosis">
                  <p style={{ margin: 0 }}>{record.diagnosis}</p>
                </Section>
              )}
              {prescriptions.length > 0 && (
                <Section title={<>Prescriptions <span className="count">· {prescriptions.length}</span></>} flush>
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
                </Section>
              )}
              {labOrders.length > 0 && (
                <Section title={<>Lab orders <span className="count">· {labOrders.length}</span></>} flush>
                  {labOrders.map(l => (
                    <div key={l.id} className="queue-row" style={{ gridTemplateColumns: "1fr" }}>
                      <div>
                        <div className="strong">{l.name} <Badge variant="secondary" style={{ marginLeft: 6 }}>{l.status}</Badge></div>
                        {l.result && <div className="hint" style={{ marginTop: 2 }}>Result: {l.result}</div>}
                        <div style={{ marginTop: 8 }}>
                          <LabFiles labOrderId={l.id} files={labFilesByOrder[l.id] ?? []} />
                        </div>
                      </div>
                    </div>
                  ))}
                </Section>
              )}
              {record.notes && (
                <Section title="Notes">
                  <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{record.notes}</p>
                </Section>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}
