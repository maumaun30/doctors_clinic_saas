"use client";

import { useState, useTransition } from "react";
import { CalendarCheck2Icon, CalendarXIcon, AlertCircleIcon } from "lucide-react";
import { respondToAppointment } from "@/lib/actions/patient-link";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";

type Props = { token: string; status: string; canConfirm: boolean; canCancel: boolean; past: boolean };

function Done({ status }: { status: string }) {
  const cancelled = status === "cancelled";
  return (
    <div role="status" className="mt-4 flex items-start gap-3 rounded-lg border p-4 text-sm">
      <span className={cancelled ? "text-muted-foreground" : "text-(--success)"}>
        {cancelled ? <CalendarXIcon className="size-5" /> : <CalendarCheck2Icon className="size-5" />}
      </span>
      <span>
        <span className="block font-medium">{cancelled ? "Appointment cancelled" : "You’re confirmed"}</span>
        <span className="text-muted-foreground">
          {cancelled ? "The clinic has been told. To book again, call the clinic or use their booking page." : "See you then. If your plans change, you can cancel from this page."}
        </span>
      </span>
    </div>
  );
}

export function PatientActions({ token, status: initial, canConfirm, canCancel, past }: Props) {
  const [status, setStatus] = useState(initial);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (action: "confirm" | "cancel") => start(async () => {
    setError(null);
    const res = await respondToAppointment(token, action);
    if (!res.ok) { setError(res.error); return; }
    setAsking(false);
    setStatus(res.status);
  });

  if (status === "cancelled") return <Done status="cancelled" />;
  if (past || (status !== "scheduled" && status !== "confirmed")) {
    return <p className="mt-4 text-sm text-muted-foreground">This appointment has passed. For anything else, please call the clinic.</p>;
  }

  return (
    <div className="mt-4 grid gap-3">
      {status === "confirmed" && <Done status="confirmed" />}
      {error && (
        <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
          <AlertCircleIcon /><AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {asking ? (
        <div className="grid gap-2 rounded-lg border p-4 text-sm">
          <p className="font-medium">Cancel this appointment?</p>
          <p className="text-muted-foreground">Your time will be given to another patient.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="destructive" disabled={pending} onClick={() => run("cancel")}>
              {pending ? <><Spinner /> Cancelling…</> : "Yes, cancel it"}
            </Button>
            <Button variant="outline" disabled={pending} onClick={() => setAsking(false)}>Keep my appointment</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {status === "scheduled" && canConfirm && (
            <Button size="lg" disabled={pending} onClick={() => run("confirm")}>
              {pending ? <><Spinner /> Confirming…</> : <><CalendarCheck2Icon /> I’ll be there</>}
            </Button>
          )}
          {canCancel ? (
            <Button size="lg" variant="outline" disabled={pending} onClick={() => setAsking(true)}>
              <CalendarXIcon /> Cancel appointment
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">To cancel within 2 hours of your appointment, please call the clinic.</p>
          )}
        </div>
      )}
    </div>
  );
}
