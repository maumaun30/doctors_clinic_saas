"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircleIcon, ArrowRightIcon, CalendarClockIcon } from "lucide-react";
import { rescheduleAppointment } from "@/lib/actions/appointments";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { SlotPicker, fmtSlotDay, fmtSlotTime } from "@/app/(app)/schedule/slot-picker";
import { phYmd } from "@/lib/dates";

const DURATIONS = [15, 20, 30, 45, 60, 90];

// "Reschedule" button + dialog: same doctor and clinic, new open slot.
export default function RescheduleDialog({
  appointmentId, doctorId, clinicId, currentDuration, currentAt,
}: {
  appointmentId: string; doctorId: string; clinicId: string; currentDuration: number; currentAt: string;
}) {
  const id = useId();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(() => phYmd());
  const [duration, setDuration] = useState(currentDuration);
  const [slot, setSlot] = useState("");
  const [slotsKey, setSlotsKey] = useState(0);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const durations = DURATIONS.includes(currentDuration) ? DURATIONS : [...DURATIONS, currentDuration].sort((a, b) => a - b);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!slot) { setError("Pick a new time first."); return; }
    start(async () => {
      const res = await rescheduleAppointment({ appointment_id: appointmentId, scheduled_at: slot, duration_minutes: duration });
      if (!res.ok) {
        setError(res.error);
        if (res.slotTaken) setSlotsKey(k => k + 1);
        return;
      }
      setOpen(false);
      toast.success(`Moved to ${fmtSlotDay(date)}, ${fmtSlotTime(slot)}`);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!pending) { setOpen(o); if (!o) setError(null); } }}>
      <DialogTrigger asChild>
        <Button variant="outline"><CalendarClockIcon /> Reschedule</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader className="flex-row items-center gap-3 text-left">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CalendarClockIcon className="size-5" />
          </div>
          <div className="grid gap-1">
            <DialogTitle>Reschedule</DialogTitle>
            <DialogDescription>Same doctor and clinic. The patient’s reminders follow the new time.</DialogDescription>
          </div>
        </DialogHeader>

        <form onSubmit={submit} className="grid gap-4" aria-busy={pending}>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid content-start gap-2">
              <Label htmlFor={`${id}-date`}>Date</Label>
              <Input id={`${id}-date`} type="date" value={date} min={phYmd()} onChange={e => setDate(e.target.value)} required />
            </div>
            <div className="grid content-start gap-2">
              <Label htmlFor={`${id}-duration`}>Duration</Label>
              <NativeSelect id={`${id}-duration`} value={duration} onChange={e => setDuration(Number(e.target.value))} className="w-full">
                {durations.map(m => <NativeSelectOption key={m} value={m}>{m} min</NativeSelectOption>)}
              </NativeSelect>
            </div>
          </div>

          <SlotPicker doctorId={doctorId} clinicId={clinicId} date={date} duration={duration}
            value={slot} onChange={setSlot} refreshKey={slotsKey} label="New time" />

          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 text-sm">
            <span className="text-muted-foreground line-through decoration-muted-foreground/50">
              {fmtSlotDay(phYmd(new Date(currentAt)))}, {fmtSlotTime(currentAt)}
            </span>
            <ArrowRightIcon className="size-4 text-primary" />
            <span className="font-medium text-primary">
              {slot ? `${fmtSlotDay(date)}, ${fmtSlotTime(slot)} · ${duration} min` : "Pick a new time"}
            </span>
          </div>

          {error && (
            <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
              <AlertCircleIcon />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
            <Button type="submit" disabled={pending || !slot}>
              {pending ? <><Spinner /> Saving…</> : "Reschedule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
