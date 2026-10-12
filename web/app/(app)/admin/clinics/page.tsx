import { headers } from "next/headers";
import { BuildingIcon, CalendarDaysIcon, ExternalLinkIcon, MapPinIcon, StethoscopeIcon, UsersIcon } from "lucide-react";
import { PageHeader } from "@/app/_components/page-header";
import { createClient } from "@/lib/supabase/server";
import { listClinics } from "@/lib/data/queries";
import { ConfirmAction } from "@/app/_components/confirm-action";
import { deleteClinic } from "@/lib/actions/clinics";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { BookingDialog, ClinicDialog, CopyLinkButton } from "./clinic-dialogs";

export default async function ClinicsAdmin() {
  const sb = await createClient();
  const clinics = await listClinics(sb);
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;

  // Per-clinic counts (few clinics per account, so one small query each).
  const now = new Date();
  const weekAhead = new Date(now.getTime() + 7 * 86_400_000).toISOString();
  const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;
  const stats = await Promise.all(clinics.map(async c => {
    const [doctors, patients, upcoming, appointments] = await Promise.all([
      count(sb.from("doctor_clinics").select("id", { count: "exact", head: true }).eq("clinic_id", c.id)),
      count(sb.from("patient_clinics").select("id", { count: "exact", head: true }).eq("clinic_id", c.id)),
      count(sb.from("appointments").select("id", { count: "exact", head: true }).eq("clinic_id", c.id)
        .gte("scheduled_at", now.toISOString()).lt("scheduled_at", weekAhead).in("status", ["scheduled", "confirmed"])),
      count(sb.from("appointments").select("id", { count: "exact", head: true }).eq("clinic_id", c.id)),
    ]);
    return { doctors, patients, upcoming, appointments };
  }));

  return (
    <>
      <PageHeader icon="building" title="Clinics"
        sub={`${clinics.length} ${clinics.length === 1 ? "clinic" : "clinics"} · locations your account runs`}
        actions={<ClinicDialog />} />

      {clinics.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
          <div className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <BuildingIcon className="size-5" />
          </div>
          <div>
            <div className="font-medium">No clinics yet</div>
            <div className="text-sm text-muted-foreground">Add your first location to start booking patients.</div>
          </div>
          <ClinicDialog />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {clinics.map((c, i) => {
            const s = stats[i];
            const live = c.online_booking && c.booking_slug;
            const url = c.booking_slug ? `${origin}/book/${c.booking_slug}` : null;
            return (
              <Card key={c.id}>
                <CardHeader>
                  <CardTitle className="text-base">{c.name}</CardTitle>
                  <CardDescription className="flex items-center gap-1.5">
                    <MapPinIcon className="size-3.5 shrink-0" />{c.address ?? "No address yet"}
                  </CardDescription>
                  <CardAction><ClinicDialog clinic={c} /></CardAction>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <dl className="grid grid-cols-3 gap-2">
                    {[
                      { icon: StethoscopeIcon, label: "Doctors", v: s.doctors },
                      { icon: UsersIcon, label: "Patients", v: s.patients },
                      { icon: CalendarDaysIcon, label: "Next 7 days", v: s.upcoming },
                    ].map(({ icon: I, label, v }) => (
                      <div key={label} className="rounded-lg bg-muted/60 px-3 py-2">
                        <dt className="flex items-center gap-1.5 text-xs text-muted-foreground"><I className="size-3.5" />{label}</dt>
                        <dd className="text-lg font-semibold tabular-nums">{v}</dd>
                      </div>
                    ))}
                  </dl>

                  <div className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2">
                    {live
                      ? <Badge variant="success"><span className="dot" />Online booking on</Badge>
                      : <Badge variant="secondary"><span className="dot" />Online booking off</Badge>}
                    {live && url && (
                      <>
                        <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{url.replace(/^https?:\/\//, "")}</span>
                        <CopyLinkButton url={url} />
                        <Button asChild variant="ghost" size="icon-sm">
                          <a href={url} target="_blank" rel="noreferrer" aria-label="Open booking page"><ExternalLinkIcon /></a>
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="justify-between gap-2">
                  <BookingDialog clinic={c} origin={origin} />
                  {s.appointments > 0 ? (
                    <span className="text-xs text-muted-foreground" title="Cancel or move its appointments before deleting">
                      Can’t delete · {s.appointments} appointment{s.appointments === 1 ? "" : "s"}
                    </span>
                  ) : (
                    <ConfirmAction action={deleteClinic} fields={{ id: c.id }} label="Delete clinic"
                      title={`Delete ${c.name}?`}
                      description="This permanently removes the clinic, its doctor and secretary assignments, and its booking page. It can’t be undone."
                      success="Clinic deleted"
                      error="Couldn’t delete the clinic. It may have new appointments — refresh and try again." />
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
