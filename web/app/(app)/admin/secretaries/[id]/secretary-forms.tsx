"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircleIcon, PlusIcon } from "lucide-react";
import { assignSecretary, updateSecretary } from "@/lib/actions/secretaries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";

/** Name and phone, saved together. */
export function SecretaryProfileForm({ secretary }: { secretary: { id: string; full_name: string; phone: string | null } }) {
  const id = useId();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<{ text: string; field?: string } | null>(null);
  const [dirty, setDirty] = useState(false);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const res = await updateSecretary(secretary.id, {
        full_name: String(f.get("full_name") ?? ""),
        phone: String(f.get("phone") ?? ""),
      });
      if (!res.ok) { setError({ text: res.error, field: res.field }); return; }
      setDirty(false);
      toast.success("Secretary details saved");
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} onChange={() => setDirty(true)} className="grid gap-4" aria-busy={pending}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid content-start gap-2">
          <Label htmlFor={`${id}-name`}>Full name</Label>
          <Input id={`${id}-name`} name="full_name" defaultValue={secretary.full_name} required
            aria-invalid={error?.field === "full_name" || undefined} />
        </div>
        <div className="grid content-start gap-2">
          <Label htmlFor={`${id}-phone`}>Mobile <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Input id={`${id}-phone`} name="phone" type="tel" defaultValue={secretary.phone ?? ""} placeholder="0917 123 4567"
            aria-invalid={error?.field === "phone" || undefined} />
        </div>
      </div>
      {error && (
        <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
          <AlertCircleIcon /><AlertDescription>{error.text}</AlertDescription>
        </Alert>
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending || !dirty}>{pending ? <><Spinner /> Saving…</> : "Save changes"}</Button>
      </div>
    </form>
  );
}

/** Pick a doctor@clinic pairing and assign the secretary to it. */
export function AddAssignment({ secretaryId, options }: {
  secretaryId: string; options: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [dc, setDc] = useState("");
  const [pending, start] = useTransition();
  if (options.length === 0) return null;
  return (
    <div className="flex gap-2">
      <NativeSelect value={dc} onChange={e => setDc(e.target.value)} aria-label="Doctor to support" className="w-64">
        <NativeSelectOption value="" disabled>Assign to a doctor…</NativeSelectOption>
        {options.map(o => <NativeSelectOption key={o.id} value={o.id}>{o.label}</NativeSelectOption>)}
      </NativeSelect>
      <Button variant="outline" disabled={!dc || pending} onClick={() => start(async () => {
        const res = await assignSecretary(secretaryId, dc);
        if (!res.ok) { toast.error(res.error); return; }
        toast.success(`Assigned to ${options.find(o => o.id === dc)?.label}`);
        setDc("");
        router.refresh();
      })}>
        {pending ? <Spinner /> : <PlusIcon />} Assign
      </Button>
    </div>
  );
}
