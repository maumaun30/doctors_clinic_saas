"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MergeIcon } from "lucide-react";
import { mergePatients } from "@/lib/actions/patients";
import type { PatientSummary } from "../duplicates/summary";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const TZ = "Asia/Manila";
const fmtDate = (d: string | null) =>
  d ? new Date(d.length === 10 ? `${d}T12:00:00+08:00` : d).toLocaleDateString("en-PH", { timeZone: TZ, month: "short", day: "numeric", year: "numeric" }) : null;
const blank = (v: string | null | undefined) => !v || !v.trim();
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

type Row = { label: string; get: (p: PatientSummary) => string | null; fill?: boolean };
// `fill`: blank on the kept record is filled from the other one (admin_merge_patients).
const ROWS: Row[] = [
  { label: "Name", get: p => p.full_name },
  { label: "Date of birth", get: p => fmtDate(p.date_of_birth), fill: true },
  { label: "Sex", get: p => p.sex && p.sex[0].toUpperCase() + p.sex.slice(1), fill: true },
  { label: "Mobile", get: p => p.phone, fill: true },
  { label: "Email", get: p => p.email, fill: true },
  { label: "Address", get: p => p.address, fill: true },
];

function Choice({ p, keep, onPick }: { p: PatientSummary; keep: boolean; onPick: () => void }) {
  return (
    <button type="button" onClick={onPick} aria-pressed={keep}
      className={cn("grid gap-2 rounded-xl border p-4 text-left text-sm transition-colors",
        keep ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50")}>
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium">{p.full_name}</span>
        {keep ? <Badge>Keep</Badge> : <Badge variant="secondary">Merge in</Badge>}
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        {ROWS.slice(1).map(r => (
          <div key={r.label} className="contents">
            <dt className="text-muted-foreground">{r.label}</dt>
            <dd className="min-w-0 break-words">{r.get(p) ?? <span className="text-muted-foreground">—</span>}</dd>
          </div>
        ))}
        <dt className="text-muted-foreground">Clinics</dt><dd>{p.clinics.join(", ") || "—"}</dd>
        <dt className="text-muted-foreground">History</dt>
        <dd>{plural(p.visits, "visit")}, {plural(p.appointments, "appointment")}</dd>
        <dt className="text-muted-foreground">Added</dt><dd>{fmtDate(p.created_at)}</dd>
      </dl>
    </button>
  );
}

/** Compare two records, choose the one to keep, confirm, merge. */
export function MergeForm({ a, b, defaultKeep }: { a: PatientSummary; b: PatientSummary; defaultKeep: string }) {
  const router = useRouter();
  const [keepId, setKeepId] = useState(defaultKeep);
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const keep = keepId === a.id ? a : b;
  const other = keepId === a.id ? b : a;

  const filled = ROWS.filter(r => r.fill && blank(r.get(keep)) && !blank(r.get(other)));
  const dropped = ROWS.filter(r => !blank(r.get(keep)) && !blank(r.get(other)) && r.get(keep) !== r.get(other));
  const clinics = [...new Set([...keep.clinics, ...other.clinics])];

  const run = () => start(async () => {
    const res = await mergePatients(keep.id, other.id);
    if (!res.ok) { toast.error(res.error); return; }
    toast.success(`Merged into ${keep.full_name}`);
    router.push(`/patients/${keep.id}`);
  });

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">Choose the record to keep. Click a card to switch.</p>
      <div className="grid gap-3 md:grid-cols-2">
        <Choice p={a} keep={keepId === a.id} onPick={() => setKeepId(a.id)} />
        <Choice p={b} keep={keepId === b.id} onPick={() => setKeepId(b.id)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>After merging</CardTitle>
          <CardDescription>One record, <strong className="text-foreground">{keep.full_name}</strong>, with everything from both.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-1.5 text-sm">
          <p>• {plural(keep.visits + other.visits, "visit")} and {plural(keep.appointments + other.appointments, "appointment")}, with their prescriptions, labs and problem lists</p>
          <p>• Clinics: {clinics.join(", ") || "none"}</p>
          {filled.length > 0 && <p>• Filled in from the other record: {filled.map(r => r.label.toLowerCase()).join(", ")}</p>}
          {dropped.length > 0 && (
            <p className="text-(--warning)">
              • Kept as is (the other record’s value is dropped): {dropped.map(r => `${r.label.toLowerCase()} “${r.get(other)}”`).join(", ")}.
              Edit the patient afterwards if needed.
            </p>
          )}
          <p className="text-muted-foreground">The other record is removed. The merge is recorded in the audit log.</p>
        </CardContent>
        <CardFooter className="justify-end">
          <Button onClick={() => setConfirm(true)}><MergeIcon /> Merge records</Button>
        </CardFooter>
      </Card>

      <AlertDialog open={confirm} onOpenChange={o => !pending && setConfirm(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Merge into {keep.full_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              All of {other.full_name}’s history moves to the record you’re keeping, and the other record is removed. This can’t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={pending} onClick={e => { e.preventDefault(); run(); }}>
              {pending ? <><Spinner /> Merging…</> : "Merge records"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
