import Link from "next/link";
import { ClipboardXIcon, PrinterIcon } from "lucide-react";
import { PageHeader } from "@/app/_components/page-header";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/data/queries";
import { Icon } from "@/app/_components/icons";
import { ageYearsMonths } from "@/app/_components/age";
import { AppointmentStatusBadge, LabStatusBadge } from "@/app/_components/appointment-status";
import { AppointmentActions } from "@/app/(app)/schedule/appointment-actions";
import VisitForm from "./visit-form";
import RescheduleDialog from "./reschedule-form";
import LabFiles from "./lab-files";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const TZ = "Asia/Manila";
const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString("en-PH", {
    timeZone: TZ, weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  });
const fmtDate = (ymd: string) =>
  new Date(`${ymd}T12:00:00+08:00`).toLocaleDateString("en-PH", { timeZone: TZ, month: "short", day: "numeric", year: "numeric" });

// Display labels for stored vitals keys (older records used "temp").
const VITAL_LABEL: Record<string, [string, string]> = {
  bp: ["Blood pressure", "mmHg"],
  hr: ["Heart rate", "bpm"],
  temp_c: ["Temperature", "°C"],
  temp: ["Temperature", "°C"],
  weight_kg: ["Weight", "kg"],
};

export default async function VisitPage({ params }: { params: Promise<{ appointmentId: string }> }) {
  const { appointmentId } = await params;
  const sb = await createClient();
  const me = await getMyProfile(sb);

  const [apptRes, meds, labs, conds] = await Promise.all([
    sb.from("appointments")
      .select("*, patient:patients(id, full_name, date_of_birth, sex, phone), doctor:doctors(profile:staff_profiles(full_name)), clinic:clinics(name)")
      .eq("id", appointmentId).single(),
    sb.from("common_medications").select("*").order("name"),
    sb.from("common_lab_tests").select("*").order("name"),
    sb.from("common_conditions").select("*").order("name"),
  ]);
  if (apptRes.error) throw apptRes.error;
  const appt = apptRes.data as any;
  const closed = ["completed", "cancelled", "no_show"].includes(appt.status);
  // complete_visit_full() only accepts the treating doctor.
  const canChart = me?.id === appt.doctor_id;

  let record: any = null;
  let prescriptions: any[] = [];
  let labOrders: any[] = [];
  const labFilesByOrder: Record<string, any[]> = {};
  if (closed) {
    record = (await sb.from("medical_records").select("*").eq("appointment_id", appointmentId).maybeSingle()).data;
    if (record) {
      const [rxRes, lRes] = await Promise.all([
        sb.from("prescriptions").select("*").eq("medical_record_id", record.id).order("created_at"),
        sb.from("lab_orders").select("*").eq("medical_record_id", record.id).order("created_at"),
      ]);
      prescriptions = rxRes.data ?? [];
      labOrders = lRes.data ?? [];
      if (labOrders.length > 0) {
        const { data: files } = await sb.from("lab_result_files")
          .select("id, lab_order_id, file_name, size_bytes, content_type")
          .in("lab_order_id", labOrders.map(l => l.id)).order("uploaded_at");
        for (const f of files ?? []) (labFilesByOrder[f.lab_order_id] ??= []).push(f);
      }
    }
  }

  // Context for the doctor while charting (clinical reads fail for secretaries).
  let activeProblems: any[] = [];
  let lastVisit: any = null;
  if (!closed && appt.patient && canChart) {
    try {
      const [cRes, rRes] = await Promise.all([
        sb.from("patient_conditions").select("id, name, since").eq("patient_id", appt.patient.id).eq("status", "active"),
        sb.from("medical_records").select("visit_date, diagnosis, chief_complaint")
          .eq("patient_id", appt.patient.id).order("visit_date", { ascending: false }).limit(1).maybeSingle(),
      ]);
      activeProblems = cRes.data ?? [];
      lastVisit = rRes.data;
    } catch { /* ignore */ }
  }

  const who = appt.patient?.full_name ?? "Patient";
  const sub = [fmtWhen(appt.scheduled_at), `${appt.duration_minutes} min`, appt.doctor?.profile?.full_name, appt.clinic?.name]
    .filter(Boolean).join(" · ");

  return (
    <>
      <PageHeader
        leading={<>
          <Button asChild variant="ghost" size="icon"><Link href="/schedule" aria-label="Back to schedule"><Icon name="back" /></Link></Button>
          <span className="page-icon"><Icon name="calendar" /></span>
        </>}
        title={appt.patient
          ? <Link href={`/patients/${appt.patient.id}`} className="hover:underline">{who}</Link>
          : "Visit"}
        sub={sub}
        actions={<>
          <AppointmentStatusBadge status={appt.status} />
          {closed && record && (
            <Button asChild variant="outline">
              <Link href={`/visits/${appointmentId}/rx`}><PrinterIcon /> Print prescription</Link>
            </Button>
          )}
          {!closed && (
            <>
              <RescheduleDialog appointmentId={appointmentId} doctorId={appt.doctor_id} clinicId={appt.clinic_id}
                currentDuration={appt.duration_minutes} currentAt={appt.scheduled_at} />
              <AppointmentActions id={appointmentId} status={appt.status} patient={who}
                when={fmtWhen(appt.scheduled_at)} onVisitPage />
            </>
          )}
        </>} />

      {appt.notes && (
        <p className="-mt-2 mb-4 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Reason for visit:</span> {appt.notes}
        </p>
      )}

      {/* ---------- Open visit ---------- */}
      {!closed && (canChart ? (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <VisitForm appointmentId={appointmentId} meds={meds.data ?? []} labs={labs.data ?? []} conditions={conds.data ?? []} />
          <Card className="lg:sticky lg:top-4">
            <CardHeader>
              <CardTitle>Patient</CardTitle>
              <CardDescription>
                {[appt.patient?.sex, ageYearsMonths(appt.patient?.date_of_birth)].filter(Boolean).join(" · ") || "—"}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm">
              <div className="grid gap-1.5">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Active problems</div>
                {activeProblems.length === 0
                  ? <span className="text-muted-foreground">None recorded</span>
                  : <div className="flex flex-wrap gap-1.5">
                      {activeProblems.map(c => <Badge key={c.id} variant="warning"><span className="dot" />{c.name}</Badge>)}
                    </div>}
              </div>
              <div className="grid gap-1">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Last visit</div>
                {lastVisit
                  ? <>
                      <span className="font-medium">{lastVisit.diagnosis ?? "No diagnosis recorded"}</span>
                      <span className="text-xs text-muted-foreground">
                        {fmtDate(lastVisit.visit_date)}{lastVisit.chief_complaint ? ` · ${lastVisit.chief_complaint}` : ""}
                      </span>
                    </>
                  : <span className="text-muted-foreground">First visit</span>}
              </div>
              {appt.patient && (
                <Button asChild variant="outline" size="sm"><Link href={`/patients/${appt.patient.id}`}>Open full chart</Link></Button>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="card flex flex-col items-center gap-2 px-6 py-12 text-center text-sm text-muted-foreground">
          Only {appt.doctor?.profile?.full_name ?? "the treating doctor"} can chart this visit.
          Use Reschedule or the ⋯ menu to change the appointment.
        </div>
      ))}

      {/* ---------- Closed visit ---------- */}
      {closed && !record && (
        <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
          <div className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <ClipboardXIcon className="size-5" />
          </div>
          <div className="text-sm text-muted-foreground">
            This appointment was <AppointmentStatusBadge status={appt.status} /> — no medical record was written.
          </div>
        </div>
      )}

      {closed && record && (
        <div className="grid gap-4 md:grid-cols-2">
          {record.vitals && Object.keys(record.vitals).length > 0 && (
            <Card className="md:col-span-2">
              <CardHeader><CardTitle>Vitals</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {Object.entries(record.vitals).map(([k, v]) => {
                  const [label, unit] = VITAL_LABEL[k] ?? [k, ""];
                  return (
                    <div key={k} className="grid gap-0.5">
                      <span className="text-xs text-muted-foreground">{label}</span>
                      <span className="text-lg font-semibold tabular-nums">{String(v)} <span className="text-xs font-normal text-muted-foreground">{unit}</span></span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader><CardTitle>Chief complaint</CardTitle></CardHeader>
            <CardContent className="text-sm">{record.chief_complaint ?? <span className="text-muted-foreground">—</span>}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Diagnosis</CardTitle></CardHeader>
            <CardContent className="text-sm font-medium">{record.diagnosis ?? <span className="font-normal text-muted-foreground">—</span>}</CardContent>
          </Card>
          {prescriptions.length > 0 && (
            <Card className="md:col-span-2">
              <CardHeader><CardTitle>Prescriptions</CardTitle></CardHeader>
              <CardContent className="grid gap-2">
                {prescriptions.map(p => (
                  <div key={p.id} className="rounded-lg border px-3 py-2">
                    <div className="font-medium">
                      {p.name}
                      <span className="font-normal text-muted-foreground">
                        {[p.dosage, p.frequency, p.duration].filter(Boolean).map((x: string) => ` · ${x}`).join("")}
                      </span>
                    </div>
                    {p.instructions && <div className="text-sm text-muted-foreground">{p.instructions}</div>}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          {labOrders.length > 0 && (
            <Card className="md:col-span-2">
              <CardHeader><CardTitle>Lab orders</CardTitle></CardHeader>
              <CardContent className="grid gap-2">
                {labOrders.map(l => (
                  <div key={l.id} className="grid gap-2 rounded-lg border px-3 py-2">
                    <div className="flex items-center gap-2 font-medium">{l.name} <LabStatusBadge status={l.status} /></div>
                    {l.result && <div className="text-sm text-muted-foreground">Result: {l.result}</div>}
                    <LabFiles labOrderId={l.id} files={labFilesByOrder[l.id] ?? []} />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          {record.notes && (
            <Card className="md:col-span-2">
              <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
              <CardContent className="whitespace-pre-wrap text-sm">{record.notes}</CardContent>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
