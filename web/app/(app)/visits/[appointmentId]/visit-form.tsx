"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ActivityIcon, AlertCircleIcon, CheckIcon, ClipboardPenLineIcon, FlaskConicalIcon, ListChecksIcon,
  NotebookPenIcon, PillIcon, PlusIcon, StethoscopeIcon, XIcon,
} from "lucide-react";
import { completeVisitFull } from "@/lib/actions/appointments";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

type Med = { id: string; name: string; default_dosage: string | null; default_frequency: string | null; default_instructions: string | null };
type Lab = { id: string; name: string };
type Cond = { id: string; name: string };

type RxPick = { medication_id?: string; name: string; dosage?: string; frequency?: string; duration?: string; instructions?: string };
type LabPick = { lab_test_id?: string; name: string };
type CondPick = { condition_id?: string; name: string; status: "active" | "resolved" };

// Vitals with their units and a loose "outside usual adult range" hint.
const VITALS = [
  { key: "bp", label: "Blood pressure", unit: "mmHg", placeholder: "120/80", inputMode: "numeric" as const },
  { key: "hr", label: "Heart rate", unit: "bpm", placeholder: "72", inputMode: "numeric" as const },
  { key: "temp_c", label: "Temperature", unit: "°C", placeholder: "36.8", inputMode: "decimal" as const },
  { key: "weight_kg", label: "Weight", unit: "kg", placeholder: "65", inputMode: "decimal" as const },
] as const;
type VitalKey = (typeof VITALS)[number]["key"];

function vitalIssue(key: VitalKey, v: string): { bad?: string; note?: string } {
  if (!v.trim()) return {};
  if (key === "bp") {
    const m = v.match(/^\s*(\d{2,3})\s*\/\s*(\d{2,3})\s*$/);
    if (!m) return { bad: "Use systolic/diastolic, e.g. 120/80." };
    const [s, d] = [Number(m[1]), Number(m[2])];
    if (s >= 140 || d >= 90) return { note: "High" };
    if (s < 90 || d < 60) return { note: "Low" };
    return {};
  }
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return { bad: "Enter a number." };
  if (key === "hr" && (n > 100 || n < 50)) return { note: n > 100 ? "High" : "Low" };
  if (key === "temp_c") {
    if (n < 30 || n > 45) return { bad: "Check the temperature (°C)." };
    if (n >= 37.5) return { note: "Fever" };
  }
  if (key === "weight_kg" && n > 400) return { bad: "Check the weight (kg)." };
  return {};
}

