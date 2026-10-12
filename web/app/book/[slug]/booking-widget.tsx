"use client";

import { useEffect, useState, useTransition } from "react";
import {
  bookPublicAppointment, getPublicSlots, type PublicDoctor,
} from "@/lib/actions/public-booking";
import { Button } from "@/components/ui/button";

const TZ = "Asia/Manila";

const todayPh = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date()); // YYYY-MM-DD

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-PH", { timeZone: TZ, hour: "numeric", minute: "2-digit" });

const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString("en-PH", {
    timeZone: TZ, weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
  });

export default function BookingWidget({
  slug, clinicName, doctors,
}: { slug: string; clinicName: string; doctors: PublicDoctor[] }) {
  const [doctorId, setDoctorId] = useState(doctors.length === 1 ? doctors[0].id : "");
  const [date, setDate] = useState(todayPh());
  const [slots, setSlots] = useState<string[]>([]);
  const [slot, setSlot] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booked, setBooked] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    setSlot("");
    if (!doctorId || !date) { setSlots([]); return; }
    let cancelled = false;
    setLoading(true);
    getPublicSlots({ slug, doctor_id: doctorId, date })
      .then(s => { if (!cancelled) setSlots(s); })
      .catch(e => { if (!cancelled) { setSlots([]); setError(e.message); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug, doctorId, date]);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!slot) { setError("Please pick a time."); return; }
    const f = new FormData(e.currentTarget);
    start(async () => {
      const res = await bookPublicAppointment({
        slug,
        doctor_id: doctorId,
        scheduled_at: slot,
        full_name: f.get("full_name"),
        phone: f.get("phone"),
        email: f.get("email"),
        date_of_birth: f.get("date_of_birth"),
        website: f.get("website"),
      });
      if (res.ok) {
        setBooked(res.scheduled_at);
      } else {
        setError(res.error);
        // The slot may have just been taken — refresh the list.
        getPublicSlots({ slug, doctor_id: doctorId, date }).then(setSlots).catch(() => {});
      }
    });
  };

  if (booked) {
    const doctor = doctors.find(d => d.id === doctorId);
    return (
      <div role="status" style={{ textAlign: "center" }}>
        <p className="strong" style={{ fontSize: 15, marginBottom: 6 }}>You’re booked.</p>
        <p style={{ color: "var(--fg-muted)", fontSize: 13.5, lineHeight: 1.5 }}>
          {doctor?.name ?? "Your doctor"} · {fmtWhen(booked)}<br />
          {clinicName} will confirm your appointment. If you gave an email,
          you’ll get a reminder the day before.
        </p>
        <Button variant="outline" type="button" style={{ marginTop: 18 }}
                onClick={() => { setBooked(null); setSlot(""); setDate(todayPh()); }}>
          Book another
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit}>
      <div className="field">
        <label className="label" htmlFor="doctor">Doctor</label>
        <select id="doctor" className="select" style={{ width: "100%" }} required
                value={doctorId} onChange={e => setDoctorId(e.target.value)}>
          <option value="">Choose a doctor</option>
          {doctors.map(d => (
            <option key={d.id} value={d.id}>
              {d.name}{d.specialization ? ` — ${d.specialization}` : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label className="label" htmlFor="date">Date</label>
        <input id="date" className="input" type="date" required
               min={todayPh()} max={addDays(todayPh(), 60)}
               value={date} onChange={e => setDate(e.target.value)} />
      </div>

      <div className="field">
        <span className="label">Time</span>
        {!doctorId ? <p className="hint">Choose a doctor to see open times.</p>
          : loading ? <p className="hint">Loading open times…</p>
          : slots.length === 0 ? <p className="hint">No open times on this day. Try another date.</p>
          : (
            <div className="slot-grid" role="group" aria-label="Available times">
              {slots.map(s => (
                <Button
                  variant={slot === s ? "default" : "outline"}
                  size="sm"
                  key={s}
                  type="button"
                  aria-pressed={slot === s}
                  onClick={() => setSlot(s)}>
                  {fmtTime(s)}
                </Button>
              ))}
            </div>
          )}
      </div>

      <div className="field">
        <label className="label" htmlFor="full_name">Full name</label>
        <input id="full_name" name="full_name" className="input" autoComplete="name" required minLength={2} />
      </div>
      <div className="grid-2">
        <div className="field">
          <label className="label" htmlFor="phone">Mobile number</label>
          <input id="phone" name="phone" className="input" type="tel" autoComplete="tel" required
                 placeholder="0917 123 4567" />
        </div>
        <div className="field">
          <label className="label" htmlFor="date_of_birth">Date of birth <span className="hint">(optional)</span></label>
          <input id="date_of_birth" name="date_of_birth" className="input" type="date" max={todayPh()} />
        </div>
      </div>
      <div className="field">
        <label className="label" htmlFor="email">Email <span className="hint">(optional, for a reminder)</span></label>
        <input id="email" name="email" className="input" type="email" autoComplete="email" />
      </div>

      <div className="honeypot" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      {error && (
        <p role="alert" style={{ color: "var(--danger)", fontSize: 13, margin: "4px 0 12px" }}>{error}</p>
      )}

      <Button type="submit" style={{ width: "100%" }} disabled={pending || !slot}>
        {pending ? "Booking…" : slot ? `Book ${fmtTime(slot)}` : "Book appointment"}
      </Button>
    </form>
  );
}
