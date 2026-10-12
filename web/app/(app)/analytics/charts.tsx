"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

import { SERIES, type DayRow, type SeriesKey as Key } from "./series";

export function Legend({ totals }: { totals?: Record<Key, number> }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-hidden={!totals}>
      {SERIES.map(s => (
        <span key={s.key} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: s.color }} />
          {s.label}{totals && <span className="tabular-nums text-foreground">{totals[s.key]}</span>}
        </span>
      ))}
    </div>
  );
}

// Stacked bars per day, with a hover/focus tooltip. Thin bars, rounded
// data-end, 2px surface gap between segments, one recessive gridline.
export function DailyChart({ days }: { days: DayRow[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...days.map(d => d.done + d.upcoming + d.missed));
  const top = Math.ceil(max / 2) * 2; // even ceiling for the midline label
  const H = 160;
  const h = days[hover ?? -1];
  const labelEvery = Math.ceil(days.length / 8);

  return (
    <div className="grid gap-3">
      <Legend />
      <div className="relative">
        {/* gridlines */}
        <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed" style={{ height: H }}>
          <span className="absolute -top-2 right-0 bg-card pl-1 text-[10px] text-muted-foreground tabular-nums">{top}</span>
          <div className="absolute inset-x-0 border-t border-dashed" style={{ top: H / 2 }}>
            <span className="absolute -top-2 right-0 bg-card pl-1 text-[10px] text-muted-foreground tabular-nums">{top / 2}</span>
          </div>
        </div>
        <div className="relative flex items-end gap-[2px] border-b pr-6" style={{ height: H }} onMouseLeave={() => setHover(null)}>
          {days.map((d, i) => {
            const total = d.done + d.upcoming + d.missed;
            return (
              <button key={d.date} type="button"
                className="group relative flex h-full min-w-0 flex-1 flex-col-reverse items-stretch outline-none"
                onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}
                aria-label={`${d.label}: ${total} appointments — ${d.done} completed, ${d.upcoming} upcoming, ${d.missed} missed`}>
                {SERIES.map((s, si) => {
                  const v = d[s.key];
                  if (!v) return null;
                  const isTop = SERIES.slice(si + 1).every(t => !d[t.key]);
                  return (
                    <span key={s.key}
                      className={cn("block w-full max-w-6 self-center border-t-2 border-card", isTop && "rounded-t-[4px]",
                        hover !== null && hover !== i && "opacity-50")}
                      style={{ height: (v / top) * H, background: s.color }} />
                  );
                })}
                {total === 0 && <span className="block h-px w-full max-w-6 self-center bg-border" />}
                <span className="absolute inset-0 group-focus-visible:ring-2 group-focus-visible:ring-ring/50" />
              </button>
            );
          })}
        </div>
        {/* x labels */}
        <div className="flex gap-[2px] pr-6 pt-1">
          {days.map((d, i) => (
            <span key={d.date} className="min-w-0 flex-1 overflow-visible text-center text-[10px] whitespace-nowrap text-muted-foreground">
              {i % labelEvery === 0 ? d.label.replace(/^\w+, /, "") : ""}
            </span>
          ))}
        </div>
        {h && (
          <div role="status"
            className="pointer-events-none absolute z-10 min-w-40 -translate-x-1/2 rounded-lg border bg-popover px-3 py-2 text-xs shadow-md"
            style={{ left: `${((hover! + 0.5) / days.length) * 100}%`, top: -8 }}>
            <div className="mb-1 font-medium text-foreground">{h.label}</div>
            {[...SERIES].reverse().map(s => (
              <div key={s.key} className="flex items-center justify-between gap-4">
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <span className="size-2 rounded-sm" style={{ background: s.color }} />{s.label}
                </span>
                <span className="tabular-nums text-foreground">{h[s.key]}</span>
              </div>
            ))}
            <div className="mt-1 flex justify-between border-t pt-1 font-medium">
              <span>Total</span><span className="tabular-nums">{h.done + h.upcoming + h.missed}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Weekday × hour grid of appointment counts (single-hue sequential scale).
export function BusyHeatmap({ cells, hours, days }: {
  cells: number[][]; hours: number[]; days: string[];
}) {
  const [hover, setHover] = useState<{ d: number; h: number } | null>(null);
  const max = Math.max(1, ...cells.flat());
  const fmtH = (h: number) => `${((h + 11) % 12) + 1}${h < 12 ? "a" : "p"}`;
  const shade = (v: number) =>
    v === 0 ? "var(--muted)" : `color-mix(in oklab, var(--chart-upcoming) ${20 + Math.round((v / max) * 80)}%, var(--card))`;

  return (
    <div className="grid gap-2">
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-[2px] text-[10px]" onMouseLeave={() => setHover(null)}>
          <thead>
            <tr>
              <th className="w-10" />
              {hours.map(h => <th key={h} className="font-normal text-muted-foreground">{fmtH(h)}</th>)}
            </tr>
          </thead>
          <tbody>
            {days.map((day, d) => (
              <tr key={day}>
                <th className="pr-1 text-left font-normal text-muted-foreground">{day}</th>
                {hours.map((h, hi) => {
                  const v = cells[d][hi];
                  return (
                    <td key={h} tabIndex={v ? 0 : -1}
                      onMouseEnter={() => setHover({ d, h })} onFocus={() => setHover({ d, h })}
                      aria-label={`${day} ${fmtH(h)}: ${v} appointment${v === 1 ? "" : "s"}`}
                      className="h-6 min-w-6 rounded-[4px] outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                      style={{ background: shade(v) }} />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span role="status" className="text-foreground">
          {hover
            ? <>{days[hover.d]} {fmtH(hover.h)}–{fmtH(hover.h + 1)}: <span className="font-medium tabular-nums">{cells[hover.d][hours.indexOf(hover.h)]}</span> appointments</>
            : "Hover a cell for the count"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          Fewer
          {[0.2, 0.47, 0.73, 1].map(f => (
            <span key={f} className="size-3 rounded-[3px]"
              style={{ background: `color-mix(in oklab, var(--chart-upcoming) ${Math.round(f * 100)}%, var(--card))` }} />
          ))}
          More
        </span>
      </div>
    </div>
  );
}
