import { XIcon } from "lucide-react";
import { ConfirmAction } from "@/app/_components/confirm-action";
import { removeAvailability } from "@/lib/actions/availability";

// Mon-first display order; values are Postgres weekdays (0 = Sunday).
const WEEK = [1, 2, 3, 4, 5, 6, 0];
export const DAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
// "9 AM", "1:30 PM" (minutes only when not on the hour).
export const fmtTime = (t: string) => {
  const h = Number(t.slice(0, 2)), m = t.slice(3, 5);
  return `${((h + 11) % 12) + 1}${m === "00" ? "" : `:${m}`} ${h < 12 ? "AM" : "PM"}`;
};
export const weeklyHours = (wins: Win[]) => wins.reduce((s, w) => s + mins(w.end_time) - mins(w.start_time), 0) / 60;

export type Win = { id: string; weekday: number; start_time: string; end_time: string };

/**
 * One doctor's week at one clinic: a row per day with a timeline bar and
 * time chips. `editable` adds remove buttons (admins only).
 */
export function WeekView({ wins, label, editable = false }: { wins: Win[]; label: string; editable?: boolean }) {
  // Timeline span: 7am–7pm, widened to fit any window outside it.
  const tlStart = Math.min(7 * 60, ...wins.map(w => mins(w.start_time)));
  const tlEnd = Math.max(19 * 60, ...wins.map(w => mins(w.end_time)));
  const pct = (m: number) => ((m - tlStart) / (tlEnd - tlStart)) * 100;
  const ticks = Array.from({ length: Math.floor(tlEnd / 60) - Math.ceil(tlStart / 60) + 1 }, (_, i) => Math.ceil(tlStart / 60) + i)
    .filter(h => h % 3 === 0);

  return (
    <div className="grid gap-1">
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
        const day = wins.filter(w => w.weekday === d).sort((a, b) => a.start_time.localeCompare(b.start_time));
        return (
          <div key={d} className="grid grid-cols-[6rem_1fr] items-center gap-3 border-t py-2 md:grid-cols-[6rem_1fr_minmax(0,21rem)]">
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
                <span key={w.id} className={`inline-flex h-7 items-center gap-1 rounded-full border bg-background text-sm tabular-nums ${editable ? "pr-1 pl-3" : "px-3"}`}>
                  {fmtTime(w.start_time)} – {fmtTime(w.end_time)}
                  {editable && (
                    <ConfirmAction action={removeAvailability} fields={{ id: w.id }} label={<XIcon />}
                      size="icon-xs" className="rounded-full" triggerTitle="Remove these hours"
                      title={`Remove ${DAY[d]} ${fmtTime(w.start_time)} – ${fmtTime(w.end_time)}?`}
                      description={<>{label}. Booked appointments are kept, but no new slots open in this window.</>}
                      confirmLabel="Remove" success="Hours removed"
                      error="Couldn’t remove these hours. Please try again." />
                  )}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
