"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircleIcon, MailPlusIcon, RotateCwIcon, ShieldIcon, StethoscopeIcon, UserRoundIcon } from "lucide-react";
import { inviteStaff, resendInvite } from "@/lib/actions/invites";
import { approveUser } from "@/lib/actions/admin";
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

type Role = "secretary" | "doctor" | "admin";
const ROLES: { value: Role; label: string; icon: typeof ShieldIcon; desc: string }[] = [
  { value: "secretary", label: "Secretary", icon: UserRoundIcon, desc: "Books and manages appointments for the doctors you assign. No medical records." },
  { value: "doctor", label: "Doctor", icon: StethoscopeIcon, desc: "Sees patients, writes visit records and prescriptions. Adds a billing seat." },
  { value: "admin", label: "Admin", icon: ShieldIcon, desc: "Full access, including clinics, staff and billing." },
];

export function InviteDialog({ defaultRole = "secretary", openOnLoad = false }: { defaultRole?: Role; openOnLoad?: boolean }) {
  const id = useId();
  const router = useRouter();
  const [open, setOpen] = useState(openOnLoad);
  const [role, setRole] = useState<Role>(defaultRole);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    f.set("role", role);
    setError(null);
    start(async () => {
      const res = await inviteStaff(null, f);
      if (!res.ok) { setError(res.message); return; }
      setOpen(false);
      toast.success(res.message);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!pending) { setOpen(o); if (!o) setError(null); } }}>
      <DialogTrigger asChild><Button><MailPlusIcon /> Invite staff</Button></DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="flex-row items-center gap-3 text-left">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <MailPlusIcon className="size-5" />
          </div>
          <div className="grid gap-1">
            <DialogTitle>Invite staff</DialogTitle>
            <DialogDescription>They get an email link and land in the app with this role. Invites expire after 7 days.</DialogDescription>
          </div>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4" aria-busy={pending}>
          <div className="grid content-start gap-2">
            <Label htmlFor={`${id}-email`}>Email</Label>
            <Input id={`${id}-email`} name="email" type="email" required autoFocus autoComplete="off" placeholder="name@clinic.ph" />
          </div>
          <div className="grid gap-2" role="radiogroup" aria-label="Role">
            <Label>Role</Label>
            {ROLES.map(r => (
              <button key={r.value} type="button" role="radio" aria-checked={role === r.value} onClick={() => setRole(r.value)}
                className={cn("flex items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  role === r.value ? "border-primary bg-primary/5" : "hover:bg-muted/50")}>
                <r.icon className={cn("mt-0.5 size-4 shrink-0", role === r.value ? "text-primary" : "text-muted-foreground")} />
                <span className="grid gap-0.5">
                  <span className="text-sm font-medium">{r.label}</span>
                  <span className="text-xs text-muted-foreground">{r.desc}</span>
                </span>
              </button>
            ))}
          </div>
          {error && (
            <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
              <AlertCircleIcon /><AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? <><Spinner /> Sending…</> : "Send invite"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ResendButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button variant="outline" size="sm" disabled={pending} onClick={() => start(async () => {
      const res = await resendInvite(id);
      if (res.ok) { toast.success(res.message); router.refresh(); } else toast.error(res.message);
    })}>
      {pending ? <Spinner /> : <RotateCwIcon />} Resend
    </Button>
  );
}

/** Role picker + "Give access" for someone who signed in without an invite. */
export function ApproveControls({ userId, name }: { userId: string; name: string }) {
  const router = useRouter();
  const [role, setRole] = useState<Role>("secretary");
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-2">
      <NativeSelect value={role} onChange={e => setRole(e.target.value as Role)} aria-label={`Role for ${name}`} className="w-36">
        {ROLES.map(r => <NativeSelectOption key={r.value} value={r.value}>{r.label}</NativeSelectOption>)}
      </NativeSelect>
      <Button size="sm" disabled={pending} onClick={() => start(async () => {
        const res = await approveUser(userId, role);
        if (res.ok) { toast.success(`${name} can now sign in as ${role}`); router.refresh(); } else toast.error(res.error);
      })}>
        {pending ? <Spinner /> : null} Give access
      </Button>
    </div>
  );
}
