"use client";

import { useEffect, useState, useTransition } from "react";
import { bookAppointment } from "@/lib/actions/appointments";
import { createClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { phYmd } from "@/lib/dates";

type Option = { id: string; label: string };
type DoctorClinic = { doctor_id: string; clinic_id: string; label: string };

const fmtSlot = (iso: string) =>
  new Date(iso).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    weekday: "short", hour: "2-digit", minute: "2-digit",
  });

const todayPhIso = () => phYmd();

export default function BookingForm({
  patients, doctorClinics, onBooked, bare = false,
}: {
  patients: Option[];
  doctorClinics: DoctorClinic[];
  /** Called after a successful booking instead of showing "Booked." inline. */
  onBooked?: () => void;
  /** Render without the card frame (e.g. inside a dialog). */
  bare?: boolean;
}) {
  const sb = createClient();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const [patientId, setPatientId] = useState("");
  const [dcIdx, setDcIdx] = useState<string>("");
  const [date, setDate] = useState(todayPhIso());
  const [duration, setDuration] = useState(30);
  const [slot, setSlot] = useState<string>("");
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!dcIdx || !date) { setSlots([]); setSlot(""); return; }
    const dc = doctorClinics[Number(dcIdx)];
    setLoadingSlots(true);
    setSlot("");
    sb.rpc("available_slots", {
      p_doctor_id: dc.doctor_id,
      p_clinic_id: dc.clinic_id,
      p_date_local: date,
      p_duration_minutes: duration,
      p_step_minutes: 15,
    }).then(({ data, error }) => {
      if (error) { setMsg(error.message); setSlots([]); }
      else setSlots((data ?? []).map((r: any) => r.slot_start));
      setLoadingSlots(false);
    });
  }, [dcIdx, date, duration]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!slot) { setMsg("Pick a time slot."); return; }
    const dc = doctorClinics[Number(dcIdx)];
    start(async () => {
      try {
        await bookAppointment({
          patient_id: patientId,
          doctor_id: dc.doctor_id,
          clinic_id: dc.clinic_id,
          scheduled_at: slot,
          duration_minutes: duration,
          notes: notes || undefined,
        });
        setPatientId(""); setSlot(""); setNotes("");
        if (onBooked) onBooked();
        else setMsg("Booked.");
      } catch (e: any) { setMsg(`Error: ${e.message}`); }
    });
  };

  const ok = msg && !msg.startsWith("Error") && !msg.startsWith("Pick");

  return (
    <form onSubmit={submit} className={bare ? undefined : "card"} style={bare ? undefined : { maxWidth: 560, padding: 24 }}>
      <div className="field">
        <Label>Patient</Label>
        <NativeSelect
          value={patientId}
          onChange={e => setPatientId(e.target.value)}
          required
          className="w-full">
          <NativeSelectOption value="">— select patient —</NativeSelectOption>
          {patients.map(p => <NativeSelectOption key={p.id} value={p.id}>{p.label}</NativeSelectOption>)}
        </NativeSelect>
      </div>

      <div className="field">
        <Label>Provider</Label>
        <NativeSelect
          value={dcIdx}
          onChange={e => setDcIdx(e.target.value)}
          required
          className="w-full">
          <NativeSelectOption value="">— select doctor —</NativeSelectOption>
          {doctorClinics.map((dc, i) => <NativeSelectOption key={i} value={i}>{dc.label}</NativeSelectOption>)}
        </NativeSelect>
      </div>

      <div className="grid-2">
        <div className="field">
          <Label>Date</Label>
          <Input
            type="date"
            value={date}
            min={todayPhIso()}
            onChange={e => setDate(e.target.value)}
            required />
        </div>
        <div className="field">
          <Label>Duration (min)</Label>
          <Input
            type="number"
            value={duration}
            min={5}
            max={480}
            onChange={e => setDuration(Number(e.target.value) || 30)} />
        </div>
      </div>

      <div className="field">
        <Label>Time slot</Label>
        <NativeSelect
          value={slot}
          onChange={e => setSlot(e.target.value)}
          required
          disabled={!dcIdx || loadingSlots || slots.length === 0}
          className="w-full">
          <NativeSelectOption value="">
            {!dcIdx ? "— pick a doctor first —"
              : loadingSlots ? "loading…"
              : slots.length === 0 ? "no slots available"
              : "— pick a slot —"}
          </NativeSelectOption>
          {slots.map(s => <NativeSelectOption key={s} value={s}>{fmtSlot(s)}</NativeSelectOption>)}
        </NativeSelect>
      </div>

      <div className="field">
        <Label>Reason for visit</Label>
        <Textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="e.g. Blood pressure follow-up (optional)"
          rows={2} />
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center", marginTop: 8 }}>
        {msg && (
          <span style={{ marginRight: "auto", fontSize: 13, color: ok ? "var(--success)" : "var(--danger)" }}>{msg}</span>
        )}
        <Button type="submit" disabled={pending || !slot}>
          {pending ? "Booking…" : "Book appointment"}
        </Button>
      </div>
    </form>
  );
}
