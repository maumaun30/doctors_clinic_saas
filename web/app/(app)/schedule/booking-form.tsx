"use client";

import { useCallback, useEffect, useId, useMemo, useState, useTransition } from "react";
import { AlertCircleIcon, CalendarCheckIcon, ClockIcon } from "lucide-react";
import { bookAppointment } from "@/lib/actions/appointments";
import { createClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { phYmd } from "@/lib/dates";

type Option = { id: string; label: string };
type DoctorClinic = { doctor_id: string; clinic_id: string; label: string };

const TZ = "Asia/Manila";
const DURATIONS = [15, 20, 30, 45, 60, 90];

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-PH", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
const fmtDay = (ymd: string) =>
  new Date(`${ymd}T12:00:00+08:00`).toLocaleDateString("en-PH", {
    timeZone: TZ, weekday: "short", month: "short", day: "numeric",
  });

export default function BookingForm({
  patients, doctorClinics, onBooked, onCancel, bare = false,
}: {
  patients: Option[];
  doctorClinics: DoctorClinic[];
  /** Called after a successful booking instead of showing a note inline. */
  onBooked?: () => void;
  /** Shows a Cancel button (e.g. to close the surrounding dialog). */
  onCancel?: () => void;
  /** Render without the card frame, with a dialog-style footer. */
  bare?: boolean;
}) {
  const sb = useMemo(() => createClient(), []);
  const id = useId();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [booked, setBooked] = useState(false);

  const [patientId, setPatientId] = useState("");
  const [dcIdx, setDcIdx] = useState("");
  const [date, setDate] = useState(() => phYmd());
  const [duration, setDuration] = useState(30);
  const [slot, setSlot] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [notes, setNotes] = useState("");

  const dc = dcIdx === "" ? null : doctorClinics[Number(dcIdx)];

  const loadSlots = useCallback(() => {
    setSlot("");
    if (!dc || !date) { setSlots([]); return; }
    setLoadingSlots(true);
    sb.rpc("available_slots", {
      p_doctor_id: dc.doctor_id,
      p_clinic_id: dc.clinic_id,
      p_date_local: date,
      p_duration_minutes: duration,
      p_step_minutes: 15,
    }).then(({ data, error }) => {
      if (error) { setError("Couldn’t load open times. Please try again."); setSlots([]); }
      else setSlots((data ?? []).map((r: any) => r.slot_start));
      setLoadingSlots(false);
    });
  }, [sb, dc, date, duration]);

  useEffect(loadSlots, [loadSlots]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBooked(false);
    if (!dc || !slot) { setError("Pick a time first."); return; }
    start(async () => {
      const res = await bookAppointment({
        patient_id: patientId,
        doctor_id: dc.doctor_id,
        clinic_id: dc.clinic_id,
        scheduled_at: slot,
        duration_minutes: duration,
        notes: notes.trim() || undefined,
      });
      if (!res.ok) {
        setError(res.error);
        if (res.slotTaken) loadSlots();
        return;
      }
      setPatientId(""); setSlot(""); setNotes("");
      if (onBooked) onBooked();
      else { setBooked(true); loadSlots(); }
    });
  };

  const patientName = patients.find(p => p.id === patientId)?.label;

  return (
    <form
      onSubmit={submit}
      className={cn("grid gap-4", !bare && "card max-w-[560px] p-6")}
      aria-busy={pending}
    >
      <div className="grid gap-2">
        <Label htmlFor={`${id}-patient`}>Patient</Label>
        <NativeSelect id={`${id}-patient`} value={patientId} onChange={e => setPatientId(e.target.value)}
          required className="w-full">
          <NativeSelectOption value="" disabled>Select a patient</NativeSelectOption>
          {patients.map(p => <NativeSelectOption key={p.id} value={p.id}>{p.label}</NativeSelectOption>)}
        </NativeSelect>
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`${id}-provider`}>Provider</Label>
        <NativeSelect id={`${id}-provider`} value={dcIdx} onChange={e => setDcIdx(e.target.value)}
          required className="w-full">
          <NativeSelectOption value="" disabled>Select a provider</NativeSelectOption>
          {doctorClinics.map((d, i) => <NativeSelectOption key={i} value={i}>{d.label}</NativeSelectOption>)}
        </NativeSelect>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label htmlFor={`${id}-date`}>Date</Label>
          <Input id={`${id}-date`} type="date" value={date} min={phYmd()}
            onChange={e => setDate(e.target.value)} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${id}-duration`}>Duration</Label>
          <NativeSelect id={`${id}-duration`} value={duration} onChange={e => setDuration(Number(e.target.value))}
            className="w-full">
            {DURATIONS.map(m => <NativeSelectOption key={m} value={m}>{m} min</NativeSelectOption>)}
          </NativeSelect>
        </div>
      </div>

      <fieldset className="grid gap-2">
        <legend className="mb-2 flex items-center gap-2 text-sm font-medium leading-none">
          Time
          {loadingSlots && <Spinner className="size-3.5 text-muted-foreground" />}
          {dc && !loadingSlots && slots.length > 0 && (
            <span className="font-normal text-muted-foreground">· {slots.length} open on {fmtDay(date)}</span>
          )}
        </legend>
        {!dc ? (
          <SlotNote>Choose a provider to see open times.</SlotNote>
        ) : loadingSlots && slots.length === 0 ? (
          <SlotNote><Spinner className="size-3.5" /> Finding open times…</SlotNote>
        ) : slots.length === 0 ? (
          <SlotNote>No open times on {fmtDay(date)}. Try another day or a shorter visit.</SlotNote>
        ) : (
          <div role="radiogroup" aria-label="Open times"
            className={cn("grid max-h-40 grid-cols-4 gap-1.5 overflow-y-auto pr-0.5 sm:grid-cols-5",
              loadingSlots && "pointer-events-none opacity-60")}>
            {slots.map(s => (
              <Button key={s} type="button" size="sm" role="radio" aria-checked={slot === s}
                variant={slot === s ? "default" : "outline"} onClick={() => setSlot(s)}
                className="tabular-nums">
                {fmtTime(s)}
              </Button>
            ))}
          </div>
        )}
      </fieldset>

      <div className="grid gap-2">
        <Label htmlFor={`${id}-notes`}>
          Reason for visit <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea id={`${id}-notes`} value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="e.g. Blood pressure follow-up, fever for 3 days" rows={2} maxLength={2000} />
      </div>

      {slot && dc && (
        <div className="flex items-start gap-2.5 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 text-sm">
          <ClockIcon className="mt-0.5 size-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <div className="font-medium text-primary">
              {fmtDay(date)} · {fmtTime(slot)} · {duration} min
            </div>
            <div className="truncate text-muted-foreground">
              {patientName ?? "No patient selected"} with {dc.label}
            </div>
          </div>
        </div>
      )}

      {error && (
        <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
          <AlertCircleIcon />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {booked && (
        <Alert className="border-(--success)/30 bg-(--success-subtle) text-(--success)">
          <CalendarCheckIcon />
          <AlertDescription className="text-(--success)">Appointment booked.</AlertDescription>
        </Alert>
      )}

      <div className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        bare && "-mx-4 -mb-4 mt-2 rounded-b-xl border-t bg-muted/50 p-4")}>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>Cancel</Button>
        )}
        <Button type="submit" disabled={pending || !slot || !patientId}>
          {pending ? <><Spinner /> Booking…</> : "Book appointment"}
        </Button>
      </div>
    </form>
  );
}

function SlotNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground">
      {children}
    </div>
  );
}
