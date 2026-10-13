import Link from "next/link";
import { CheckIcon, ArrowRightIcon } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChecklistToggle } from "./checklist-toggle";

type Step = { key: string; title: string; desc: string; href: string; cta: string; done: boolean; optional?: boolean };

/**
 * "Get your clinic ready" (admins, on Today). Each step's progress comes
 * from the account's own data; the card disappears once every step is
 * done, or when an admin hides it (stored per account, migration 0033).
 */
export async function SetupChecklist({ sb }: { sb: SupabaseClient }) {
  const count = (table: string, build?: (q: any) => any) => {
    let q = sb.from(table).select("*", { count: "exact", head: true });
    if (build) q = build(q);
    return q.then((r: { count: number | null }) => r.count ?? 0);
  };
  const [account, clinics, onlineClinics, doctors, secretaries, hours, meds, billing] = await Promise.all([
    sb.from("accounts").select("setup_checklist_hidden_at").maybeSingle(),
    count("clinics"),
    count("clinics", q => q.eq("online_booking", true)),
    count("staff_profiles", q => q.eq("role", "doctor").eq("active", true)),
    count("staff_profiles", q => q.eq("role", "secretary").eq("active", true)),
    count("doctor_availability"),
    count("common_medications"),
    sb.rpc("my_billing_status"),
  ]);
  if (account.data?.setup_checklist_hidden_at) return null;
  const sub = billing.data?.[0]?.subscription_status ?? "";

  const steps: Step[] = [
    { key: "clinic", title: "Add your clinic", desc: "Name, address and phone. Add more clinics any time.",
      href: "/admin/clinics", cta: "Add clinic", done: clinics > 0 },
    { key: "doctors", title: "Invite your doctors", desc: "They get the Doctor role when they sign in with the invited email.",
      href: "/admin/users?role=doctor", cta: "Invite doctors", done: doctors > 0 },
    { key: "hours", title: "Set each doctor’s clinic and weekly hours", desc: "Only these hours can be booked, by staff or online.",
      href: "/admin/doctors", cta: "Set hours", done: hours > 0 },
    { key: "secretary", title: "Invite a secretary", desc: "Secretaries book and manage appointments for the doctors they support.",
      href: "/admin/users?role=secretary", cta: "Invite secretary", done: secretaries > 0, optional: true },
    { key: "library", title: "Add medication and lab quick picks", desc: "Doctors pick them during visits; dosage and instructions fill in.",
      href: "/admin/library", cta: "Open library", done: meds > 0, optional: true },
    { key: "online", title: "Turn on online booking", desc: "Patients book open times from a link you share on Facebook or Viber.",
      href: "/admin/clinics", cta: "Turn on", done: onlineClinics > 0, optional: true },
    { key: "billing", title: "Subscribe", desc: "Keep using the app after the free trial.",
      href: "/admin/billing", cta: "Subscribe", done: ["active", "trialing", "past_due"].includes(sub) },
  ];
  const doneCount = steps.filter(s => s.done).length;
  if (doneCount === steps.length) return null;
  const next = steps.find(s => !s.done && !s.optional) ?? steps.find(s => !s.done)!;

  return (
    <Card className="mb-5">
      <CardHeader>
        <CardTitle>Get your clinic ready</CardTitle>
        <CardDescription>{doneCount} of {steps.length} done. Only admins see this.</CardDescription>
        <CardAction><ChecklistToggle hide /></CardAction>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0}
          aria-valuemax={steps.length} aria-valuenow={doneCount} aria-label="Setup progress">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
        </div>
        <ol className="grid gap-1">
          {steps.map(s => {
            const isNext = s.key === next.key;
            return (
              <li key={s.key} className={cn("flex items-center gap-3 rounded-lg px-2 py-2", isNext && "bg-primary/5")}>
                <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full border text-xs",
                  s.done ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground")}>
                  {s.done ? <CheckIcon className="size-3.5" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("flex flex-wrap items-center gap-2 text-sm font-medium", s.done && "text-muted-foreground line-through")}>
                    {s.title}{s.optional && !s.done && <Badge variant="secondary">Optional</Badge>}
                  </span>
                  {!s.done && <span className="block text-xs text-muted-foreground">{s.desc}</span>}
                </span>
                {!s.done && (
                  <Button asChild size="sm" variant={isNext ? "default" : "ghost"}>
                    <Link href={s.href}>{s.cta}{isNext && <ArrowRightIcon />}</Link>
                  </Button>
                )}
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
