"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { rescheduleAppointment } from "@/lib/actions/appointments";

const fmtSlot = (iso: string) =>
  new Date(iso).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    weekday: "short", hour: "2-digit", minute: "2-digit",
  });

const todayPhIso = () => {
  const ph = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
  return new Date(ph.getFullYear(), ph.getMonth(), ph.getDate()).toISOString().slice(0, 10);
};

export default function RescheduleForm({
  appointmentId, doctorId, clinicId, currentDuration,
}: { appointmentId: string; doctorId: string; clinicId: string; currentDuration: number }) {
  const sb = createClient();
  const router = useRouter();
  const [date, setDate] = useState(todayPhIso());
  const [duration, setDuration] = useState(currentDuration);
  const [slots, setSlots] = useState<string[]>([]);
  const [slot, setSlot] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true); setSlot("");
    sb.rpc("available_slots", {
      p_doctor_id: doctorId,
      p_clinic_id: clinicId,
      p_date_local: date,
      p_duration_minutes: duration,
      p_step_minutes: 15,
    }).then(({ data, error }) => {
      if (error) setMsg(error.message);
      else setSlots((data ?? []).map((r: any) => r.slot_start));
      setLoading(false);
    });
  }, [date, duration]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!slot) { setMsg("Pick a slot."); return; }
    start(async () => {
      try {
        await rescheduleAppointment({
          appointment_id: appointmentId,
          scheduled_at: slot,
          duration_minutes: duration,
        });
        router.refresh();
        setMsg("Rescheduled.");
      } catch (e: any) { setMsg(e.message); }
    });
  };

  return (
    <form onSubmit={submit} style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
      <div className="field" style={{ margin: 0 }}>
        <label className="label">Date</label>
        <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} min={todayPhIso()} required style={{ width: 170 }} />
      </div>
      <div className="field" style={{ margin: 0 }}>
        <label className="label">Duration</label>
        <input className="input" type="number" min={5} max={480} value={duration}
               onChange={e => setDuration(Number(e.target.value) || currentDuration)} style={{ width: 110 }} />
      </div>
      <div className="field" style={{ margin: 0 }}>
        <label className="label">Slot</label>
        <select className="select" value={slot} onChange={e => setSlot(e.target.value)} required
                disabled={loading || slots.length === 0} style={{ minWidth: 180 }}>
          <option value="">
            {loading ? "loading…" : slots.length === 0 ? "no slots" : "— pick —"}
          </option>
          {slots.map(s => <option key={s} value={s}>{fmtSlot(s)}</option>)}
        </select>
      </div>
      <button type="submit" className="btn btn-secondary" disabled={busy || !slot}>{busy ? "…" : "Reschedule"}</button>
      {msg && <span style={{ fontSize: 13, color: msg === "Rescheduled." ? "var(--success)" : "var(--danger)" }}>{msg}</span>}
    </form>
  );
}
