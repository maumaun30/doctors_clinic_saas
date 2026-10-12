"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  CalendarClockIcon, CheckIcon, EllipsisIcon, ExternalLinkIcon, UserXIcon, XCircleIcon,
} from "lucide-react";
import { updateAppointmentStatus } from "@/lib/actions/appointments";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Spinner } from "@/components/ui/spinner";

type Status = "scheduled" | "confirmed" | "completed" | "cancelled" | "no_show";

// Row "⋯" menu on the schedule: open/reschedule plus quick status changes.
// Cancelling asks first (the dialog lives outside the menu so focus works).
export function AppointmentActions({ id, status, patient, when, onVisitPage = false }: {
  id: string; status: Status; patient: string; when: string;
  /** Already on the visit page: hide "Open visit" and "Reschedule". */
  onVisitPage?: boolean;
}) {
  const [pending, start] = useTransition();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const active = status === "scheduled" || status === "confirmed";

  const set = (next: "confirmed" | "no_show" | "cancelled", done: string) =>
    start(async () => {
      const res = await updateAppointmentStatus({ appointment_id: id, status: next });
      setConfirmCancel(false);
      if (res.ok) toast.success(done);
      else toast.error(res.error);
    });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${patient}`} disabled={pending}>
            {pending ? <Spinner /> : <EllipsisIcon />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {!onVisitPage && (
            <DropdownMenuItem asChild>
              <Link href={`/visits/${id}`}><ExternalLinkIcon /> {active ? "Open visit" : "View visit"}</Link>
            </DropdownMenuItem>
          )}
          {active && !onVisitPage && (
            <DropdownMenuItem asChild>
              <Link href={`/visits/${id}#reschedule`}><CalendarClockIcon /> Reschedule</Link>
            </DropdownMenuItem>
          )}
          {status === "scheduled" && (
            <DropdownMenuItem onSelect={() => set("confirmed", "Appointment confirmed")}>
              <CheckIcon /> Confirm
            </DropdownMenuItem>
          )}
          {active && (
            <>
              <DropdownMenuItem onSelect={() => set("no_show", "Marked as no-show")}>
                <UserXIcon /> Mark no-show
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirmCancel(true)}>
                <XCircleIcon /> Cancel appointment
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmCancel} onOpenChange={o => !pending && setConfirmCancel(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this appointment?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{patient}</strong>, {when}. The slot opens up for other bookings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={e => { e.preventDefault(); set("cancelled", "Appointment cancelled"); }}
            >
              {pending ? <><Spinner /> Cancelling…</> : "Cancel appointment"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
