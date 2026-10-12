"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircleIcon, BuildingIcon, CheckIcon, CopyIcon, GlobeIcon, PencilIcon, PlusIcon } from "lucide-react";
import { addClinic, updateClinic, updateClinicBooking } from "@/lib/actions/clinics";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";

type Clinic = { id: string; name: string; address: string | null; online_booking: boolean; booking_slug: string | null };

const toSlug = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+/, "").slice(0, 60);

function Head({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <DialogHeader className="flex-row items-center gap-3 text-left">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary [&>svg]:size-5">{icon}</div>
      <div className="grid gap-1">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{desc}</DialogDescription>
      </div>
    </DialogHeader>
  );
}

function Err({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
      <AlertCircleIcon /><AlertDescription>{text}</AlertDescription>
    </Alert>
  );
}

/** Add a clinic (no `clinic`) or edit its name/address. */
export function ClinicDialog({ clinic }: { clinic?: Clinic }) {
  const id = useId();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const values = { name: String(f.get("name") ?? ""), address: String(f.get("address") ?? "") };
    setError(null);
    start(async () => {
      const res = clinic ? await updateClinic(clinic.id, values) : await addClinic(values);
      if (!res.ok) { setError(res.error); return; }
      setOpen(false);
      toast.success(clinic ? "Clinic saved" : `${values.name} added`);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!pending) { setOpen(o); if (!o) setError(null); } }}>
      <DialogTrigger asChild>
        {clinic
          ? <Button variant="outline" size="sm"><PencilIcon /> Edit</Button>
          : <Button><PlusIcon /> Add clinic</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <Head icon={clinic ? <PencilIcon /> : <BuildingIcon />}
          title={clinic ? "Edit clinic" : "Add clinic"}
          desc={clinic ? "Shown in the clinic switcher, booking page and reminders."
            : "Each clinic has its own doctors, secretaries, patients and booking link."} />
        <form onSubmit={submit} className="grid gap-4" aria-busy={pending}>
          <div className="grid content-start gap-2">
            <Label htmlFor={`${id}-name`}>Name</Label>
            <Input id={`${id}-name`} name="name" defaultValue={clinic?.name} placeholder="e.g. Northside Clinic" required autoFocus />
          </div>
          <div className="grid content-start gap-2">
            <Label htmlFor={`${id}-address`}>Address <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Input id={`${id}-address`} name="address" defaultValue={clinic?.address ?? ""} placeholder="Building, street, city" />
          </div>
          <Err text={error} />
          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
            <Button type="submit" disabled={pending}>
              {pending ? <><Spinner /> Saving…</> : clinic ? "Save changes" : "Add clinic"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Online booking switch + public link. */
export function BookingDialog({ clinic, origin }: { clinic: Clinic; origin: string }) {
  const id = useId();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [on, setOn] = useState(clinic.online_booking);
  const [slug, setSlug] = useState(clinic.booking_slug ?? toSlug(clinic.name).replace(/-+$/, ""));
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const clean = slug.replace(/-+$/, "");
  const valid = /^[a-z0-9]+(-[a-z0-9]+)*$/.test(clean) && clean.length >= 3;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await updateClinicBooking(clinic.id, { online_booking: on, booking_slug: clean || null });
      if (!res.ok) { setError(res.error); return; }
      setOpen(false);
      toast.success(on ? "Online booking is on" : "Online booking settings saved");
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!pending) { setOpen(o); if (!o) setError(null); } }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><GlobeIcon /> Online booking</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <Head icon={<GlobeIcon />} title="Online booking" desc={`Let patients book open slots at ${clinic.name} without an account.`} />
        <form onSubmit={submit} className="grid gap-4" aria-busy={pending}>
          <label htmlFor={`${id}-on`} className="flex items-center justify-between gap-4 rounded-lg border px-3 py-3">
            <span className="grid gap-0.5">
              <span className="text-sm font-medium">Accept online bookings</span>
              <span className="text-xs text-muted-foreground">Only times inside doctors’ working hours are offered.</span>
            </span>
            <Switch id={`${id}-on`} checked={on} onCheckedChange={setOn} />
          </label>
          <div className="grid content-start gap-2">
            <Label htmlFor={`${id}-slug`}>Booking link</Label>
            <div className="flex">
              <span className="flex max-w-[55%] items-center truncate rounded-l-lg border border-r-0 bg-muted px-2.5 text-sm text-muted-foreground">
                {origin.replace(/^https?:\/\//, "")}/book/
              </span>
              <Input id={`${id}-slug`} value={slug} onChange={e => setSlug(toSlug(e.target.value))}
                aria-invalid={!valid || undefined} className="flex-1 rounded-l-none" placeholder="main-clinic" />
            </div>
            <p className={valid ? "text-xs text-muted-foreground" : "text-xs text-destructive"}>
              {valid ? "Lowercase letters, numbers and dashes. Changing it breaks links you’ve already shared."
                : "At least 3 characters: lowercase letters, numbers and single dashes."}
            </p>
          </div>
          <Err text={error} />
          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
            <Button type="submit" disabled={pending || (!valid && on)}>
              {pending ? <><Spinner /> Saving…</> : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button type="button" variant="ghost" size="icon-sm" aria-label="Copy booking link" title="Copy link"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          toast.success("Booking link copied");
          setTimeout(() => setCopied(false), 1500);
        } catch { toast.error("Couldn’t copy — select the link and copy it manually."); }
      }}>
      {copied ? <CheckIcon /> : <CopyIcon />}
    </Button>
  );
}
