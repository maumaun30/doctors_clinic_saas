"use client";

import { useEffect, useState, useTransition } from "react";
import { AlertCircleIcon, CalendarCheck2Icon, CalendarPlusIcon, StethoscopeIcon } from "lucide-react";
import {
  bookPublicAppointment, getPublicSlots, type PublicDoctor,
} from "@/lib/actions/public-booking";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

const TZ = "Asia/Manila";
const DURATION_MIN = 30;

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
const chip = (ymd: string, i: number) => ({
  top: i === 0 ? "Today" : i === 1 ? "Tomorrow" : new Date(`${ymd}T12:00:00+08:00`).toLocaleDateString("en-PH", { timeZone: TZ, weekday: "short" }),
  bottom: new Date(`${ymd}T12:00:00+08:00`).toLocaleDateString("en-PH", { timeZone: TZ, month: "short", day: "numeric" }),
});

// A one-event calendar file so patients can save the visit.
function icsHref(startIso: string, title: string, location: string) {
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const start = new Date(startIso);
  const end = new Date(start.getTime() + DURATION_MIN * 60_000);
  const esc = (s: string) => s.replace(/[,;\\]/g, m => `\\${m}`);
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Doctors Clinic//Booking//EN", "BEGIN:VEVENT",
    `UID:${start.getTime()}@doctors-clinic`, `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`, `DTEND:${fmt(end)}`, `SUMMARY:${esc(title)}`, `LOCATION:${esc(location)}`,
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-3">
      <legend className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] text-primary-foreground">{n}</span>
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

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

  const doctor = doctors.find(d => d.id === doctorId);
  const today = todayPh();
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i));

  if (booked) {
    return (
      <div role="status" className="grid justify-items-center gap-3 py-2 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-(--success-subtle) text-(--success)">
          <CalendarCheck2Icon className="size-6" />
        </div>
        <div>
          <p className="text-base font-semibold">You’re booked</p>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{fmtWhen(booked)}</span><br />
            with {doctor?.name ?? "your doctor"} at {clinicName}
          </p>
        </div>
        <p className="max-w-sm text-xs text-muted-foreground">
          The clinic will confirm your appointment. If you gave an email, you’ll get a reminder the day before.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild variant="outline">
            <a href={icsHref(booked, `Appointment — ${doctor?.name ?? clinicName}`, clinicName)} download="appointment.ics">
              <CalendarPlusIcon /> Add to calendar
            </a>
          </Button>
          <Button variant="ghost" type="button" onClick={() => { setBooked(null); setSlot(""); setDate(todayPh()); }}>
            Book another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-6">
      <Step n={1} title="Doctor">
        {doctors.length <= 6 ? (
          <div role="radiogroup" aria-label="Doctor" className="grid gap-2">
            {doctors.map(d => (
              <button key={d.id} type="button" role="radio" aria-checked={doctorId === d.id} onClick={() => setDoctorId(d.id)}
                className={cn("flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  doctorId === d.id ? "border-primary bg-primary/5" : "hover:bg-muted/50")}>
                <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full",
                  doctorId === d.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                  <StethoscopeIcon className="size-4" />
                </span>
                <span className="grid">
                  <span className="text-sm font-medium">{d.name}</span>
                  {d.specialization && <span className="text-xs text-muted-foreground">{d.specialization}</span>}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <NativeSelect id="doctor" required value={doctorId} onChange={e => setDoctorId(e.target.value)} className="w-full" aria-label="Doctor">
            <NativeSelectOption value="">Choose a doctor</NativeSelectOption>
            {doctors.map(d => (
              <NativeSelectOption key={d.id} value={d.id}>{d.name}{d.specialization ? ` — ${d.specialization}` : ""}</NativeSelectOption>
            ))}
          </NativeSelect>
        )}
      </Step>

      <Step n={2} title="Date & time">
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
          {week.map((d, i) => {
            const c = chip(d, i);
            return (
              <button key={d} type="button" onClick={() => setDate(d)} aria-pressed={date === d}
                className={cn("grid rounded-lg border px-1 py-1.5 text-center text-xs leading-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  date === d ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted/50")}>
                <span className="font-medium">{c.top}</span>
                <span className={date === d ? "opacity-80" : "text-muted-foreground"}>{c.bottom}</span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Label htmlFor="date" className="font-normal text-muted-foreground">Another date</Label>
          <Input id="date" type="date" required min={today} max={addDays(today, 60)} value={date}
            onChange={e => setDate(e.target.value)} className="w-40" />
        </div>
        {!doctorId ? <p className="rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground">Choose a doctor to see open times.</p>
          : loading ? <p className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground"><Spinner className="size-3.5" /> Finding open times…</p>
          : slots.length === 0 ? <p className="rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground">No open times on this day. Try another date.</p>
          : (
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4" role="radiogroup" aria-label="Available times">
              {slots.map(s => (
                <Button key={s} variant={slot === s ? "default" : "outline"} size="sm" type="button"
                  role="radio" aria-checked={slot === s} onClick={() => setSlot(s)} className="tabular-nums">
                  {fmtTime(s)}
                </Button>
              ))}
            </div>
          )}
      </Step>

      <Step n={3} title="Your details">
        <div className="grid content-start gap-2">
          <Label htmlFor="full_name">Full name</Label>
          <Input id="full_name" name="full_name" autoComplete="name" required minLength={2} placeholder="Juan dela Cruz" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid content-start gap-2">
            <Label htmlFor="phone">Mobile number</Label>
            <Input id="phone" name="phone" type="tel" autoComplete="tel" required placeholder="0917 123 4567" />
          </div>
          <div className="grid content-start gap-2">
            <Label htmlFor="date_of_birth">Date of birth <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Input id="date_of_birth" name="date_of_birth" type="date" max={today} />
          </div>
        </div>
        <div className="grid content-start gap-2">
          <Label htmlFor="email">Email <span className="font-normal text-muted-foreground">(optional, for a reminder)</span></Label>
          <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" />
        </div>
      </Step>

      <div className="honeypot" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      {error && (
        <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
          <AlertCircleIcon /><AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-2">
        {slot && doctor && (
          <p className="text-center text-sm text-muted-foreground">
            {fmtWhen(slot)} with <span className="font-medium text-foreground">{doctor.name}</span>
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={pending || !slot}>
          {pending ? <><Spinner /> Booking…</> : slot ? `Book ${fmtTime(slot)}` : "Pick a time to book"}
        </Button>
      </div>
    </form>
  );
}
