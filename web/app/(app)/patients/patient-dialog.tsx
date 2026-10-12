"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircleIcon, PencilIcon, UserPlusIcon } from "lucide-react";
import { createPatient, updatePatient, type PatientFields } from "@/lib/actions/patients";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { phYmd } from "@/lib/dates";

type Patient = {
  id: string; full_name: string; date_of_birth: string | null; sex: string | null;
  phone: string | null; email: string | null; address: string | null;
};
type Field = keyof PatientFields;

// Add-patient (no `patient`) or edit-demographics dialog. Adding opens the
// new patient's chart; editing refreshes in place.
export function PatientDialog({ patient, trigger }: { patient?: Patient; trigger?: React.ReactNode }) {
  const editing = Boolean(patient);
  const id = useId();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>({});

  const reset = (o: boolean) => {
    if (pending) return;
    setOpen(o);
    if (!o) { setError(null); setFieldErrors({}); }
  };

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const values = Object.fromEntries(
      (["full_name", "date_of_birth", "sex", "phone", "email", "address"] as Field[])
        .map(k => [k, String(f.get(k) ?? "")]),
    ) as PatientFields;
    setError(null);
    setFieldErrors({});
    start(async () => {
      const res = patient ? await updatePatient(patient.id, values) : await createPatient(values);
      if (!res.ok) {
        setError(res.error);
        setFieldErrors(res.fieldErrors ?? {});
        return;
      }
      setOpen(false);
      if (patient) {
        toast.success("Patient details saved");
        router.refresh();
      } else {
        toast.success(`${values.full_name} added`);
        router.push(`/patients/${res.id}`);
      }
    });
  };

  const field = (name: Field) => ({
    id: `${id}-${name}`,
    name,
    "aria-invalid": fieldErrors[name] ? true : undefined,
    "aria-describedby": fieldErrors[name] ? `${id}-${name}-err` : undefined,
  });
  const err = (name: Field) =>
    fieldErrors[name] && <p id={`${id}-${name}-err`} className="text-xs text-destructive">{fieldErrors[name]}</p>;

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger asChild>
        {trigger ?? (editing
          ? <Button variant="outline" size="sm"><PencilIcon /> Edit</Button>
          : <Button><UserPlusIcon /> Add patient</Button>)}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="flex-row items-center gap-3 text-left">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {editing ? <PencilIcon className="size-5" /> : <UserPlusIcon className="size-5" />}
          </div>
          <div className="grid gap-1">
            <DialogTitle>{editing ? "Edit patient details" : "Add patient"}</DialogTitle>
            <DialogDescription>
              {editing ? "Changes apply everywhere this patient appears."
                : "Adds the patient to the active clinic. A mobile number or email enables reminders."}
            </DialogDescription>
          </div>
        </DialogHeader>

        <form onSubmit={submit} className="grid gap-4" noValidate aria-busy={pending}>
          <div className="grid content-start gap-2">
            <Label htmlFor={`${id}-full_name`}>Full name</Label>
            <Input {...field("full_name")} defaultValue={patient?.full_name} placeholder="e.g. Maria Santos"
              autoComplete="off" autoFocus required />
            {err("full_name")}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid content-start gap-2">
              <Label htmlFor={`${id}-date_of_birth`}>Date of birth</Label>
              <Input {...field("date_of_birth")} type="date" max={phYmd()} defaultValue={patient?.date_of_birth ?? ""} />
              {err("date_of_birth")}
            </div>
            <div className="grid content-start gap-2">
              <Label htmlFor={`${id}-sex`}>Sex</Label>
              <NativeSelect {...field("sex")} defaultValue={patient?.sex ?? ""} className="w-full">
                <NativeSelectOption value="">Not specified</NativeSelectOption>
                <NativeSelectOption value="female">Female</NativeSelectOption>
                <NativeSelectOption value="male">Male</NativeSelectOption>
                <NativeSelectOption value="other">Other</NativeSelectOption>
              </NativeSelect>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid content-start gap-2">
              <Label htmlFor={`${id}-phone`}>Mobile</Label>
              <Input {...field("phone")} type="tel" inputMode="tel" defaultValue={patient?.phone ?? ""}
                placeholder="0917 123 4567" autoComplete="off" />
              {err("phone")}
            </div>
            <div className="grid content-start gap-2">
              <Label htmlFor={`${id}-email`}>Email <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Input {...field("email")} type="email" defaultValue={patient?.email ?? ""}
                placeholder="name@example.com" autoComplete="off" />
              {err("email")}
            </div>
          </div>

          <div className="grid content-start gap-2">
            <Label htmlFor={`${id}-address`}>Address <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Input {...field("address")} defaultValue={patient?.address ?? ""} placeholder="Street, barangay, city"
              autoComplete="off" />
            {err("address")}
          </div>

          {error && (
            <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
              <AlertCircleIcon />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={() => reset(false)} disabled={pending}>Cancel</Button>
            <Button type="submit" disabled={pending} className={cn(pending && "pointer-events-none")}>
              {pending ? <><Spinner /> Saving…</> : editing ? "Save changes" : "Add patient"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
