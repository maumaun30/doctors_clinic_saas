"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircleIcon, PlusIcon } from "lucide-react";
import { linkDoctorClinic, updateDoctor } from "@/lib/actions/doctors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";

/** Name, specialization and PRC license, saved together. */
export function DoctorProfileForm({ doctor }: {
  doctor: { profile_id: string; full_name: string; specialization: string | null; prc_license_no: string | null };
}) {
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
      const res = await updateDoctor(doctor.profile_id, {
        full_name: String(f.get("full_name") ?? ""),
        specialization: String(f.get("specialization") ?? ""),
        prc_license_no: String(f.get("prc_license_no") ?? ""),
      });
      if (!res.ok) { setError({ text: res.error, field: res.field }); return; }
      setDirty(false);
      toast.success("Doctor details saved");
      router.refresh();
    });
  };

  const bad = (f: string) => error?.field === f || undefined;
  return (
    <form onSubmit={submit} onChange={() => setDirty(true)} className="grid gap-4" aria-busy={pending}>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="grid content-start gap-2">
          <Label htmlFor={`${id}-name`}>Full name</Label>
          <Input id={`${id}-name`} name="full_name" defaultValue={doctor.full_name} required aria-invalid={bad("full_name")} />
        </div>
        <div className="grid content-start gap-2">
          <Label htmlFor={`${id}-spec`}>Specialization</Label>
          <Input id={`${id}-spec`} name="specialization" defaultValue={doctor.specialization ?? ""}
            placeholder="e.g. Internal Medicine" aria-invalid={bad("specialization")} />
        </div>
        <div className="grid content-start gap-2">
          <Label htmlFor={`${id}-prc`}>PRC license no.</Label>
          <Input id={`${id}-prc`} name="prc_license_no" defaultValue={doctor.prc_license_no ?? ""}
            placeholder="e.g. 0123456" aria-invalid={bad("prc_license_no")} />
        </div>
      </div>
      {error && (
        <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
          <AlertCircleIcon /><AlertDescription>{error.text}</AlertDescription>
        </Alert>
      )}
      <div className="flex items-center justify-end gap-3">
        <span className="text-xs text-muted-foreground">Shown on the booking page and printed prescriptions.</span>
        <Button type="submit" disabled={pending || !dirty}>{pending ? <><Spinner /> Saving…</> : "Save changes"}</Button>
      </div>
    </form>
  );
}

/** Pick a clinic and pair the doctor with it. */
export function AddClinic({ doctorId, clinics }: { doctorId: string; clinics: { id: string; name: string }[] }) {
  const router = useRouter();
  const [clinic, setClinic] = useState("");
  const [pending, start] = useTransition();
  if (clinics.length === 0) return null;
  return (
    <div className="flex gap-2">
      <NativeSelect value={clinic} onChange={e => setClinic(e.target.value)} aria-label="Clinic to add" className="w-56">
        <NativeSelectOption value="" disabled>Add to a clinic…</NativeSelectOption>
        {clinics.map(c => <NativeSelectOption key={c.id} value={c.id}>{c.name}</NativeSelectOption>)}
      </NativeSelect>
      <Button variant="outline" disabled={!clinic || pending} onClick={() => start(async () => {
        const res = await linkDoctorClinic(doctorId, clinic);
        if (!res.ok) { toast.error(res.error); return; }
        toast.success(`Added to ${clinics.find(c => c.id === clinic)?.name}`);
        setClinic("");
        router.refresh();
      })}>
        {pending ? <Spinner /> : <PlusIcon />} Add
      </Button>
    </div>
  );
}
