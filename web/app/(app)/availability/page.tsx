import Link from "next/link";
import { CalendarOffIcon, SettingsIcon } from "lucide-react";
import { PageHeader } from "@/app/_components/page-header";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/data/queries";
import { getActiveClinicId } from "@/lib/data/clinic-context";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WeekView, weeklyHours, type Win } from "./week-view";

// Read-only "who works when". Admins change hours from Admin → Doctors.
export default async function AvailabilityPage() {
  const sb = await createClient();
  const me = await getMyProfile(sb);
  if (!me) throw new Error("not authenticated");
  const isAdmin = me.role === "admin";
  const isDoctor = me.role === "doctor";
  const activeClinic = await getActiveClinicId(sb);

  let dcQuery = sb.from("doctor_clinics")
    .select("doctor_id, clinic_id, doctor:doctors!inner(profiles!inner(full_name)), clinic:clinics!inner(name)");
  if (isDoctor) dcQuery = dcQuery.eq("doctor_id", me.id);
  if (activeClinic) dcQuery = dcQuery.eq("clinic_id", activeClinic);
  const [{ data: dcs, error: dcErr }, { data: rows, error: avErr }] = await Promise.all([
    dcQuery,
    (activeClinic
      ? sb.from("doctor_availability").select("id, doctor_id, clinic_id, weekday, start_time, end_time").eq("clinic_id", activeClinic)
      : sb.from("doctor_availability").select("id, doctor_id, clinic_id, weekday, start_time, end_time")),
  ]);
  if (dcErr) throw dcErr;
  if (avErr) throw avErr;
  const wins = rows ?? [];

  // Secretaries only see availability for doctors they're assigned to (RLS),
  // so show the pairs that have visible hours; others see every pair in scope.
  const pairs = ((dcs ?? []) as any[])
    .map(dc => ({
      doctor_id: dc.doctor_id as string,
      clinic_id: dc.clinic_id as string,
      name: dc.doctor.profiles.full_name as string,
      label: activeClinic ? dc.doctor.profiles.full_name as string : `${dc.doctor.profiles.full_name} @ ${dc.clinic.name}`,
    }))
    .filter(p => isAdmin || isDoctor || wins.some(w => w.doctor_id === p.doctor_id && w.clinic_id === p.clinic_id))
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <>
      <PageHeader icon="clock" title="Availability"
        sub={isAdmin ? "Who works when · change hours from Admin → Doctors" : "Who works when · hours are set by clinic admins"} />

      {pairs.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
          <div className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <CalendarOffIcon className="size-5" />
          </div>
          <div className="text-sm text-muted-foreground">
            {isAdmin ? "No doctors at this clinic yet — add them from Admin → Doctors."
              : isDoctor ? "You aren’t linked to this clinic yet. Ask an admin to add you."
              : "No working hours to show for your doctors yet."}
          </div>
          {isAdmin && <Button asChild variant="outline"><Link href="/admin/doctors">Go to Doctors</Link></Button>}
        </div>
      ) : (
        <div className="grid gap-4">
          {pairs.map(p => {
            const mine: Win[] = wins.filter(w => w.doctor_id === p.doctor_id && w.clinic_id === p.clinic_id);
            const h = weeklyHours(mine);
            const days = new Set(mine.map(w => w.weekday)).size;
            return (
              <Card key={`${p.doctor_id}|${p.clinic_id}`}>
                <CardHeader>
                  <CardTitle>{p.label}</CardTitle>
                  <CardDescription>
                    {mine.length ? `${h % 1 ? h.toFixed(1) : h} h/week across ${days} day${days === 1 ? "" : "s"}`
                      : "No hours set — this doctor can’t be booked here yet."}
                  </CardDescription>
                  {isAdmin && (
                    <CardAction>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/admin/doctors/${p.doctor_id}`}><SettingsIcon /> Manage</Link>
                      </Button>
                    </CardAction>
                  )}
                </CardHeader>
                <CardContent><WeekView wins={mine} label={p.label} /></CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
