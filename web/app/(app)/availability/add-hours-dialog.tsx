"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircleIcon, ClockPlusIcon, PlusIcon } from "lucide-react";
import { addAvailability } from "@/lib/actions/availability";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";

export type Pair = { doctor_id: string; clinic_id: string; label: string };

// Mon-first week; values are Postgres weekday numbers (0 = Sunday).
const WEEK = [
  { v: 1, s: "Mon" }, { v: 2, s: "Tue" }, { v: 3, s: "Wed" }, { v: 4, s: "Thu" },
  { v: 5, s: "Fri" }, { v: 6, s: "Sat" }, { v: 0, s: "Sun" },
];
const PRESETS = [
  { label: "Morning", start: "09:00", end: "12:00" },
  { label: "Afternoon", start: "13:00", end: "17:00" },
  { label: "Full day", start: "09:00", end: "17:00" },
];

export function AddHoursDialog({ pairs, defaultPair, defaultDays = [1, 2, 3, 4, 5], compact = false }: {
  pairs: Pair[]; defaultPair?: Pair; defaultDays?: number[]; compact?: boolean;
}) {
  const id = useId();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pair, setPair] = useState(defaultPair ? `${defaultPair.doctor_id}|${defaultPair.clinic_id}` : "");
  const [days, setDays] = useState<string[]>(defaultDays.map(String));
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("17:00");
  const [error, setError] = useState<string | null>(null);
  const [pending, startT] = useTransition();

  const hours = (() => {
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const mins = eh * 60 + em - (sh * 60 + sm);
    return mins > 0 ? mins / 60 : null;
  })();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const [doctor_id, clinic_id] = pair.split("|");
    if (!doctor_id) { setError("Choose a doctor."); return; }
    if (!hours) { setError("End time must be after the start time."); return; }
    startT(async () => {
      const res = await addAvailability({ doctor_id, clinic_id, weekdays: days.map(Number), start_time: start, end_time: end });
      if (!res.ok) { setError(res.error); return; }
      setOpen(false);
      toast.success(`Added hours to ${res.added} day${res.added === 1 ? "" : "s"}`);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!pending) { setOpen(o); if (!o) setError(null); } }}>
      <DialogTrigger asChild>
        {compact
          ? <Button variant="outline" size="sm"><PlusIcon /> Add hours</Button>
          : <Button><ClockPlusIcon /> Add hours</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="flex-row items-center gap-3 text-left">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ClockPlusIcon className="size-5" />
          </div>
          <div className="grid gap-1">
            <DialogTitle>Add working hours</DialogTitle>
            <DialogDescription>Booking only offers times inside these windows. Split shift? Add each part separately.</DialogDescription>
          </div>
        </DialogHeader>

        <form onSubmit={submit} className="grid gap-4" aria-busy={pending}>
          {!defaultPair && (
            <div className="grid content-start gap-2">
              <Label htmlFor={`${id}-pair`}>Doctor</Label>
              <NativeSelect id={`${id}-pair`} value={pair} onChange={e => setPair(e.target.value)} className="w-full" required>
                <NativeSelectOption value="" disabled>Select a doctor</NativeSelectOption>
                {pairs.map(p => (
                  <NativeSelectOption key={`${p.doctor_id}|${p.clinic_id}`} value={`${p.doctor_id}|${p.clinic_id}`}>{p.label}</NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          )}

          <div className="grid gap-2">
            <Label>Days</Label>
            <ToggleGroup type="multiple" variant="outline" value={days} onValueChange={setDays} className="w-full" aria-label="Days">
              {WEEK.map(d => <ToggleGroupItem key={d.v} value={String(d.v)} className="flex-1">{d.s}</ToggleGroupItem>)}
            </ToggleGroup>
            <div className="flex gap-3 text-xs">
              <button type="button" className="text-primary hover:underline" onClick={() => setDays(["1", "2", "3", "4", "5"])}>Weekdays</button>
              <button type="button" className="text-primary hover:underline" onClick={() => setDays(["1", "2", "3", "4", "5", "6"])}>Mon–Sat</button>
              <button type="button" className="text-muted-foreground hover:underline" onClick={() => setDays([])}>Clear</button>
            </div>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Hours</Label>
              <div className="flex gap-1">
                {PRESETS.map(p => (
                  <Button key={p.label} type="button" size="xs" variant={start === p.start && end === p.end ? "secondary" : "ghost"}
                    onClick={() => { setStart(p.start); setEnd(p.end); }}>{p.label}</Button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <Input type="time" value={start} onChange={e => setStart(e.target.value)} aria-label="Start time" step={900} required />
              <span className="text-sm text-muted-foreground">to</span>
              <Input type="time" value={end} onChange={e => setEnd(e.target.value)} aria-label="End time" step={900} required />
            </div>
            <p className="text-xs text-muted-foreground">
              {hours ? `${hours % 1 ? hours.toFixed(1) : hours} h × ${days.length} day${days.length === 1 ? "" : "s"} = ${(hours * days.length).toFixed(hours * days.length % 1 ? 1 : 0)} h/week`
                : "End time must be after the start time."}
            </p>
          </div>

          {error && (
            <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
              <AlertCircleIcon />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
            <Button type="submit" disabled={pending || days.length === 0 || !hours}>
              {pending ? <><Spinner /> Saving…</> : `Add to ${days.length || "no"} day${days.length === 1 ? "" : "s"}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
