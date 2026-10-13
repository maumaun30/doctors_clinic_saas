import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DownloadIcon } from "lucide-react";
import { PageHeader } from "@/app/_components/page-header";
import { PrintButton } from "@/app/_components/print-button";
import { Icon } from "@/app/_components/icons";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/data/queries";
import { auditPatientExport, loadPatientRecord } from "@/lib/export/patient";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Patient record" };

const TZ = "Asia/Manila";
const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d.length === 10 ? `${d}T12:00:00+08:00` : d).toLocaleDateString("en-PH", { timeZone: TZ, year: "numeric", month: "long", day: "numeric" }) : "—";
const fmtWhen = (d: string) =>
  new Date(d).toLocaleString("en-PH", { timeZone: TZ, year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const STATUS: Record<string, string> = { scheduled: "Scheduled", confirmed: "Confirmed", completed: "Completed", cancelled: "Cancelled", no_show: "No-show" };
// Keys written by visits/[appointmentId]/visit-form.tsx.
const VITAL: Record<string, [string, string]> = {
  bp: ["Blood pressure", "mmHg"], hr: ["Heart rate", "bpm"], temp_c: ["Temperature", "°C"], weight_kg: ["Weight", "kg"],
  temp: ["Temperature", "°C"], // older records
};
const vital = (k: string, v: unknown) => VITAL[k] ? `${VITAL[k][0]} ${v} ${VITAL[k][1]}` : `${k.replace(/_/g, " ")} ${v}`;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card break-inside-avoid-page px-5 py-4">
      <h2 className="mb-3 text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

/**
 * Printable copy of everything recorded about one patient, for privacy
 * requests (Data Privacy Act right of access). Doctors and admins only;
 * RLS decides which visits are included. Opening it is audited.
 */
export default async function PatientRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const me = await getMyProfile(sb);
  if (!me?.account_id || (me.role !== "doctor" && me.role !== "admin")) redirect(`/patients/${id}`);

  const rec = await loadPatientRecord(sb, id);
  if (!rec) notFound();
  await auditPatientExport(me.id, me.account_id, id, "print");
  const p = rec.patient;

  return (
    <>
      <PageHeader
        leading={<Button asChild variant="ghost" size="icon" className="no-print">
          <Link href={`/patients/${id}`} aria-label="Back to patient"><Icon name="back" /></Link>
        </Button>}
        title={`Patient record — ${p.full_name}`}
        sub={`Exported ${fmtWhen(rec.exported_at)}${me.role === "doctor" ? " · includes the visits you recorded" : ""}`}
        actions={<>
          <Button asChild variant="outline"><a href={`/api/export/patient/${id}`}><DownloadIcon /> Download JSON</a></Button>
          <PrintButton label="Print or save as PDF" />
        </>} />

      <div className="legal-body grid gap-4">
        <Section title="Patient details">
          <table>
            <tbody>
              <tr><th>Name</th><td>{p.full_name}</td></tr>
              <tr><th>Date of birth</th><td>{fmtDate(p.date_of_birth)}</td></tr>
              <tr><th>Sex</th><td className="capitalize">{p.sex ?? "—"}</td></tr>
              <tr><th>Mobile</th><td>{p.phone ?? "—"}</td></tr>
              <tr><th>Email</th><td>{p.email ?? "—"}</td></tr>
              <tr><th>Address</th><td>{p.address ?? "—"}</td></tr>
              <tr><th>Clinics</th><td>{p.clinics.join(", ") || "—"}</td></tr>
              <tr><th>Registered</th><td>{fmtDate(p.registered_at)}</td></tr>
            </tbody>
          </table>
        </Section>

        <Section title="Problem list">
          {rec.conditions.length === 0 ? <p className="text-muted-foreground">None recorded.</p> : (
            <table>
              <thead><tr><th>Condition</th><th>Status</th><th>Since</th><th>Resolved</th><th>Notes</th></tr></thead>
              <tbody>
                {rec.conditions.map((c: any, i: number) => (
                  <tr key={i}><td>{c.name}</td><td className="capitalize">{c.status}</td><td>{fmtDate(c.since)}</td><td>{fmtDate(c.resolved_at)}</td><td>{c.notes ?? ""}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        <Section title={`Visits (${rec.visits.length})`}>
          {rec.visits.length === 0 ? <p className="text-muted-foreground">No visit records.</p> : (
            <div className="grid gap-5">
              {rec.visits.map((v, i) => (
                <article key={i} className="grid gap-2 border-t pt-4 first:border-t-0 first:pt-0">
                  <h3 className="m-0!">{fmtDate(v.visit_date)} · {v.clinic ?? "Clinic"} · {v.doctor ?? "Doctor"}{v.doctor_prc_license ? ` (PRC ${v.doctor_prc_license})` : ""}</h3>
                  {v.chief_complaint && <p><strong>Chief complaint:</strong> {v.chief_complaint}</p>}
                  {v.diagnosis && <p><strong>Diagnosis:</strong> {v.diagnosis}</p>}
                  {v.vitals && Object.keys(v.vitals).length > 0 && (
                    <p><strong>Vitals:</strong> {Object.entries(v.vitals).filter(([, x]) => x !== null && x !== "").map(([k, x]) => vital(k, x)).join(" · ")}</p>
                  )}
                  {v.prescriptions.length > 0 && (
                    <table>
                      <thead><tr><th>Medication</th><th>Dosage</th><th>Frequency</th><th>Duration</th><th>Instructions</th></tr></thead>
                      <tbody>{v.prescriptions.map((rx: any, j: number) => (
                        <tr key={j}><td>{rx.name}</td><td>{rx.dosage ?? ""}</td><td>{rx.frequency ?? ""}</td><td>{rx.duration ?? ""}</td><td>{rx.instructions ?? ""}</td></tr>
                      ))}</tbody>
                    </table>
                  )}
                  {v.lab_orders.length > 0 && (
                    <table>
                      <thead><tr><th>Lab test</th><th>Status</th><th>Result</th><th>Files</th></tr></thead>
                      <tbody>{v.lab_orders.map((l: any, j: number) => (
                        <tr key={j}>
                          <td>{l.name}</td><td className="capitalize">{l.status}</td>
                          <td>{l.result ?? ""}{l.result_at ? ` (${fmtDate(l.result_at)})` : ""}</td>
                          <td>{(l.files ?? []).map((f: any) => f.file_name).join(", ")}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  )}
                  {v.notes && <p><strong>Notes:</strong> {v.notes}</p>}
                </article>
              ))}
            </div>
          )}
        </Section>

        <Section title={`Appointments (${rec.appointments.length})`}>
          {rec.appointments.length === 0 ? <p className="text-muted-foreground">No appointments.</p> : (
            <table>
              <thead><tr><th>When</th><th>Doctor</th><th>Clinic</th><th>Status</th></tr></thead>
              <tbody>
                {rec.appointments.map((a, i) => (
                  <tr key={i}>
                    <td>{fmtWhen(a.scheduled_at)}</td><td>{a.doctor ?? ""}</td><td>{a.clinic ?? ""}</td>
                    <td>{STATUS[a.status] ?? a.status}{a.booked_online ? " · online" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      </div>
    </>
  );
}
