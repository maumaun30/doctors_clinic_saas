"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircleIcon, PencilIcon, PlusIcon, SearchIcon, Trash2Icon } from "lucide-react";
import { saveLibraryItem, deleteLibraryItem, type LibraryKind } from "@/lib/actions/library";
import { ConfirmAction } from "@/app/_components/confirm-action";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Field = { key: string; label: string; placeholder: string; long?: boolean; mono?: boolean; half?: boolean };
type Config = { noun: string; nameLabel: string; namePlaceholder: string; hint: string; fields: Field[] };

const CONFIG: Record<LibraryKind, Config> = {
  meds: {
    noun: "medication", nameLabel: "Medication", namePlaceholder: "e.g. Amoxicillin",
    hint: "Defaults prefill the prescription when a doctor picks this medication; they can still change them per visit.",
    fields: [
      { key: "default_dosage", label: "Default dosage", placeholder: "500 mg", half: true },
      { key: "default_frequency", label: "Default frequency", placeholder: "3× a day", half: true },
      { key: "default_instructions", label: "Default instructions", placeholder: "Take after meals. Finish the course.", long: true },
    ],
  },
  labs: {
    noun: "lab test", nameLabel: "Lab test", namePlaceholder: "e.g. CBC",
    hint: "Doctors order these in one tap during a visit.",
    fields: [{ key: "description", label: "Description", placeholder: "e.g. Complete blood count", long: true }],
  },
  conds: {
    noun: "condition", nameLabel: "Condition", namePlaceholder: "e.g. Hypertension",
    hint: "Used for the patient problem list. Adding an ICD-10 code helps reporting.",
    fields: [{ key: "icd_code", label: "ICD-10 code", placeholder: "e.g. I10", mono: true }],
  },
};

type Item = { id: string; name: string } & Record<string, string | null>;

export function LibraryList({ kind, items }: { kind: LibraryKind; items: Item[] }) {
  const cfg = CONFIG[kind];
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Item | "new" | null>(null);
  const term = q.trim().toLowerCase();
  const shown = useMemo(() => term
    ? items.filter(i => [i.name, ...cfg.fields.map(f => i[f.key])].some(v => v?.toLowerCase().includes(term)))
    : items, [items, term, cfg.fields]);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1 sm:max-w-xs">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder={`Search ${cfg.noun}s`}
            aria-label={`Search ${cfg.noun}s`} className="pl-8" />
        </div>
        <p className="hidden flex-1 text-xs text-muted-foreground md:block">{cfg.hint}</p>
        <Button onClick={() => setEditing("new")}><PlusIcon /> Add {cfg.noun}</Button>
      </div>

      <div className="card table-wrap">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{cfg.nameLabel}</TableHead>
              {cfg.fields.map(f => <TableHead key={f.key} className={f.long ? "hidden md:table-cell" : ""}>{f.label.replace(/^Default (\w)/, (_, c: string) => c.toUpperCase())}</TableHead>)}
              <TableHead className="w-20"><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map(i => (
              <TableRow key={i.id}>
                <TableCell className="font-medium">{i.name}</TableCell>
                {cfg.fields.map(f => (
                  <TableCell key={f.key} className={[f.long ? "hidden max-w-80 truncate md:table-cell" : "", f.mono ? "font-mono text-xs" : ""].join(" ")}
                    title={f.long ? i[f.key] ?? undefined : undefined}>
                    {i[f.key] ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                ))}
                <TableCell className="text-right">
                  <div className="flex justify-end gap-0.5">
                    <Button variant="ghost" size="icon-sm" onClick={() => setEditing(i)} aria-label={`Edit ${i.name}`}><PencilIcon /></Button>
                    <ConfirmAction action={deleteLibraryItem} fields={{ kind, id: i.id }} label={<Trash2Icon />}
                      size="icon-sm" triggerTitle={`Delete ${i.name}`}
                      title={`Delete ${i.name}?`}
                      description="It’s removed from quick picks. Past visits keep their own copy, so no records change."
                      confirmLabel="Delete" success={`${i.name} deleted`}
                      error="Couldn’t delete. Please try again." />
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {shown.length === 0 && (
              <TableRow>
                <TableCell colSpan={cfg.fields.length + 2} className="py-10 text-center text-sm text-muted-foreground">
                  {term ? <>No {cfg.noun}s match “{q.trim()}”.</> : <>No {cfg.noun}s yet — add the ones your doctors use most.</>}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {editing && (
        <ItemDialog kind={kind} cfg={cfg} item={editing === "new" ? null : editing}
          defaultName={editing === "new" ? q.trim() : undefined} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function ItemDialog({ kind, cfg, item, defaultName, onClose }: {
  kind: LibraryKind; cfg: Config; item: Item | null; defaultName?: string; onClose: () => void;
}) {
  const id = useId();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<{ text: string; field?: string } | null>(null);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const values = Object.fromEntries(["name", ...cfg.fields.map(x => x.key)].map(k => [k, String(f.get(k) ?? "")]));
    setError(null);
    start(async () => {
      const res = await saveLibraryItem(kind, item?.id ?? null, values);
      if (!res.ok) { setError({ text: res.error, field: res.field }); return; }
      toast.success(item ? `${values.name} saved` : `${values.name} added`);
      onClose();
      router.refresh();
    });
  };

  return (
    <Dialog open onOpenChange={o => { if (!o && !pending) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{item ? `Edit ${item.name}` : `Add ${cfg.noun}`}</DialogTitle>
          <DialogDescription>{cfg.hint}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4" aria-busy={pending}>
          <div className="grid content-start gap-2">
            <Label htmlFor={`${id}-name`}>{cfg.nameLabel}</Label>
            <Input id={`${id}-name`} name="name" defaultValue={item?.name ?? defaultName} placeholder={cfg.namePlaceholder}
              required autoFocus aria-invalid={error?.field === "name" || undefined} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {cfg.fields.map(f => (
              <div key={f.key} className={`grid content-start gap-2 ${f.half ? "" : "col-span-2"}`}>
                <Label htmlFor={`${id}-${f.key}`}>{f.label} <span className="font-normal text-muted-foreground">(optional)</span></Label>
                {f.long
                  ? <Textarea id={`${id}-${f.key}`} name={f.key} rows={2} defaultValue={item?.[f.key] ?? ""} placeholder={f.placeholder}
                      aria-invalid={error?.field === f.key || undefined} />
                  : <Input id={`${id}-${f.key}`} name={f.key} defaultValue={item?.[f.key] ?? ""} placeholder={f.placeholder}
                      className={f.mono ? "font-mono uppercase" : undefined} aria-invalid={error?.field === f.key || undefined} />}
              </div>
            ))}
          </div>
          {error && (
            <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
              <AlertCircleIcon /><AlertDescription>{error.text}</AlertDescription>
            </Alert>
          )}
          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? <><Spinner /> Saving…</> : item ? "Save changes" : `Add ${cfg.noun}`}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
