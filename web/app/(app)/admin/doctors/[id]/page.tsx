import Link from "next/link";
import { UserAvatar } from "@/app/_components/user-avatar";
import { avatarUrl } from "@/lib/avatar";
import { notFound, redirect } from "next/navigation";
import { BuildingIcon, XIcon } from "lucide-react";
import { PageHeader } from "@/app/_components/page-header";
import { Icon } from "@/app/_components/icons";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/data/queries";
import { ConfirmAction } from "@/app/_components/confirm-action";
import { unlinkDoctorClinic } from "@/lib/actions/doctors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WeekView, weeklyHours, type Win } from "@/app/(app)/availability/week-view";
import { AddHoursDialog } from "@/app/(app)/availability/add-hours-dialog";
import { AddClinic, DoctorProfileForm } from "./doctor-forms";


export default async function DoctorDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const me = await getMyProfile(sb);
  if (me?.role !== "admin") redirect("/today");

  const [docRes, dcRes, clinicsRes, availRes] = await Promise.all([
    sb.from("doctors").select("profile_id, specialization, prc_license_no, profiles!inner(full_name, avatar_path)").eq("profile_id", id).maybeSingle(),
    sb.from("doctor_clinics").select("clinic_id, clinic:clinics!inner(name)").eq("doctor_id", id),
    sb.from("clinics").select("id, name").order("name"),
    sb.from("doctor_availability").select("id, clinic_id, weekday, start_time, end_time").eq("doctor_id", id),
  ]);
  if (!docRes.data) notFound();
  const d = docRes.data as any;
  const name: string = d.profiles.full_name;
  const linked = ((dcRes.data ?? []) as any[]).map(x => ({ id: x.clinic_id as string, name: x.clinic.name as string }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const unlinked = (clinicsRes.data ?? []).filter(c => !linked.some(l => l.id === c.id));
  const wins = availRes.data ?? [];
  const total = weeklyHours(wins);

  return (
    <>
      <PageHeader
        leading={<>
          <Button asChild variant="ghost" size="icon"><Link href="/admin/doctors" aria-label="Back to doctors"><Icon name="back" /></Link></Button>
          <UserAvatar name={name} src={avatarUrl(d.profiles.avatar_path)} className="size-12" fallbackClassName="text-base" />
        </>}
        title={name}
        sub={[d.specialization ?? "No specialization", d.prc_license_no && `PRC ${d.prc_license_no}`,
          total ? `${total % 1 ? total.toFixed(1) : total} h/week` : "No hours set"].filter(Boolean).join(" · ")} />

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Name and professional details.</CardDescription>
          </CardHeader>
          <CardContent>
            <DoctorProfileForm doctor={{ profile_id: id, full_name: name, specialization: d.specialization, prc_license_no: d.prc_license_no }} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Clinics</CardTitle>
            <CardDescription>Where {name} can be booked. Each clinic has its own weekly hours below.</CardDescription>
            <CardAction><AddClinic doctorId={id} clinics={unlinked} /></CardAction>
          </CardHeader>
          <CardContent>
            {linked.length === 0
              ? <p className="text-sm text-muted-foreground">Not at any clinic yet — add one to make this doctor bookable.</p>
              : (
                <div className="flex flex-wrap gap-2">
                  {linked.map(c => (
                    <Badge key={c.id} variant="secondary" className="h-7 gap-1.5 pr-1 pl-2.5 text-sm">
                      <BuildingIcon />{c.name}
                      <ConfirmAction action={unlinkDoctorClinic} fields={{ doctor_id: id, clinic_id: c.id }} label={<XIcon />}
                        size="icon-xs" className="rounded-full" triggerTitle={`Remove from ${c.name}`}
                        title={`Remove ${name} from ${c.name}?`}
                        description={<>Their working hours and secretary assignments at {c.name} are deleted. Past and booked appointments are kept.</>}
                        confirmLabel="Remove" success={`Removed from ${c.name}`}
                        error="Couldn’t remove the doctor from this clinic. Please try again." />
                    </Badge>
                  ))}
                </div>
              )}
          </CardContent>
        </Card>

        {linked.map(c => {
          const mine: Win[] = wins.filter(w => w.clinic_id === c.id);
          const h = weeklyHours(mine);
          const pair = { doctor_id: id, clinic_id: c.id, label: `${name} @ ${c.name}` };
          return (
            <Card key={c.id}>
              <CardHeader>
                <CardTitle>Weekly hours · {c.name}</CardTitle>
                <CardDescription>
                  {mine.length ? `${h % 1 ? h.toFixed(1) : h} h/week across ${new Set(mine.map(w => w.weekday)).size} days`
                    : "No hours yet — patients can’t book this doctor here."}
                </CardDescription>
                <CardAction><AddHoursDialog pairs={[pair]} defaultPair={pair} compact /></CardAction>
              </CardHeader>
              <CardContent><WeekView wins={mine} label={pair.label} editable /></CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
