import { notFound } from "next/navigation";
import { getPatientAppointment } from "@/lib/actions/patient-link";
import { PatientActions } from "./patient-actions";
import { PoweredBy } from "@/app/_components/logo";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your appointment", robots: { index: false, follow: false } };

const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString("en-PH", {
    timeZone: "Asia/Manila", weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
  });

/** Patient's own appointment, from the link in their reminder: confirm or cancel. */
export default async function PatientAppointmentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const a = await getPatientAppointment(token);
  if (!a) notFound();

  return (
    <div className="auth-screen">
      <div className="card auth-card book-card">
        <div className="auth-brand">
          <span className="mark">{a.clinic_name.trim()[0]?.toUpperCase() ?? "C"}</span>
          <span className="wordmark">{a.clinic_name}</span>
        </div>
        <h2>Hi {a.patient_first_name}</h2>
        <p className="sub">Your appointment</p>
        <div className="grid gap-1 rounded-lg border bg-muted/30 p-4 text-sm">
          <span className="text-base font-semibold">{fmtWhen(a.scheduled_at)}</span>
          <span>with {a.doctor_name}</span>
          <span className="text-muted-foreground">{a.clinic_name}{a.clinic_address ? `, ${a.clinic_address}` : ""}</span>
        </div>
        <PatientActions token={token} status={a.status} canConfirm={a.can_confirm} canCancel={a.can_cancel}
          past={new Date(a.scheduled_at).getTime() <= Date.now()} />
      </div>
      <PoweredBy />
    </div>
  );
}
