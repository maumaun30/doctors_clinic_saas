"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserCheckIcon, UserXIcon } from "lucide-react";
import { setStaffAccess } from "@/lib/actions/staff";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Role = "doctor" | "secretary" | "admin";
type Props = { userId: string; name: string; role: Role; deactivatedAt: string | null; isSelf?: boolean };

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric" });

function useStaffAccess(userId: string, name: string) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const run = (next: boolean) => start(async () => {
    const res = await setStaffAccess(userId, next);
    if (!res.ok) { toast.error(res.error); return; }
    setConfirm(false);
    toast.success(next ? `${name} can sign in again` : `${name}’s access was removed`);
    router.refresh();
  });
  return { confirm, setConfirm, pending, run };
}

function RemoveDialog({ name, role, s }: { name: string; role: Role; s: ReturnType<typeof useStaffAccess> }) {
  return (
    <AlertDialog open={s.confirm} onOpenChange={o => !s.pending && s.setConfirm(o)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {name}’s access?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="grid gap-2">
              <p>They’ll be signed out and can’t sign in again. Their name stays on past appointments, visits and the audit log.</p>
              {role === "doctor" && <p>They’ll no longer be bookable, and they’ll stop counting toward your bill. Upcoming appointments must be moved or cancelled first.</p>}
              <p>You can restore access later.</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={s.pending}>Keep access</AlertDialogCancel>
          <AlertDialogAction disabled={s.pending} onClick={e => { e.preventDefault(); s.run(false); }}
            className="bg-destructive text-white hover:bg-destructive/90">
            {s.pending ? <><Spinner /> Removing…</> : "Remove access"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Doctor / secretary detail page: remove or restore someone's access. */
export function StaffAccessCard({ userId, name, role, deactivatedAt, isSelf = false }: Props) {
  const s = useStaffAccess(userId, name);
  const active = !deactivatedAt;
  return (
    <Card className={active ? undefined : "ring-(--warning)/40"}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Access {active ? <Badge variant="success">Active</Badge> : <Badge variant="warning">Removed {fmt(deactivatedAt!)}</Badge>}
        </CardTitle>
        <CardDescription>
          {active
            ? "Remove access when someone leaves. Their name stays on past appointments and records."
            : `${name} can’t sign in or see anything. Their past work is kept.${role === "doctor" ? " They can’t be booked and don’t count toward billing." : ""}`}
        </CardDescription>
        <CardAction>
          {active ? (
            <Button variant="outline" disabled={isSelf || s.pending} onClick={() => s.setConfirm(true)}
              title={isSelf ? "You can’t remove your own access" : undefined}
              className="text-destructive hover:text-destructive">
              <UserXIcon /> Remove access
            </Button>
          ) : (
            <Button variant="outline" disabled={s.pending} onClick={() => s.run(true)}>
              {s.pending ? <Spinner /> : <UserCheckIcon />} Restore access
            </Button>
          )}
        </CardAction>
      </CardHeader>
      {!active && role === "secretary" && (
        <CardContent className="text-sm text-muted-foreground">
          Their doctor assignments are kept, so restoring access puts everything back as it was.
        </CardContent>
      )}
      <RemoveDialog name={name} role={role} s={s} />
    </Card>
  );
}

/** Compact version for table rows (Team & invites, for admins without a detail page). */
export function StaffAccessButton({ userId, name, role, deactivatedAt, isSelf = false }: Props) {
  const s = useStaffAccess(userId, name);
  if (isSelf) return null;
  return deactivatedAt ? (
    <Button variant="ghost" size="sm" disabled={s.pending} onClick={() => s.run(true)}>
      {s.pending ? <Spinner /> : <UserCheckIcon />} Restore
    </Button>
  ) : (
    <>
      <Button variant="ghost" size="sm" disabled={s.pending} onClick={() => s.setConfirm(true)}
        className="text-destructive hover:text-destructive">
        <UserXIcon /> Remove
      </Button>
      <RemoveDialog name={name} role={role} s={s} />
    </>
  );
}