export default function VisitForm({
  appointmentId, meds, labs, conditions,
}: { appointmentId: string; meds: Med[]; labs: Lab[]; conditions: Cond[] }) {
  const id = useId();
  const router = useRouter();
  const [vitals, setVitals] = useState<Record<VitalKey, string>>({ bp: "", hr: "", temp_c: "", weight_kg: "" });
  const [chief, setChief] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [notes, setNotes] = useState("");
  const [rx, setRx] = useState<RxPick[]>([]);
  const [lab, setLab] = useState<LabPick[]>([]);
  const [cond, setCond] = useState<CondPick[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const vitalErrors = VITALS.map(v => vitalIssue(v.key, vitals[v.key]).bad).filter(Boolean);
  const hasContent = Boolean(chief.trim() || diagnosis.trim() || notes.trim() || rx.length || lab.length || cond.length
    || Object.values(vitals).some(v => v.trim()));

  const pickMed = (m: Med) => !rx.some(r => r.medication_id === m.id) && setRx([...rx, {
    medication_id: m.id, name: m.name,
    dosage: m.default_dosage ?? "", frequency: m.default_frequency ?? "", instructions: m.default_instructions ?? "",
  }]);
  const pickLab = (l: Lab) => !lab.some(x => x.lab_test_id === l.id) && setLab([...lab, { lab_test_id: l.id, name: l.name }]);
  const pickCond = (c: Cond) => !cond.some(x => x.condition_id === c.id) && setCond([...cond, { condition_id: c.id, name: c.name, status: "active" }]);
  const setRxField = (i: number, k: keyof RxPick, v: string) => setRx(rx.map((x, j) => j === i ? { ...x, [k]: v } : x));

  const requestComplete = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (vitalErrors.length) { setError("Fix the highlighted vitals first."); return; }
    if (!hasContent) { setError("Add at least a complaint, diagnosis, vitals or a note before completing."); return; }
    setConfirming(true);
  };

  const complete = () => {
    const v: Record<string, unknown> = {};
    if (vitals.bp.trim()) v.bp = vitals.bp.replace(/\s+/g, "");
    if (vitals.hr.trim()) v.hr = Number(vitals.hr);
    if (vitals.temp_c.trim()) v.temp_c = Number(vitals.temp_c);
    if (vitals.weight_kg.trim()) v.weight_kg = Number(vitals.weight_kg);
    start(async () => {
      const res = await completeVisitFull({
        appointment_id: appointmentId,
        chief_complaint: chief.trim() || undefined,
        diagnosis: diagnosis.trim() || undefined,
        vitals: Object.keys(v).length ? v : undefined,
        notes: notes.trim() || undefined,
        prescriptions: rx,
        labs: lab,
        conditions: cond,
      });
      setConfirming(false);
      if (!res.ok) { setError(res.error); return; }
      toast.success("Visit completed — medical record saved");
      router.refresh();
    });
  };

  const summary = [
    rx.length && `${rx.length} prescription${rx.length === 1 ? "" : "s"}`,
    lab.length && `${lab.length} lab${lab.length === 1 ? "" : "s"}`,
    cond.length && `${cond.length} condition${cond.length === 1 ? "" : "s"}`,
  ].filter(Boolean).join(" · ");

  return (
    <form onSubmit={requestComplete} className="grid gap-4" aria-busy={busy}>
      {/* ---- Vitals ---- */}
      <Card>
        <SectionHead icon={<ActivityIcon />} title="Vitals" desc="Optional. Values outside the usual adult range are flagged." />
        <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {VITALS.map(f => {
            const issue = vitalIssue(f.key, vitals[f.key]);
            return (
              <div key={f.key} className="grid content-start gap-2">
                <Label htmlFor={`${id}-${f.key}`} className="justify-between">
                  {f.label}
                  {issue.note && <span className="text-xs font-medium text-(--warning)">{issue.note}</span>}
                </Label>
                <div className="relative">
                  <Input id={`${id}-${f.key}`} value={vitals[f.key]} inputMode={f.inputMode} placeholder={f.placeholder}
                    onChange={e => setVitals({ ...vitals, [f.key]: e.target.value })}
                    aria-invalid={issue.bad ? true : undefined}
                    className={cn("pr-12 tabular-nums", issue.note && "border-(--warning)/60")} />
                  <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-muted-foreground">
                    {f.unit}
                  </span>
                </div>
                {issue.bad && <p className="text-xs text-destructive">{issue.bad}</p>}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* ---- Assessment ---- */}
      <Card>
        <SectionHead icon={<StethoscopeIcon />} title="Assessment" />
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="grid content-start gap-2">
            <Label htmlFor={`${id}-chief`}>Chief complaint</Label>
            <Textarea id={`${id}-chief`} rows={3} value={chief} onChange={e => setChief(e.target.value)}
              placeholder="In the patient’s words, e.g. cough for 5 days, worse at night" />
          </div>
          <div className="grid content-start gap-2">
            <Label htmlFor={`${id}-dx`}>Diagnosis</Label>
            <Textarea id={`${id}-dx`} rows={3} value={diagnosis} onChange={e => setDiagnosis(e.target.value)}
              placeholder="e.g. Acute upper respiratory infection" />
          </div>
        </CardContent>
      </Card>

      {/* ---- Problem list ---- */}
      <Card>
        <SectionHead icon={<ListChecksIcon />} title="Problem list" desc="Adds or updates conditions on the patient’s chart." count={cond.length} />
        <CardContent className="grid gap-3">
          <Picker noun="condition" library={conditions} picked={cond.map(c => c.name)}
            onPick={c => pickCond(c)} onCustom={name => setCond([...cond, { name, status: "active" }])} />
          {cond.map((c, i) => (
            <div key={`${c.name}-${i}`} className="flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2">
              <span className="flex-1 font-medium">{c.name}</span>
              <ToggleGroup type="single" variant="outline" size="sm" value={c.status}
                onValueChange={(v: string) => v && setCond(cond.map((x, j) => j === i ? { ...x, status: v as CondPick["status"] } : x))}
                aria-label={`${c.name} status`}>
                <ToggleGroupItem value="active">Active</ToggleGroupItem>
                <ToggleGroupItem value="resolved">Resolved</ToggleGroupItem>
              </ToggleGroup>
              <RemoveButton label={c.name} onClick={() => setCond(cond.filter((_, j) => j !== i))} />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ---- Prescriptions ---- */}
      <Card>
        <SectionHead icon={<PillIcon />} title="Prescriptions" desc="Picking from the library prefills dosage and instructions." count={rx.length} />
        <CardContent className="grid gap-3">
          <Picker noun="medication" library={meds} picked={rx.map(r => r.name)}
            onPick={m => pickMed(m)} onCustom={name => setRx([...rx, { name }])} />
          {rx.map((r, i) => (
            <div key={`${r.name}-${i}`} className="grid gap-3 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 font-medium"><PillIcon className="size-4 text-primary" />{r.name}</span>
                <RemoveButton label={r.name} onClick={() => setRx(rx.filter((_, j) => j !== i))} />
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {([
                  ["dosage", "Dosage", "500 mg"],
                  ["frequency", "Frequency", "3× a day"],
                  ["duration", "Duration", "7 days"],
                  ["instructions", "Instructions", "After meals"],
                ] as const).map(([k, label, ph]) => (
                  <div key={k} className="grid content-start gap-1.5">
                    <Label htmlFor={`${id}-rx${i}-${k}`} className="text-xs text-muted-foreground">{label}</Label>
                    <Input id={`${id}-rx${i}-${k}`} value={r[k] ?? ""} placeholder={ph}
                      onChange={e => setRxField(i, k, e.target.value)} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ---- Labs ---- */}
      <Card>
        <SectionHead icon={<FlaskConicalIcon />} title="Lab orders" desc="Results can be attached to each order later." count={lab.length} />
        <CardContent className="grid gap-3">
          <Picker noun="lab test" library={labs} picked={lab.map(l => l.name)}
            onPick={l => pickLab(l)} onCustom={name => setLab([...lab, { name }])} />
          {lab.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {lab.map((l, i) => (
                <Badge variant="info" key={`${l.name}-${i}`} className="h-6 pr-1">
                  <FlaskConicalIcon />{l.name}
                  <Button type="button" variant="ghost" size="icon-xs" onClick={() => setLab(lab.filter((_, j) => j !== i))}
                    aria-label={`Remove ${l.name}`} className="size-4 rounded-full hover:bg-primary/15"><XIcon /></Button>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---- Notes ---- */}
      <Card>
        <SectionHead icon={<NotebookPenIcon />} title="Notes" desc="Plan, advice and follow-up. Not shown to the patient." />
        <CardContent>
          <Textarea id={`${id}-notes`} aria-label="Notes" rows={4} value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="e.g. Increase fluids. Return in 1 week or sooner if fever persists." />
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
          <AlertCircleIcon />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* ---- Sticky action bar ---- */}
      <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-3 rounded-xl border bg-card/95 px-4 py-3 shadow-lg backdrop-blur">
        <ClipboardPenLineIcon className="size-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{summary || "Nothing prescribed or ordered yet"}</span>
        <Button type="submit" className="ml-auto" disabled={busy}>
          {busy ? <><Spinner /> Saving…</> : <><CheckIcon /> Complete visit</>}
        </Button>
      </div>

      <AlertDialog open={confirming} onOpenChange={o => !busy && setConfirming(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete this visit?</AlertDialogTitle>
            <AlertDialogDescription>
              This writes the medical record{summary ? ` (${summary})` : ""} and closes the visit. It can’t be edited afterwards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Keep editing</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={e => { e.preventDefault(); complete(); }}>
              {busy ? <><Spinner /> Saving…</> : "Complete visit"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}

function SectionHead({ icon, title, desc, count }: { icon: React.ReactNode; title: string; desc?: string; count?: number }) {
  return (
    <CardHeader>
      <div className="flex items-start gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary [&>svg]:size-4">{icon}</div>
        <div className="grid gap-1">
          <CardTitle className="flex items-center gap-2">
            {title}
            {count ? <Badge variant="info" className="h-4.5 px-1.5 tabular-nums">{count}</Badge> : null}
          </CardTitle>
          {desc && <CardDescription>{desc}</CardDescription>}
        </div>
      </div>
    </CardHeader>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button type="button" variant="ghost" size="icon-sm" onClick={onClick} aria-label={`Remove ${label}`}
      className="text-muted-foreground hover:text-destructive"><XIcon /></Button>
  );
}

// Library chips filtered by a search box; Enter (or "Add") picks the exact
// match from the library, otherwise adds the typed text as a custom item.
function Picker<T extends { id: string; name: string }>({
  noun, library, picked, onPick, onCustom,
}: {
  noun: string; library: T[]; picked: string[]; onPick: (item: T) => void; onCustom: (name: string) => void;
}) {
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const shown = useMemo(
    () => (term ? library.filter(i => i.name.toLowerCase().includes(term)) : library),
    [library, term],
  );
  const exact = library.find(i => i.name.toLowerCase() === term);
  const already = picked.some(p => p.toLowerCase() === term);

  const add = () => {
    if (!term || already) return;
    if (exact) onPick(exact);
    else onCustom(q.trim());
    setQ("");
  };

  return (
    <div className="grid gap-2">
      <div className="flex gap-2">
        <Input value={q} onChange={e => setQ(e.target.value)} placeholder={`Search or add a ${noun}…`}
          aria-label={`Search or add a ${noun}`}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }} className="max-w-sm" />
        <Button type="button" variant="outline" onClick={add} disabled={!term || already}>
          <PlusIcon /> {exact || !term ? "Add" : `Add “${q.trim()}”`}
        </Button>
      </div>
      {library.length === 0 ? (
        <p className="text-xs text-muted-foreground">No quick picks yet — an admin can add them under Library. Type to add one now.</p>
      ) : shown.length === 0 ? (
        <p className="text-xs text-muted-foreground">No library match. Press Enter to add “{q.trim()}”.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {shown.map(item => {
            const isPicked = picked.includes(item.name);
            return (
              <Badge key={item.id} asChild variant={isPicked ? "info" : "outline"}>
                <button type="button" onClick={() => onPick(item)} disabled={isPicked}
                  className={isPicked ? "cursor-default" : "cursor-pointer hover:bg-muted"}>
                  {item.name}{isPicked && <CheckIcon />}
                </button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}
