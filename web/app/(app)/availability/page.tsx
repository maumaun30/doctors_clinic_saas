import { CalendarOffIcon, XIcon } from "lucide-react";
import { PageHeader } from "@/app/_components/page-header";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/data/queries";
import { getActiveClinicId } from "@/lib/data/clinic-context";
import { ConfirmAction } from "@/app/_components/confirm-action";
import { removeAvailability } from "@/lib/actions/availability";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AddHoursDialog, type Pair } from "./add-hours-dialog";

// Mon-first display order; values are Postgres weekdays (0 = Sunday).
const WEEK = [1, 2, 3, 4, 5, 6, 0];
const DAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const fmt = (t: string) => {
  const h = Number(t.slice(0, 2)), m = t.slice(3, 5);
  return `${((h + 11) % 12) + 1}:${m} ${h < 12 ? "AM" : "PM"}`;
};

type Win = { id: string; doctor_id: string; clinic_id: string; weekday: number; start_time: string; end_time: string };

export default async function AvailabilityPage() {
  const sb = await createClient();
  const me = await getMyProfile(sb);
  if (!me) throw new Error("not authenticated");

  const isAdmin = me.role === "admin";
  const isDoctor = me.role === "doctor";
  if (!isAdmin && !isDoctor) {
    return (
      <>
        <PageHeader icon="clock" title="Availability" />
        <div className="card empty">Only doctors and admins manage availability.</div>
      </>
    );
  }

  const activeClinic = await getActiveClinicId(sb);
  let dcQuery = sb.from("doctor_clinics")
    .select("doctor_id, clinic_id, doctor:doctors!inner(profiles!inner(full_name)), clinic:clinics!inner(name)");
  if (isDoctor) dcQuery = dcQuery.eq("doctor_id", me.id);
  if (activeClinic) dcQuery = dcQuery.eq("clinic_id", activeClinic);
  const { data: dcs, error: dcErr } = await dcQuery;
  if (dcErr) throw dcErr;

  const pairs: Pair[] = ((dcs ?? []) as any[])
    .map(dc => ({
      doctor_id: dc.doctor_id as string,
      clinic_id: dc.clinic_id as string,
      label: activeClinic ? dc.doctor.profiles.full_name : `${dc.doctor.profiles.full_name} @ ${dc.clinic.name}`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  // Only the windows for the pairs shown (previously every clinic's rows leaked in).
  const doctorIds = [...new Set(pairs.map(p => p.doctor_id))];
  let wins: Win[] = [];
  if (doctorIds.length) {
    let aq = sb.from("doctor_availability").select("id, doctor_id, clinic_id, weekday, start_time, end_time")
      .in("doctor_id", doctorIds).order("start_time");
    if (activeClinic) aq = aq.eq("clinic_id", activeClinic);
    const { data, error } = await aq;
    if (error) throw error;
    wins = data ?? [];
  }

  // Timeline span: 7am–7pm, widened to fit any window outside it.
  const tlStart = Math.min(7 * 60, ...wins.map(w => mins(w.start_time)));
  const tlEnd = Math.max(19 * 60, ...wins.map(w => mins(w.end_time)));
  const pct = (m: number) => ((m - tlStart) / (tlEnd - tlStart)) * 100;
  const ticks = Array.from({ length: Math.floor(tlEnd / 60) - Math.ceil(tlStart / 60) + 1 }, (_, i) => Math.ceil(tlStart / 60) + i)
    .filter(h => h % 3 === 0);

  return (
    <>
      <PageHeader icon="clock" title="Availability"
        sub="Weekly working hours · times are clinic-local (Asia/Manila)"
        actions={pairs.length > 0 && <AddHoursDialog pairs={pairs} defaultPair={pairs.length === 1 ? pairs[0] : undefined} />} />

      {pairs.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
          <div className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <CalendarOffIcon className="size-5" />
          </div>
          <div className="text-sm text-muted-foreground">
            {isDoctor ? "You aren’t linked to this clinic yet. Ask an admin to add you under Admin → Assignments."
              : "No doctors at this clinic yet — pair them under Admin → Assignments."}
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {pairs.map(p => {
            const mine = wins.filter(w => w.doctor_id === p.doctor_id && w.clinic_id === p.clinic_id);
            const weekly = mine.reduce((s, w) => s + mins(w.end_time) - mins(w.start_time), 0) / 60;
            const workDays = new Set(mine.map(w => w.weekday)).size;
            return (
              <Card key={`${p.doctor_id}|${p.clinic_id}`}>
                <CardHeader>
                  <CardTitle>{p.label}</CardTitle>
                  <CardDescription>
                    {mine.length ? `${weekly % 1 ? weekly.toFixed(1) : weekly} h/week across ${workDays} day${workDays === 1 ? "" : "s"}`
                      : "No hours set — this doctor can’t be booked yet."}
                  </CardDescription>
                  <CardAction><AddHoursDialog pairs={pairs} defaultPair={p} compact /></CardAction>
                </CardHeader>
                <CardContent className="grid gap-1">
                  {/* hour ticks for the timeline column */}
                  <div className="hidden grid-cols-[6rem_1fr_minmax(0,21rem)] gap-3 md:grid">
                    <span />
                    <div className="relative h-4 text-[10px] text-muted-foreground">
                      {ticks.map(h => (
                        <span key={h} className="absolute -translate-x-1/2" style={{ left: `${pct(h * 60)}%` }}>
                          {((h + 11) % 12) + 1}{h < 12 ? "a" : "p"}
                        </span>
                      ))}
                    </div>
                    <span />
                  </div>
                  {WEEK.map(d => {
                    const day = mine.filter(w => w.weekday === d);
                    return (
                      <div key={d} className="grid grid-cols-[6rem_1fr] items-center gap-3 border-t py-2 first-of-type:border-t-0 md:grid-cols-[6rem_1fr_minmax(0,21rem)]">
                        <span className={day.length ? "text-sm font-medium" : "text-sm text-muted-foreground"}>{DAY[d]}</span>
                        <div className="relative hidden h-5 rounded-md bg-muted md:block" aria-hidden>
                          {ticks.map(h => (
                            <span key={h} className="absolute inset-y-0 w-px bg-border" style={{ left: `${pct(h * 60)}%` }} />
                          ))}
                          {day.map(w => (
                            <span key={w.id} className="absolute inset-y-0.5 rounded-[4px] bg-primary/80"
                              style={{ left: `${pct(mins(w.start_time))}%`, width: `${pct(mins(w.end_time)) - pct(mins(w.start_time))}%` }} />
                          ))}
                        </div>
                        <div className="col-start-2 flex flex-wrap items-center gap-1.5 md:col-start-auto">
                          {day.length === 0 && <span className="text-sm text-muted-foreground">Off</span>}
                          {day.map(w => (
                            <span key={w.id} className="inline-flex h-7 items-center gap-1 rounded-full border bg-background pr-1 pl-3 text-sm tabular-nums">
                              {fmt(w.start_time)} – {fmt(w.end_time)}
                              <ConfirmAction action={removeAvailability} fields={{ id: w.id }} label={<XIcon />}
                                size="icon-xs" className="rounded-full" triggerTitle="Remove these hours"
                                title={`Remove ${DAY[d]} ${fmt(w.start_time)} – ${fmt(w.end_time)}?`}
                                description={<>{p.label}. Booked appointments are kept, but no new slots open in this window.</>}
                                confirmLabel="Remove" success="Hours removed"
                                error="Couldn’t remove these hours. Please try again." />
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
