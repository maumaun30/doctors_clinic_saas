"use client";

import { useId, useState, useTransition } from "react";
import { AlertCircleIcon, CalendarCheckIcon, ClockIcon } from "lucide-react";
import { bookAppointment } from "@/lib/actions/appointments";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { SlotPicker, fmtSlotDay as fmtDay, fmtSlotTime as fmtTime } from "./slot-picker";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { phYmd } from "@/lib/dates";

type Option = { id: string; label: string };
type DoctorClinic = { doctor_id: string; clinic_id: string; label: string };

const DURATIONS = [15, 20, 30, 45, 60, 90];


export default function BookingForm({
  patients, doctorClinics, defaultPatientId = "", onBooked, onCancel, bare = false,
}: {
  patients: Option[];
  /** Preselect a patient (e.g. booking from their chart). */
  defaultPatientId?: string;
  doctorClinics: DoctorClinic[];
  /** Called after a successful booking instead of showing a note inline. */
  onBooked?: () => void;
  /** Shows a Cancel button (e.g. to close the surrounding dialog). */
  onCancel?: () => void;
  /** Render without the card frame, with a dialog-style footer. */
  bare?: boolean;
}) {
  const id = useId();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [booked, setBooked] = useState(false);

  const [patientId, setPatientId] = useState(defaultPatientId);
  const [dcIdx, setDcIdx] = useState("");
  const [date, setDate] = useState(() => phYmd());
  const [duration, setDuration] = useState(30);
  const [slot, setSlot] = useState("");
  const [slotsKey, setSlotsKey] = useState(0);
  const [notes, setNotes] = useState("");

  const dc = dcIdx === "" ? null : doctorClinics[Number(dcIdx)];

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
        if (res.slotTaken) setSlotsKey(k => k + 1);
        return;
      }
      setPatientId(defaultPatientId); setSlot(""); setNotes("");
      if (onBooked) onBooked();
      else { setBooked(true); setSlotsKey(k => k + 1); }
    });
  };

  const patientName = patients.find(p => p.id === patientId)?.label;

  return (
    <form
      onSubmit={submit}
      className={cn("grid gap-4", !bare && "card max-w-[560px] p-6")}
      aria-busy={pending}
    >
      <div className="grid content-start gap-2">
        <Label htmlFor={`${id}-patient`}>Patient</Label>
        <NativeSelect id={`${id}-patient`} value={patientId} onChange={e => setPatientId(e.target.value)}
          required className="w-full">
          <NativeSelectOption value="" disabled>Select a patient</NativeSelectOption>
          {patients.map(p => <NativeSelectOption key={p.id} value={p.id}>{p.label}</NativeSelectOption>)}
        </NativeSelect>
      </div>

      <div className="grid content-start gap-2">
        <Label htmlFor={`${id}-provider`}>Provider</Label>
        <NativeSelect id={`${id}-provider`} value={dcIdx} onChange={e => setDcIdx(e.target.value)}
          required className="w-full">
          <NativeSelectOption value="" disabled>Select a provider</NativeSelectOption>
          {doctorClinics.map((d, i) => <NativeSelectOption key={i} value={i}>{d.label}</NativeSelectOption>)}
        </NativeSelect>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid content-start gap-2">
          <Label htmlFor={`${id}-date`}>Date</Label>
          <Input id={`${id}-date`} type="date" value={date} min={phYmd()}
            onChange={e => setDate(e.target.value)} required />
        </div>
        <div className="grid content-start gap-2">
          <Label htmlFor={`${id}-duration`}>Duration</Label>
          <NativeSelect id={`${id}-duration`} value={duration} onChange={e => setDuration(Number(e.target.value))}
            className="w-full">
            {DURATIONS.map(m => <NativeSelectOption key={m} value={m}>{m} min</NativeSelectOption>)}
          </NativeSelect>
        </div>
      </div>

      <SlotPicker doctorId={dc?.doctor_id ?? null} clinicId={dc?.clinic_id ?? null} date={date}
        duration={duration} value={slot} onChange={setSlot} refreshKey={slotsKey} />

      <div className="grid content-start gap-2">
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
