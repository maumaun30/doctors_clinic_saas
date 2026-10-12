import Link from "next/link";
import { CalendarXIcon } from "lucide-react";
import { PageHeader } from "@/app/_components/page-header";
import { createClient } from "@/lib/supabase/server";
import { getBookingOptions } from "@/lib/data/queries";
import { getActiveClinicId } from "@/lib/data/clinic-context";
import { ageYearsMonths } from "@/app/_components/age";
import { PrintButton } from "@/app/_components/print-button";
import { BookDialog } from "./book-dialog";
import { AppointmentActions } from "./appointment-actions";
import type { Database } from "@/lib/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { phYmd, phYmdOffset } from "@/lib/dates";

type AppointmentStatus = Database["public"]["Enums"]["appointment_status"];
const STATUSES: AppointmentStatus[] = ["scheduled", "confirmed", "completed", "cancelled", "no_show"];
const isStatus = (s: string | undefined): s is AppointmentStatus => STATUSES.includes(s as AppointmentStatus);

const STATUS_BADGE: Record<AppointmentStatus, { variant: BadgeVariant; label: string }> = {
  scheduled: { variant: "secondary",   label: "Scheduled" },
  confirmed: { variant: "info",        label: "Confirmed" },
  completed: { variant: "success",     label: "Completed" },
  cancelled: { variant: "destructive", label: "Cancelled" },
  no_show:   { variant: "destructive", label: "No-show" },
};

// Quick date ranges; "30d" is the default when no dates are given.
const PRESETS = {
  today: { label: "Today",        from: () => phYmd(),         to: () => phYmd() },
  "7d":  { label: "Next 7 days",  from: () => phYmd(),         to: () => phYmdOffset(6) },
  "30d": { label: "Next 30 days", from: () => phYmd(),         to: () => phYmdOffset(30) },
  past:  { label: "Past 7 days",  from: () => phYmdOffset(-7), to: () => phYmdOffset(-1) },
} as const;
type Preset = keyof typeof PRESETS;

const TZ = "Asia/Manila";
const dayKey = (iso: string) => phYmd(new Date(iso));
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-PH", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
const fmtDay = (ymd: string) =>
  new Date(`${ymd}T12:00:00+08:00`).toLocaleDateString("en-PH", {
    timeZone: TZ, weekday: "short", month: "short", day: "numeric",
  });

type SP = { from?: string; to?: string; status?: string; range?: string };

