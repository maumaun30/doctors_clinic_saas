"use client";

import { useEffect, useState, useTransition } from "react";
import { bookAppointment } from "@/lib/actions/appointments";
import { createClient } from "@/lib/supabase/browser";

type Option = { id: string; label: string };
type DoctorClinic = { doctor_id: string; clinic_id: string; label: string };

const fmtSlot = (iso: string) =>
  new Date(iso).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    weekday: "short", hour: "2-digit", minute: "2-digit",
  });

const todayPhIso = () => {
  const ph = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
  return new Date(ph.getFullYear(), ph.getMonth(), ph.getDate()).toISOString().slice(0, 10);
};

export default function BookingForm({
  patients, doctorClinics,
}: { patients: Option[]; doctorClinics: DoctorClinic[] }) {
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
        setMsg("Booked.");
        setPatientId(""); setSlot(""); setNotes("");
      } catch (e: any) { setMsg(`Error: ${e.message}`); }
    });
  };

  const ok = msg && !msg.startsWith("Error") && !msg.startsWith("Pick");

  return (
    <form onSubmit={submit} className="card" style={{ maxWidth: 560, padding: 24 }}>
      <div className="field">
        <label className="label">Patient</label>
        <select className="select" style={{ width: "100%" }}
                value={patientId} onChange={e => setPatientId(e.target.value)} required>
          <option value="">— select patient —</option>
          {patients.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </div>

      <div className="field">
        <label className="label">Provider</label>
        <select className="select" style={{ width: "100%" }}
                value={dcIdx} onChange={e => setDcIdx(e.target.value)} required>
          <option value="">— select doctor —</option>
          {doctorClinics.map((dc, i) => <option key={i} value={i}>{dc.label}</option>)}
        </select>
      </div>

      <div className="grid-2">
        <div className="field">
          <label className="label">Date</label>
          <input className="input" type="date" value={date} min={todayPhIso()}
                 onChange={e => setDate(e.target.value)} required />
        </div>
        <div className="field">
          <label className="label">Duration (min)</label>
          <input className="input" type="number" value={duration} min={5} max={480}
                 onChange={e => setDuration(Number(e.target.value) || 30)} />
        </div>
      </div>

      <div className="field">
        <label className="label">Time slot</label>
        <select className="select" style={{ width: "100%" }}
                value={slot} onChange={e => setSlot(e.target.value)} required
                disabled={!dcIdx || loadingSlots || slots.length === 0}>
          <option value="">
            {!dcIdx ? "— pick a doctor first —"
              : loadingSlots ? "loading…"
              : slots.length === 0 ? "no slots available"
              : "— pick a slot —"}
          </option>
          {slots.map(s => <option key={s} value={s}>{fmtSlot(s)}</option>)}
        </select>
      </div>

      <div className="field">
        <label className="label">Reason for visit</label>
        <textarea className="input" value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. Blood pressure follow-up (optional)" rows={2} />
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center", marginTop: 8 }}>
        {msg && (
          <span style={{ marginRight: "auto", fontSize: 13, color: ok ? "var(--success)" : "var(--danger)" }}>{msg}</span>
        )}
        <button type="submit" className="btn btn-primary" disabled={pending || !slot}>
          {pending ? "Booking…" : "Book appointment"}
        </button>
      </div>
    </form>
  );
}
