import Link from "next/link";
import { PageHeader } from "@/app/_components/page-header";
import { createClient } from "@/lib/supabase/server";
import { getBookingOptions } from "@/lib/data/queries";
import { getActiveClinicId } from "@/lib/data/clinic-context";
import { Icon } from "@/app/_components/icons";
import { ageYearsMonths } from "@/app/_components/age";
import { PrintButton } from "@/app/_components/print-button";
import { BookDialog } from "./book-dialog";
import type { Database } from "@/lib/database.types";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { phYmd, phYmdOffset } from "@/lib/dates";

type AppointmentStatus = Database["public"]["Enums"]["appointment_status"];
const isStatus = (s: string | undefined): s is AppointmentStatus =>
  ["scheduled", "confirmed", "completed", "cancelled", "no_show"].includes(s ?? "");
const STATUS_BADGE: Record<string, { variant: BadgeVariant; label: string }> = {
  scheduled: { variant: "secondary", label: "Scheduled" },
  confirmed: { variant: "info",             label: "Confirmed" },
  completed: { variant: "success",           label: "Completed" },
  cancelled: { variant: "destructive",     label: "Cancelled" },
  no_show: { variant: "destructive",     label: "No-show" },
};

export default async function SchedulePage({
  searchParams,
}: { searchParams: Promise<{ from?: string; to?: string; status?: string }> }) {
  const sp = await searchParams;
  const sb = await createClient();
  const activeClinic = await getActiveClinicId(sb);

  const defaultFrom = sp.from ?? phYmd();
  const defaultTo = sp.to ?? phYmdOffset(30);

  let q = sb.from("appointments")
    .select("id, scheduled_at, duration_minutes, status, notes, source, patient_id, doctor_id, clinic_id, patient:patients!inner(id, full_name, date_of_birth, sex)")
    .gte("scheduled_at", `${defaultFrom}T00:00:00+08:00`)
    .lte("scheduled_at", `${defaultTo}T23:59:59+08:00`)
    .order("scheduled_at");
  if (activeClinic) q = q.eq("clinic_id", activeClinic);
  if (isStatus(sp.status)) q = q.eq("status", sp.status);
  const { data: appts, error } = await q;
  if (error) throw error;

  const booking = await getBookingOptions(sb, activeClinic);

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
      <PageHeader icon="calendar" title="Schedule"
        sub={activeClinic ? "Manage appointments for the active clinic" : "Showing all clinics — pick one in the sidebar to scope"}
        actions={<>
          <PrintButton label="Print" />
          <BookDialog label="Book appointment" {...booking} />
        </>} />

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
          <Input type="date" name="from" defaultValue={defaultFrom} style={{ width: 170 }} />
        </label>
        <label className="field" style={{ margin: 0 }}>
          <span className="label">To</span>
          <Input type="date" name="to" defaultValue={defaultTo} style={{ width: 170 }} />
        </label>
        <label className="field" style={{ margin: 0 }}>
          <span className="label">Status</span>
          <NativeSelect name="status" defaultValue={sp.status ?? ""}>
            <NativeSelectOption value="">All statuses</NativeSelectOption>
            <NativeSelectOption value="scheduled">Scheduled</NativeSelectOption>
            <NativeSelectOption value="confirmed">Confirmed</NativeSelectOption>
            <NativeSelectOption value="completed">Completed</NativeSelectOption>
            <NativeSelectOption value="cancelled">Cancelled</NativeSelectOption>
            <NativeSelectOption value="no_show">No-show</NativeSelectOption>
          </NativeSelect>
        </label>
        <Button variant="outline" type="submit" style={{ alignSelf: "flex-end" }}>Filter</Button>
      </form>

      <div className="card table-wrap">
        <Table>
          <TableHeader>
            <TableRow><TableHead>When (PH)</TableHead><TableHead>Patient</TableHead><TableHead>Status</TableHead><TableHead>Duration</TableHead><TableHead className="no-print"></TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {appts.map((a: any) => {
              const badge = STATUS_BADGE[a.status] ?? STATUS_BADGE.scheduled;
              const meta = [a.patient?.sex, ageYearsMonths(a.patient?.date_of_birth)].filter(Boolean).join(" · ");
              return (
                <TableRow key={a.id}>
                  <TableCell className="num strong">{fmt(a.scheduled_at)}</TableCell>
                  <TableCell>
                    {a.patient ? (
                      <Link href={`/patients/${a.patient.id}`} style={{ color: "inherit", textDecoration: "none" }}>
                        <span className="strong">{a.patient.full_name}</span>
                        {meta && <span style={{ color: "var(--fg-muted)" }}> · {meta}</span>}
                      </Link>
                    ) : <span className="hint">—</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={badge.variant}><span className="dot" />{badge.label}</Badge>
                    {a.source === "online" && <Badge variant="info" style={{ marginLeft: 6 }} title="Booked by the patient online">Online</Badge>}
                  </TableCell>
                  <TableCell className="num">{a.duration_minutes} min</TableCell>
                  <TableCell className="no-print" style={{ textAlign: "right" }}>
                    <Button asChild variant="ghost" size="icon-sm"><Link href={`/visits/${a.id}`} aria-label="Open">
                        <Icon name="chevright" />
                      </Link></Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {appts.length === 0 && (
              <TableRow><TableCell colSpan={5} className="empty">No appointments in this range.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
