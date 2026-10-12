"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircleIcon, PencilIcon, StethoscopeIcon } from "lucide-react";
import { updateDoctor } from "@/lib/actions/doctors";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";

export function DoctorDialog({ doctor }: {
  doctor: { profile_id: string; name: string; specialization: string | null; prc_license_no: string | null };
}) {
  const id = useId();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<{ text: string; field?: string } | null>(null);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const res = await updateDoctor(doctor.profile_id, {
        specialization: String(f.get("specialization") ?? ""),
        prc_license_no: String(f.get("prc_license_no") ?? ""),
      });
      if (!res.ok) { setError({ text: res.error, field: res.field }); return; }
      setOpen(false);
      toast.success(`${doctor.name} updated`);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!pending) { setOpen(o); if (!o) setError(null); } }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Edit ${doctor.name}`} title="Edit"><PencilIcon /></Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="flex-row items-center gap-3 text-left">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <StethoscopeIcon className="size-5" />
          </div>
          <div className="grid gap-1">
            <DialogTitle>{doctor.name}</DialogTitle>
            <DialogDescription>Shown to patients on the booking page and on printed prescriptions.</DialogDescription>
          </div>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4" aria-busy={pending}>
          <div className="grid content-start gap-2">
            <Label htmlFor={`${id}-spec`}>Specialization</Label>
            <Input id={`${id}-spec`} name="specialization" defaultValue={doctor.specialization ?? ""}
              placeholder="e.g. Internal Medicine" aria-invalid={error?.field === "specialization" || undefined} />
          </div>
          <div className="grid content-start gap-2">
            <Label htmlFor={`${id}-prc`}>PRC license no.</Label>
            <Input id={`${id}-prc`} name="prc_license_no" defaultValue={doctor.prc_license_no ?? ""}
              placeholder="e.g. 0123456" aria-invalid={error?.field === "prc_license_no" || undefined} />
            <p className="text-xs text-muted-foreground">Printed on prescriptions. Must be unique.</p>
          </div>
          {error && (
            <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
              <AlertCircleIcon /><AlertDescription>{error.text}</AlertDescription>
            </Alert>
          )}
          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? <><Spinner /> Saving…</> : "Save changes"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
