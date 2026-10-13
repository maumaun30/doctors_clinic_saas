import Link from "next/link";
import { ArrowDownRightIcon, ArrowUpRightIcon, MinusIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/app/_components/page-header";
import { getMyProfile } from "@/lib/data/queries";
import { getActiveClinicId } from "@/lib/data/clinic-context";
import { PrintButton } from "@/app/_components/print-button";
import { StatCard } from "@/app/_components/stat-card";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BusyHeatmap, DailyChart, Legend } from "./charts";
import { SERIES, type DayRow } from "./series";
import { cn } from "@/lib/utils";
import { phYmd, phYmdOffset } from "@/lib/dates";

const TZ = "Asia/Manila";
const DAY = 86_400_000;
const PRESETS = {
  "7d": { label: "Last 7 days", days: 7 },
  "30d": { label: "Last 30 days", days: 30 },
  "90d": { label: "Last 90 days", days: 90 },
  month: { label: "This month", days: 0 },
} as const;
type Preset = keyof typeof PRESETS;

const ymdAdd = (ymd: string, n: number) => new Date(Date.parse(`${ymd}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY) + 1;
const fmtDay = (ymd: string) =>
  new Date(`${ymd}T12:00:00+08:00`).toLocaleDateString("en-PH", { timeZone: TZ, weekday: "short", month: "short", day: "numeric" });
// Manila wall-clock weekday (0=Sun) and hour for a timestamp.
const phParts = (iso: string) => {
  const d = new Date(Date.parse(iso) + 8 * 3_600_000);
  return { dow: d.getUTCDay(), hour: d.getUTCHours() };
};

type SP = { from?: string; to?: string; range?: string; doctor?: string };

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const sb = await createClient();
  const me = await getMyProfile(sb);
  if (!me) throw new Error("not authenticated");
  const activeClinic = await getActiveClinicId(sb);
  const isDoctor = me.role === "doctor";

  // Range: explicit dates win, else a preset (default last 30 days).
  const preset: Preset | null = sp.from || sp.to ? null : (sp.range && sp.range in PRESETS ? sp.range as Preset : "30d");
  const today = phYmd();
  const to = sp.to ?? today;
  const from = sp.from ?? (preset === "month" ? `${today.slice(0, 8)}01` : phYmdOffset(-(PRESETS[preset ?? "30d"].days - 1)));
  const span = Math.max(1, daysBetween(from, to));
  const prevTo = ymdAdd(from, -1);
  const prevFrom = ymdAdd(prevTo, -(span - 1));
  const doctorFilter = isDoctor ? me.id : sp.doctor || null;

  const appts = (a: string, b: string, cols: string) => {
    let q = sb.from("appointments").select(cols)
      .gte("scheduled_at", `${a}T00:00:00+08:00`).lte("scheduled_at", `${b}T23:59:59+08:00`);
    if (activeClinic) q = q.eq("clinic_id", activeClinic);
    if (doctorFilter) q = q.eq("doctor_id", doctorFilter);
    return q;
  };
  const newPatients = async (a: string, b: string) => {
    let q = sb.from("patients")
      .select(`id${activeClinic ? ", patient_clinics!inner(clinic_id)" : ""}`, { count: "exact", head: true })
      .gte("created_at", `${a}T00:00:00+08:00`).lte("created_at", `${b}T23:59:59+08:00`) as any;
    if (activeClinic) q = q.eq("patient_clinics.clinic_id", activeClinic);
    const { count } = await q;
    return count ?? 0;
  };

  let dcq = sb.from("doctor_clinics").select("doctor_id, doctor:doctors!inner(profiles:staff_profiles!inner(full_name))");
  if (activeClinic) dcq = dcq.eq("clinic_id", activeClinic);

  const [cur, prev, newCur, newPrev, { data: dcData }, clinicRes] = await Promise.all([
    appts(from, to, "scheduled_at, duration_minutes, status, patient_id, doctor_id"),
    appts(prevFrom, prevTo, "status, patient_id"),
    newPatients(from, to),
    newPatients(prevFrom, prevTo),
    dcq,
    activeClinic ? sb.from("clinics").select("name").eq("id", activeClinic).single() : Promise.resolve({ data: null }),
  ]);
  if (cur.error) throw cur.error;
  const rows = (cur.data ?? []) as unknown as { scheduled_at: string; duration_minutes: number; status: string; patient_id: string; doctor_id: string }[];
  const prevRows = (prev.data ?? []) as unknown as { status: string; patient_id: string }[];
  const clinicName = (clinicRes.data as { name: string } | null)?.name ?? "All clinics";

  const doctorName = new Map<string, string>();
  for (const dc of (dcData ?? []) as any[]) doctorName.set(dc.doctor_id, dc.doctor?.profiles?.full_name ?? "Doctor");
  const doctorOpts = [...doctorName].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));

  // ---- KPIs (current vs previous period of the same length) ----
  const kpi = (r: { status: string; patient_id: string }[]) => {
    const total = r.length;
    const done = r.filter(x => x.status === "completed").length;
    const noShow = r.filter(x => x.status === "no_show").length;
    const cancelled = r.filter(x => x.status === "cancelled").length;
    // Rates use appointments that have resolved (completed / missed), not future ones.
    const resolved = done + noShow + cancelled;
    return {
      total, done, noShow, cancelled,
      completion: resolved ? Math.round((done / resolved) * 100) : null,
      noShowRate: resolved ? Math.round((noShow / resolved) * 100) : null,
      patients: new Set(r.map(x => x.patient_id)).size,
    };
  };
  const k = kpi(rows);
  const kp = kpi(prevRows);
  const careHours = rows.filter(r => r.status === "completed").reduce((s, r) => s + (r.duration_minutes || 0), 0) / 60;

  // ---- per-day series ----
  const byDay = new Map<string, DayRow>();
  for (let i = 0; i < span; i++) {
    const d = ymdAdd(from, i);
    byDay.set(d, { date: d, label: fmtDay(d), done: 0, upcoming: 0, missed: 0 });
  }
  for (const r of rows) {
    const day = byDay.get(phYmd(new Date(r.scheduled_at)));
    if (!day) continue;
    if (r.status === "completed") day.done++;
    else if (r.status === "scheduled" || r.status === "confirmed") day.upcoming++;
    else day.missed++;
  }
  const days = [...byDay.values()];
  const totals = { done: k.done, upcoming: k.total - k.done - k.noShow - k.cancelled, missed: k.noShow + k.cancelled };

  // ---- busiest times (Mon–Sat, 7am–7pm; Sunday shown only if used) ----
  const usedSunday = rows.some(r => phParts(r.scheduled_at).dow === 0);
  const dows = usedSunday ? [1, 2, 3, 4, 5, 6, 0] : [1, 2, 3, 4, 5, 6];
  const dowLabel = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const allHours = rows.map(r => phParts(r.scheduled_at).hour);
  const hStart = Math.min(7, ...allHours);
  const hEnd = Math.max(18, ...allHours);
  const hours = Array.from({ length: hEnd - hStart + 1 }, (_, i) => hStart + i);
  const cells = dows.map(() => hours.map(() => 0));
  for (const r of rows) {
    const { dow, hour } = phParts(r.scheduled_at);
    const di = dows.indexOf(dow);
    if (di >= 0) cells[di][hour - hStart]++;
  }

  // ---- providers ----
  const byDoctor = new Map<string, { total: number; done: number; noShow: number; resolved: number }>();
  for (const r of rows) {
    const m = byDoctor.get(r.doctor_id) ?? { total: 0, done: 0, noShow: 0, resolved: 0 };
    m.total++;
    if (r.status === "completed") { m.done++; m.resolved++; }
    if (r.status === "no_show") { m.noShow++; m.resolved++; }
    if (r.status === "cancelled") m.resolved++;
    byDoctor.set(r.doctor_id, m);
  }
  const providerRows = [...byDoctor].map(([id, m]) => ({ id, name: doctorName.get(id) ?? "Doctor", ...m }))
    .sort((a, b) => b.total - a.total);
  const maxProvider = Math.max(1, ...providerRows.map(p => p.total));

  const rangeLabel = `${fmtDay(from)} – ${fmtDay(to)}`;
  const compareLabel = `vs ${fmtDay(prevFrom)} – ${fmtDay(prevTo)}`;
  const generated = new Date().toLocaleString("en-PH", { timeZone: TZ });
  const href = (over: Partial<SP>) => {
    const p = new URLSearchParams();
    const merged: SP = { ...(sp.doctor && !isDoctor ? { doctor: sp.doctor } : {}), ...over };
    for (const [key, v] of Object.entries(merged)) if (v) p.set(key, v);
    const s = p.toString();
    return s ? `/analytics?${s}` : "/analytics";
  };

  return (
    <>
      <PageHeader icon="chart" title="Analytics"
        sub={`${clinicName} · ${rangeLabel}${isDoctor ? ` · ${me.full_name}` : sp.doctor ? ` · ${doctorName.get(sp.doctor) ?? "Provider"}` : ""}`}
        actions={<PrintButton label="Print report" />} />

      <div className="print-only print-report-head">
        <h1>Analytics report</h1>
        <div className="meta">
          Clinic: {clinicName}<br />
          Date range: {from} – {to}<br />
          {isDoctor ? <>Provider: {me.full_name}<br /></> : sp.doctor ? <>Provider: {doctorName.get(sp.doctor)}<br /></> : null}
          Generated: {generated}
        </div>
      </div>

      <div className="filters flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
          {(Object.keys(PRESETS) as Preset[]).map(p => (
            <Button key={p} asChild size="sm" variant={preset === p ? "outline" : "ghost"}
              className={cn(preset === p && "bg-background shadow-xs")}>
              <Link href={href({ range: p })}>{PRESETS[p].label}</Link>
            </Button>
          ))}
        </div>
        <form method="get" className="flex flex-wrap items-center gap-2">
          <Input type="date" name="from" defaultValue={from} max={today} aria-label="From" className="w-40" />
          <span className="text-sm text-muted-foreground">to</span>
          <Input type="date" name="to" defaultValue={to} max={today} aria-label="To" className="w-40" />
          {!isDoctor && (
            <NativeSelect name="doctor" defaultValue={sp.doctor ?? ""} aria-label="Provider" className="w-44">
              <NativeSelectOption value="">All providers</NativeSelectOption>
              {doctorOpts.map(d => <NativeSelectOption key={d.id} value={d.id}>{d.name}</NativeSelectOption>)}
            </NativeSelect>
          )}
          <Button type="submit" variant="outline" size="sm">Apply</Button>
        </form>
      </div>

      <div className="stats">
        <StatCard label="Appointments" footer={<Delta cur={k.total} prev={kp.total} label={compareLabel} />}>{k.total}</StatCard>
        <StatCard label="Completion rate" footer={<Delta cur={k.completion} prev={kp.completion} unit="pts" label={compareLabel} />}>
          {k.completion ?? "—"}{k.completion != null && <small>%</small>}
        </StatCard>
        <StatCard label="No-show rate" footer={<Delta cur={k.noShowRate} prev={kp.noShowRate} unit="pts" lowerIsBetter label={compareLabel} />}>
          {k.noShowRate ?? "—"}{k.noShowRate != null && <small>%</small>}
        </StatCard>
        <StatCard label="Patients seen" footer={<Delta cur={k.patients} prev={kp.patients} label={compareLabel} />}>{k.patients}</StatCard>
        <StatCard label="New patients" footer={<Delta cur={newCur} prev={newPrev} label={compareLabel} />}>{newCur}</StatCard>
        <StatCard label="Care hours" footer="Completed visits only">{careHours.toFixed(1)}<small>h</small></StatCard>
        <StatCard label="No-shows" footer={<Delta cur={k.noShow} prev={kp.noShow} lowerIsBetter label={compareLabel} />}>{k.noShow}</StatCard>
        <StatCard label="Cancellations" footer={<Delta cur={k.cancelled} prev={kp.cancelled} lowerIsBetter label={compareLabel} />}>{k.cancelled}</StatCard>
      </div>

      {k.total === 0 ? (
        <div className="card px-6 py-12 text-center text-sm text-muted-foreground">
          No appointments in this range. Try a longer period{sp.doctor ? " or all providers" : ""}.
        </div>
      ) : (
        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Appointments per day</CardTitle>
              <CardDescription>Missed = cancelled + no-show. Hover or focus a bar for the breakdown.</CardDescription>
            </CardHeader>
            <CardContent><DailyChart days={days} /></CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Status mix</CardTitle>
                <CardDescription>{k.total} appointments in range.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full" role="img"
                  aria-label={SERIES.map(s => `${s.label} ${totals[s.key]}`).join(", ")}>
                  {SERIES.map(s => totals[s.key] > 0 && (
                    <span key={s.key} style={{ flex: totals[s.key], background: s.color }} />
                  ))}
                </div>
                <Legend totals={totals} />
                <Table>
                  <TableBody>
                    {[
                      ["Completed", k.done], ["Scheduled / confirmed", totals.upcoming],
                      ["No-show", k.noShow], ["Cancelled", k.cancelled],
                    ].map(([label, n]) => (
                      <TableRow key={label as string}>
                        <TableCell>{label}</TableCell>
                        <TableCell className="text-right tabular-nums">{n}</TableCell>
                        <TableCell className="w-16 text-right tabular-nums text-muted-foreground">
                          {Math.round(((n as number) / k.total) * 100)}%
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Busiest times</CardTitle>
                <CardDescription>All appointments by weekday and start hour (Manila time).</CardDescription>
              </CardHeader>
              <CardContent>
                <BusyHeatmap cells={cells} hours={hours} days={dows.map(d => dowLabel[d])} />
              </CardContent>
            </Card>
          </div>

          {!isDoctor && providerRows.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>By provider</CardTitle>
                <CardDescription>Completion and no-show rates count resolved appointments only.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Provider</TableHead>
                      <TableHead className="w-2/5">Appointments</TableHead>
                      <TableHead className="text-right">Completion</TableHead>
                      <TableHead className="text-right">No-show</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {providerRows.map(p => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">
                          <Link href={href({ ...(preset ? { range: preset } : { from, to }), doctor: p.id })} className="hover:underline">{p.name}</Link>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-2 flex-1 rounded-full bg-muted">
                              <div className="h-2 rounded-full" style={{ width: `${(p.total / maxProvider) * 100}%`, background: "var(--chart-upcoming)" }} />
                            </div>
                            <span className="w-8 text-right tabular-nums">{p.total}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{p.resolved ? `${Math.round((p.done / p.resolved) * 100)}%` : "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{p.resolved ? `${Math.round((p.noShow / p.resolved) * 100)}%` : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </>
  );
}

// "↑ 12% vs previous period" (or points for rates). Text stays in text
// tokens; only the arrow carries good/bad color.
function Delta({ cur, prev, unit = "%", lowerIsBetter = false, label }: {
  cur: number | null; prev: number | null; unit?: "%" | "pts"; lowerIsBetter?: boolean; label: string;
}) {
  if (cur == null || prev == null) return <span title={label}>No earlier data</span>;
  const diff = unit === "pts" ? cur - prev : prev === 0 ? null : Math.round(((cur - prev) / prev) * 100);
  if (diff === null) return <span title={label}>{cur > 0 ? "None in previous period" : "No change"}</span>;
  if (diff === 0) return <span className="inline-flex items-center gap-1" title={label}><MinusIcon className="size-3" /> No change</span>;
  const good = lowerIsBetter ? diff < 0 : diff > 0;
  const Arrow = diff > 0 ? ArrowUpRightIcon : ArrowDownRightIcon;
  return (
    <span className="inline-flex items-center gap-1" title={label}>
      <Arrow className={cn("size-3.5", good ? "text-(--success)" : "text-(--danger)")} aria-hidden />
      <span className="tabular-nums text-foreground">{diff > 0 ? "+" : ""}{diff}{unit === "pts" ? " pts" : "%"}</span>
      <span>vs previous</span>
      <span className="sr-only">{good ? "(better)" : "(worse)"}</span>
    </span>
  );
}
