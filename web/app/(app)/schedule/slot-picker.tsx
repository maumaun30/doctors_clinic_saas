"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

const TZ = "Asia/Manila";
export const fmtSlotTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-PH", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
export const fmtSlotDay = (ymd: string) =>
  new Date(`${ymd}T12:00:00+08:00`).toLocaleDateString("en-PH", {
    timeZone: TZ, weekday: "short", month: "short", day: "numeric",
  });

// Open times for one doctor at one clinic on a date, as a grid of chips.
// Clears the selection whenever the inputs change; bump `refreshKey` to
// reload (e.g. after a slot was just taken).
export function SlotPicker({
  doctorId, clinicId, date, duration, value, onChange, refreshKey = 0, label = "Time",
  needDoctorHint = "Choose a provider to see open times.",
}: {
  doctorId: string | null;
  clinicId: string | null;
  date: string;
  duration: number;
  value: string;
  onChange: (slot: string) => void;
  refreshKey?: number;
  label?: string;
  needDoctorHint?: string;
}) {
  const sb = useMemo(() => createClient(), []);
  const [slots, setSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    onChange("");
    if (!doctorId || !clinicId || !date) { setSlots([]); return; }
    let live = true;
    setLoading(true);
    setFailed(false);
    sb.rpc("available_slots", {
      p_doctor_id: doctorId,
      p_clinic_id: clinicId,
      p_date_local: date,
      p_duration_minutes: duration,
      p_step_minutes: 15,
    }).then(({ data, error }) => {
      if (!live) return;
      if (error) { setFailed(true); setSlots([]); }
      else setSlots((data ?? []).map((r: any) => r.slot_start));
      setLoading(false);
    });
    return () => { live = false; };
    // onChange is a setter from the parent; leaving it out avoids reloads on re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sb, doctorId, clinicId, date, duration, refreshKey]);

  return (
    <fieldset className="grid gap-2">
      <legend className="mb-2 flex items-center gap-2 text-sm font-medium leading-none">
        {label}
        {loading && <Spinner className="size-3.5 text-muted-foreground" />}
        {doctorId && !loading && slots.length > 0 && (
          <span className="font-normal text-muted-foreground">· {slots.length} open on {fmtSlotDay(date)}</span>
        )}
      </legend>
      {!doctorId ? (
        <Note>{needDoctorHint}</Note>
      ) : loading && slots.length === 0 ? (
        <Note><Spinner className="size-3.5" /> Finding open times…</Note>
      ) : failed ? (
        <Note>Couldn’t load open times. Change the date to try again.</Note>
      ) : slots.length === 0 ? (
        <Note>No open times on {fmtSlotDay(date)}. Try another day or a shorter visit.</Note>
      ) : (
        <div role="radiogroup" aria-label="Open times"
          className={cn("grid max-h-40 grid-cols-4 gap-1.5 overflow-y-auto pr-0.5 sm:grid-cols-5",
            loading && "pointer-events-none opacity-60")}>
          {slots.map(s => (
            <Button key={s} type="button" size="sm" role="radio" aria-checked={value === s}
              variant={value === s ? "default" : "outline"} onClick={() => onChange(s)}
              className="tabular-nums">
              {fmtSlotTime(s)}
            </Button>
          ))}
        </div>
      )}
    </fieldset>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground">
      {children}
    </div>
  );
}
