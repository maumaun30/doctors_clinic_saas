import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { StethoscopeIcon, XIcon } from "lucide-react";
import { PageHeader } from "@/app/_components/page-header";
import { Icon } from "@/app/_components/icons";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/data/queries";
import { ConfirmAction } from "@/app/_components/confirm-action";
import { unassignSecretary } from "@/lib/actions/secretaries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AddAssignment, SecretaryProfileForm } from "./secretary-forms";

const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join("") || "?";

export default async function SecretaryDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const me = await getMyProfile(sb);
  if (me?.role !== "admin") redirect("/today");

  const [secRes, caRes, dcRes] = await Promise.all([
    sb.from("profiles").select("id, full_name, phone").eq("id", id).eq("role", "secretary").maybeSingle(),
    sb.from("clinic_assignments").select("id, doctor_clinic_id").eq("secretary_id", id),
    sb.from("doctor_clinics").select("id, doctor:doctors!inner(profiles!inner(full_name)), clinic:clinics!inner(name)"),
  ]);
  if (!secRes.data) notFound();
  const s = secRes.data;
  const label = (dc: any) => `${dc.doctor.profiles.full_name} @ ${dc.clinic.name}`;
  const pairs = new Map(((dcRes.data ?? []) as any[]).map(dc => [dc.id as string, label(dc)]));
  const assigned = (caRes.data ?? []).map(a => ({ id: a.id, label: pairs.get(a.doctor_clinic_id) ?? "Doctor" }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const taken = new Set((caRes.data ?? []).map(a => a.doctor_clinic_id));
  const options = [...pairs].filter(([dcId]) => !taken.has(dcId)).map(([id, l]) => ({ id, label: l }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <>
      <PageHeader
        leading={<>
          <Button asChild variant="ghost" size="icon"><Link href="/admin/secretaries" aria-label="Back to secretaries"><Icon name="back" /></Link></Button>
          <span className="avatar" style={{ width: 48, height: 48, fontSize: 16 }}>{initials(s.full_name ?? "")}</span>
        </>}
        title={s.full_name ?? "Secretary"}
        sub={[`Secretary`, s.phone, `${assigned.length} doctor${assigned.length === 1 ? "" : "s"}`].filter(Boolean).join(" · ")} />

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Shown on bookings they create and in the audit log.</CardDescription>
          </CardHeader>
          <CardContent><SecretaryProfileForm secretary={{ id: s.id, full_name: s.full_name ?? "", phone: s.phone }} /></CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Doctors they support</CardTitle>
            <CardDescription>
              A secretary books, confirms and reschedules appointments only for these doctor–clinic pairs,
              and sees those patients. They never see medical records.
            </CardDescription>
            <CardAction><AddAssignment secretaryId={s.id} options={options} /></CardAction>
          </CardHeader>
          <CardContent>
            {assigned.length === 0
              ? <p className="text-sm text-muted-foreground">
                  {pairs.size === 0 ? "No doctors are at any clinic yet — set them up under Doctors first."
                    : "Not assigned yet — they can sign in but can’t book for anyone."}
                </p>
              : (
                <div className="flex flex-wrap gap-2">
                  {assigned.map(a => (
                    <Badge key={a.id} variant="secondary" className="h-7 gap-1.5 pr-1 pl-2.5 text-sm">
                      <StethoscopeIcon />{a.label}
                      <ConfirmAction action={unassignSecretary} fields={{ id: a.id }} label={<XIcon />}
                        size="icon-xs" className="rounded-full" triggerTitle={`Unassign from ${a.label}`}
                        title={`Unassign ${s.full_name} from ${a.label}?`}
                        description="They’ll no longer be able to book or see this doctor’s schedule at that clinic. Existing appointments are kept."
                        confirmLabel="Unassign" success="Unassigned"
                        error="Couldn’t unassign. Please try again." />
                    </Badge>
                  ))}
                </div>
              )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