export default async function SchedulePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const sb = await createClient();
  const activeClinic = await getActiveClinicId(sb);

  // Explicit dates win; otherwise a preset (default: next 30 days).
  const preset: Preset | null = sp.from || sp.to ? null
    : (sp.range && sp.range in PRESETS ? sp.range as Preset : "30d");
  const from = sp.from ?? PRESETS[preset ?? "30d"].from();
  const to = sp.to ?? PRESETS[preset ?? "30d"].to();
  const status = isStatus(sp.status) ? sp.status : null;

  let q = sb.from("appointments")
    .select(`id, scheduled_at, duration_minutes, status, notes, source,
      patient:patients!inner(id, full_name, date_of_birth, sex),
      doctor:doctors!inner(profile:profiles!inner(full_name)),
      clinic:clinics!inner(name)`)
    .gte("scheduled_at", `${from}T00:00:00+08:00`)
    .lte("scheduled_at", `${to}T23:59:59+08:00`)
    .order("scheduled_at");
  if (activeClinic) q = q.eq("clinic_id", activeClinic);
  const { data: all, error } = await q;
  if (error) throw error;

  // Status counts come from the whole range; the table shows the filtered set.
  const counts = Object.fromEntries(STATUSES.map(s => [s, all.filter(a => a.status === s).length]));
  const appts = status ? all.filter(a => a.status === status) : all;

  const days = new Map<string, typeof appts>();
  for (const a of appts) {
    const k = dayKey(a.scheduled_at);
    days.set(k, [...(days.get(k) ?? []), a]);
  }
  const today = phYmd();
  const relDay = (ymd: string) =>
    ymd === today ? "Today" : ymd === phYmdOffset(1) ? "Tomorrow" : ymd === phYmdOffset(-1) ? "Yesterday" : null;

  const booking = await getBookingOptions(sb, activeClinic);

  let clinicName = "All clinics";
  if (activeClinic) {
    const { data: c } = await sb.from("clinics").select("name").eq("id", activeClinic).single();
    clinicName = (c as any)?.name ?? "Clinic";
  }
  const generated = new Date().toLocaleString("en-PH", { timeZone: TZ });

  // Builds a /schedule URL that keeps the current filters except those overridden.
  const href = (over: Partial<SP>) => {
    const p = new URLSearchParams();
    const merged: SP = { ...(preset ? { range: preset } : { from, to }), ...(status ? { status } : {}), ...over };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/schedule?${s}` : "/schedule";
  };
  const filtered = Boolean(sp.from || sp.to || sp.status || (sp.range && sp.range !== "30d"));
  const showClinic = !activeClinic;

  return (
    <>
      <PageHeader icon="calendar" title="Schedule"
        sub={activeClinic ? `${clinicName} · ${fmtDay(from)} – ${fmtDay(to)}` : "All clinics — pick one in the sidebar to scope"}
        actions={<>
          <PrintButton label="Print" />
          <BookDialog label="Book appointment" {...booking} />
        </>} />

      {/* Printed hard-copy header (hidden on screen) */}
      <div className="print-only print-report-head">
        <h1>Appointment schedule</h1>
        <div className="meta">
          Clinic: {clinicName}<br />
          Date range: {from} – {to}<br />
          {status ? <>Status: {STATUS_BADGE[status].label}<br /></> : null}
          Generated: {generated}
        </div>
      </div>

      <div className="filters flex-col items-stretch gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
            {(Object.keys(PRESETS) as Preset[]).map(k => (
              <Button key={k} asChild size="sm" variant={preset === k ? "outline" : "ghost"}
                className={cn(preset === k && "bg-background shadow-xs")}>
                <Link href={href({ range: k, from: undefined, to: undefined })}>{PRESETS[k].label}</Link>
              </Button>
            ))}
          </div>
          <form method="get" className="flex flex-wrap items-center gap-2">
            {status && <input type="hidden" name="status" value={status} />}
            <Input type="date" name="from" defaultValue={from} aria-label="From" className="w-40" />
            <span className="text-sm text-muted-foreground">to</span>
            <Input type="date" name="to" defaultValue={to} aria-label="To" className="w-40" />
            <Button type="submit" variant="outline" size="sm">Apply</Button>
          </form>
          {filtered && (
            <Button asChild variant="link" size="sm" className="ml-auto">
              <Link href="/schedule">Reset</Link>
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5" aria-label="Filter by status">
          <StatusChip href={href({ status: undefined })} active={!status} label="All" count={all.length} />
          {STATUSES.map(s => (
            <StatusChip key={s} href={href({ status: s })} active={status === s}
              label={STATUS_BADGE[s].label} count={counts[s]} />
          ))}
        </div>
      </div>

      {appts.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
          <div className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <CalendarXIcon className="size-5" />
          </div>
          <div>
            <div className="font-medium">No appointments {status ? `marked ${STATUS_BADGE[status].label.toLowerCase()} ` : ""}in this range</div>
            <div className="text-sm text-muted-foreground">{fmtDay(from)} – {fmtDay(to)}</div>
          </div>
          <div className="no-print flex gap-2">
            {filtered && <Button asChild variant="outline"><Link href="/schedule">Reset filters</Link></Button>}
            <BookDialog label="Book appointment" {...booking} />
          </div>
        </div>
      ) : (
        <div className="card table-wrap">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Time</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="no-print w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...days].map(([day, rows]) => (
                <DayGroup key={day} label={relDay(day)} day={fmtDay(day)} count={rows.length}>
                  {rows.map(a => {
                    const badge = STATUS_BADGE[a.status];
                    const meta = [a.patient.sex, ageYearsMonths(a.patient.date_of_birth)].filter(Boolean).join(" · ");
                    const inactive = a.status === "cancelled" || a.status === "no_show";
                    return (
                      <TableRow key={a.id} className={cn(inactive && "text-muted-foreground")}>
                        <TableCell className="align-top">
                          <div className="font-semibold tabular-nums text-foreground">{fmtTime(a.scheduled_at)}</div>
                          <div className="text-xs text-muted-foreground">{a.duration_minutes} min</div>
                        </TableCell>
                        <TableCell className="max-w-[320px] align-top whitespace-normal">
                          <Link href={`/patients/${a.patient.id}`} className="font-medium text-foreground hover:underline">
                            {a.patient.full_name}
                          </Link>
                          {meta && <span className="text-muted-foreground"> · {meta}</span>}
                          {a.notes && <div className="truncate text-xs text-muted-foreground" title={a.notes}>{a.notes}</div>}
                        </TableCell>
                        <TableCell className="align-top">
                          <div>{a.doctor.profile.full_name}</div>
                          {showClinic && <div className="text-xs text-muted-foreground">{a.clinic.name}</div>}
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="flex flex-wrap gap-1.5">
                            <Badge variant={badge.variant}><span className="dot" />{badge.label}</Badge>
                            {a.source === "online" && <Badge variant="info" title="Booked by the patient online">Online</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="no-print text-right align-top">
                          <AppointmentActions id={a.id} status={a.status} patient={a.patient.full_name}
                            when={`${fmtDay(day)}, ${fmtTime(a.scheduled_at)}`} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </DayGroup>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}

function DayGroup({ label, day, count, children }: {
  label: string | null; day: string; count: number; children: React.ReactNode;
}) {
  return (
    <>
      <TableRow className="bg-muted/50 hover:bg-muted/50">
        <TableCell colSpan={5} className="py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label && <span className="text-primary">{label} · </span>}
          {day}
          <span className="font-normal normal-case tracking-normal"> · {count} appointment{count === 1 ? "" : "s"}</span>
        </TableCell>
      </TableRow>
      {children}
    </>
  );
}

function StatusChip({ href, active, label, count }: { href: string; active: boolean; label: string; count: number }) {
  return (
    <Button asChild size="sm" variant={active ? "default" : "outline"} className="h-7 rounded-full px-3">
      <Link href={href} aria-current={active ? "true" : undefined}>
        {label}
        <span className={cn("tabular-nums", active ? "opacity-80" : "text-muted-foreground")}>{count}</span>
      </Link>
    </Button>
  );
}
