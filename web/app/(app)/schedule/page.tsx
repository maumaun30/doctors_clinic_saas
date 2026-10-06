import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listPatients } from "@/lib/data/queries";
import { getActiveClinicId } from "@/lib/data/clinic-context";
import { Icon } from "@/app/_components/icons";
import { ageYearsMonths } from "@/app/_components/age";
import { PrintButton } from "@/app/_components/print-button";
import BookingForm from "./booking-form";
import type { Database } from "@/lib/database.types";

type AppointmentStatus = Database["public"]["Enums"]["appointment_status"];
const isStatus = (s: string | undefined): s is AppointmentStatus =>
  ["scheduled", "confirmed", "completed", "cancelled", "no_show"].includes(s ?? "");
const STATUS_BADGE: Record<string, { cls: string; label: string }> = {
  scheduled: { cls: "badge", label: "Scheduled" },
  confirmed: { cls: "badge badge-blue", label: "Confirmed" },
  completed: { cls: "badge badge-green", label: "Completed" },
  cancelled: { cls: "badge badge-red", label: "Cancelled" },
  no_show: { cls: "badge badge-red", label: "No-show" },
};

export default async function SchedulePage({
  searchParams,
}: { searchParams: Promise<{ from?: string; to?: string; status?: string }> }) {
  const sp = await searchParams;
  const sb = await createClient();
  const activeClinic = await getActiveClinicId(sb);

  const todayPh = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
  const defaultFrom = sp.from ?? new Date(todayPh.getFullYear(), todayPh.getMonth(), todayPh.getDate())
    .toISOString().slice(0, 10);
  const defaultTo = sp.to ?? new Date(todayPh.getTime() + 30 * 86_400_000).toISOString().slice(0, 10);

  let q = sb.from("appointments")
    .select("id, scheduled_at, duration_minutes, status, notes, patient_id, doctor_id, clinic_id, patient:patients!inner(id, full_name, date_of_birth, sex)")
    .gte("scheduled_at", `${defaultFrom}T00:00:00+08:00`)
    .lte("scheduled_at", `${defaultTo}T23:59:59+08:00`)
    .order("scheduled_at");
  if (activeClinic) q = q.eq("clinic_id", activeClinic);
  if (isStatus(sp.status)) q = q.eq("status", sp.status);
  const { data: appts, error } = await q;
  if (error) throw error;

  const [patients, dcRes] = await Promise.all([
    listPatients(sb),
    sb.from("doctor_clinics")
      .select("doctor_id, clinic_id, doctor:doctors!inner(profiles!inner(full_name)), clinic:clinics!inner(name)"),
  ]);
  if (dcRes.error) throw dcRes.error;

  const dcFiltered = activeClinic
    ? (dcRes.data ?? []).filter((dc: any) => dc.clinic_id === activeClinic)
    : (dcRes.data ?? []);
  const doctorClinics = dcFiltered.map((dc: any) => ({
    doctor_id: dc.doctor_id,
    clinic_id: dc.clinic_id,
    label: activeClinic
      ? dc.doctor.profiles.full_name
      : `${dc.doctor.profiles.full_name} @ ${dc.clinic.name}`,
  }));
  const patientOpts = patients.map(p => ({ id: p.id, label: p.full_name }));

  let clinicName = "All clinics";
  if (activeClinic) {
    const { data: c } = await sb.from("clinics").select("name").eq("id", activeClinic).single();
    clinicName = (c as any)?.name ?? "Clinic";
  }
  const generated = new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" });
  const statusLabel: Record<string, string> = {
    scheduled: "Scheduled", confirmed: "Confirmed", completed: "Completed", cancelled: "Cancelled", no_show: "No-show",
  };

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("en-PH", {
      timeZone: "Asia/Manila", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Schedule</h1>
          <div className="sub">
            {activeClinic ? "Manage appointments for the active clinic" : "Showing all clinics — pick one in the sidebar to scope"}
          </div>
        </div>
        <div className="head-actions">
          <PrintButton label="Print" />
          <a href="#book" className="btn btn-primary"><Icon name="plus" /> Book appointment</a>
        </div>
      </div>

      {/* Printed hard-copy header (hidden on screen) */}
      <div className="print-only print-report-head">
        <h1>Appointment schedule</h1>
        <div className="meta">
          Clinic: {clinicName}<br />
          Date range: {defaultFrom} – {defaultTo}<br />
          {sp.status ? <>Status: {statusLabel[sp.status] ?? sp.status}<br /></> : null}
          Generated: {generated}
        </div>
      </div>

      <form method="get" className="filters">
        <label className="field" style={{ margin: 0 }}>
          <span className="label">From</span>
          <input className="input" type="date" name="from" defaultValue={defaultFrom} style={{ width: 170 }} />
        </label>
        <label className="field" style={{ margin: 0 }}>
          <span className="label">To</span>
          <input className="input" type="date" name="to" defaultValue={defaultTo} style={{ width: 170 }} />
        </label>
        <label className="field" style={{ margin: 0 }}>
          <span className="label">Status</span>
          <select className="select" name="status" defaultValue={sp.status ?? ""}>
            <option value="">All statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="no_show">No-show</option>
          </select>
        </label>
        <button type="submit" className="btn btn-secondary" style={{ alignSelf: "flex-end" }}>Filter</button>
      </form>

      <div className="card table-wrap">
        <table className="tbl">
          <thead>
            <tr><th>When (PH)</th><th>Patient</th><th>Status</th><th>Duration</th><th className="no-print"></th></tr>
          </thead>
          <tbody>
            {appts.map((a: any) => {
              const badge = STATUS_BADGE[a.status] ?? STATUS_BADGE.scheduled;
              const meta = [a.patient?.sex, ageYearsMonths(a.patient?.date_of_birth)].filter(Boolean).join(" · ");
              return (
                <tr key={a.id}>
                  <td className="num strong">{fmt(a.scheduled_at)}</td>
                  <td>
                    {a.patient ? (
                      <Link href={`/patients/${a.patient.id}`} style={{ color: "inherit", textDecoration: "none" }}>
                        <span className="strong">{a.patient.full_name}</span>
                        {meta && <span style={{ color: "var(--fg-muted)" }}> · {meta}</span>}
                      </Link>
                    ) : <span className="hint">—</span>}
                  </td>
                  <td><span className={badge.cls}><span className="dot" />{badge.label}</span></td>
                  <td className="num">{a.duration_minutes} min</td>
                  <td className="no-print" style={{ textAlign: "right" }}>
                    <Link href={`/visits/${a.id}`} className="btn btn-ghost btn-sm btn-icon" aria-label="Open">
                      <Icon name="chevright" />
                    </Link>
                  </td>
                </tr>
              );
            })}
            {appts.length === 0 && (
              <tr><td colSpan={5} className="empty">No appointments in this range.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="no-print">
        <div id="book" className="page-head" style={{ marginTop: 32, marginBottom: 16 }}>
          <div><h1 style={{ fontSize: 18 }}>Book appointment</h1></div>
        </div>
        <BookingForm patients={patientOpts} doctorClinics={doctorClinics} />
      </div>
    </>
  );
}
