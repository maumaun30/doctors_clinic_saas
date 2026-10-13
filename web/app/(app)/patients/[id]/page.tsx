import Link from "next/link";
import { revalidatePath } from "next/cache";
import { ClipboardListIcon, FlaskConicalIcon, PencilIcon, PillIcon, XIcon } from "lucide-react";
import { PageHeader } from "@/app/_components/page-header";
import { createClient } from "@/lib/supabase/server";
import { getBookingOptions, getPatient, listMedicalRecords, getMyProfile } from "@/lib/data/queries";
import { getActiveClinicId } from "@/lib/data/clinic-context";
import { BookDialog } from "@/app/(app)/schedule/book-dialog";
import { linkPatientToClinic, unlinkPatientFromClinic } from "@/lib/actions/patients";
import LabFiles from "@/app/(app)/visits/[appointmentId]/lab-files";
import { Icon } from "@/app/_components/icons";
import { ageYearsMonths, ageVerbose } from "@/app/_components/age";
import { AppointmentStatusBadge, LabStatusBadge } from "@/app/_components/appointment-status";
import { PatientDialog } from "../patient-dialog";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TZ = "Asia/Manila";
const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString("en-PH", {
    timeZone: TZ, weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  });
const fmtDate = (ymd: string | null) =>
  ymd ? new Date(`${ymd}T12:00:00+08:00`).toLocaleDateString("en-PH", {
    timeZone: TZ, month: "short", day: "numeric", year: "numeric",
  }) : null;
const fmtStamp = (iso: string) =>
  new Date(iso).toLocaleDateString("en-PH", { timeZone: TZ, month: "short", day: "numeric", year: "numeric" });

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("") || "?";
}

export default async function PatientDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const patient = await getPatient(sb, id);
  const me = await getMyProfile(sb);
  const clinical = me?.role !== "secretary";

  const [linksRes, allClinicsRes] = await Promise.all([
    sb.from("patient_clinics")
      .select("id, clinic_id, clinic:clinics!inner(name)")
      .eq("patient_id", id),
    sb.from("clinics").select("id, name").order("name"),
  ]);
  const links = linksRes.data ?? [];
  const linkedIds = new Set(links.map(l => l.clinic_id));
  const unlinkedClinics = (allClinicsRes.data ?? []).filter(c => !linkedIds.has(c.id));

  async function addLink(formData: FormData) {
    "use server";
    await linkPatientToClinic(id, formData.get("clinic_id") as string);
    revalidatePath(`/patients/${id}`);
  }
  async function removeLink(formData: FormData) {
    "use server";
    await unlinkPatientFromClinic(formData.get("link_id") as string);
    revalidatePath(`/patients/${id}`);
  }

  const nowIso = new Date().toISOString();
  const appt = "id, scheduled_at, status, duration_minutes, notes, doctor:doctors!inner(profile:staff_profiles!inner(full_name))";
  const [upcomingRes, pastRes] = await Promise.all([
    sb.from("appointments").select(appt)
      .eq("patient_id", id).gte("scheduled_at", nowIso)
      .in("status", ["scheduled", "confirmed"]).order("scheduled_at"),
    sb.from("appointments").select(appt)
      .eq("patient_id", id).lt("scheduled_at", nowIso)
      .order("scheduled_at", { ascending: false }).limit(50),
  ]);
  const upcoming = upcomingRes.data ?? [];
  const past = pastRes.data ?? [];

  let records: Awaited<ReturnType<typeof listMedicalRecords>> = [];
  let conditions: any[] = [];
  let prescriptions: any[] = [];
  let labs: any[] = [];
  const labFilesByOrder: Record<string, any[]> = {};
  try {
    records = await listMedicalRecords(sb, id);
    const [cRes, rxRes, lRes] = await Promise.all([
      sb.from("patient_conditions").select("*").eq("patient_id", id).order("created_at", { ascending: false }),
      sb.from("prescriptions").select("*").eq("patient_id", id).order("created_at", { ascending: false }),
      sb.from("lab_orders").select("*").eq("patient_id", id).order("created_at", { ascending: false }),
    ]);
    conditions = cRes.data ?? [];
    prescriptions = rxRes.data ?? [];
    labs = lRes.data ?? [];
    if (labs.length > 0) {
      const { data: files } = await sb.from("lab_result_files")
        .select("id, lab_order_id, file_name, size_bytes, content_type")
        .in("lab_order_id", labs.map(l => l.id)).order("uploaded_at");
      for (const f of files ?? []) (labFilesByOrder[f.lab_order_id] ??= []).push(f);
    }
  } catch { /* secretary RLS blocks clinical reads */ }

  const recordByAppt = new Map(records.filter(r => r.appointment_id).map(r => [r.appointment_id!, r]));
  const activeProblems = conditions.filter(c => c.status === "active");
  const booking = await getBookingOptions(sb, await getActiveClinicId(sb));
  const sub = [patient.sex, ageYearsMonths(patient.date_of_birth), patient.phone].filter(Boolean).join(" · ") || "—";

  return (
    <>
      <PageHeader
        leading={<>
          <Button asChild variant="ghost" size="icon"><Link href="/patients" aria-label="Back to patients"><Icon name="back" /></Link></Button>
          <span className="avatar" style={{ width: 48, height: 48, fontSize: 16 }}>{initials(patient.full_name)}</span>
        </>}
        title={patient.full_name}
        sub={sub}
        actions={<>
          <PatientDialog patient={patient} trigger={<Button variant="outline"><PencilIcon /> Edit details</Button>} />
          <BookDialog label="New visit" defaultPatientId={patient.id} {...booking} />
        </>} />

      {activeProblems.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Active problems</span>
          {activeProblems.map(c => (
            <Badge key={c.id} variant="warning"><span className="dot" />{c.name}</Badge>
          ))}
        </div>
      )}

      <Tabs defaultValue="overview" className="gap-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="visits">Visits <Count n={past.length} /></TabsTrigger>
          {clinical && <TabsTrigger value="rx">Prescriptions <Count n={prescriptions.length} /></TabsTrigger>}
          {clinical && <TabsTrigger value="labs">Labs <Count n={labs.length} /></TabsTrigger>}
        </TabsList>

        {/* ---------- Overview ---------- */}
        <TabsContent value="overview" className="grid items-start gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
              <CardDescription>Contact details also power appointment reminders.</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="kv">
                <dt>Age</dt><dd>{ageVerbose(patient.date_of_birth) ?? "—"}</dd>
                <dt>Born</dt><dd>{fmtDate(patient.date_of_birth) ?? "—"}</dd>
                <dt>Sex</dt><dd className="capitalize">{patient.sex ?? "—"}</dd>
                <dt>Mobile</dt><dd>{patient.phone ?? "—"}</dd>
                <dt>Email</dt><dd>{patient.email ?? "—"}</dd>
                <dt>Address</dt><dd>{patient.address ?? "—"}</dd>
              </dl>
            </CardContent>
          </Card>

          <div className="grid content-start gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Upcoming <Count n={upcoming.length} /></CardTitle>
                <CardDescription>Scheduled and confirmed appointments.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2">
                {upcoming.length === 0
                  ? <p className="text-sm text-muted-foreground">Nothing booked.</p>
                  : upcoming.map(a => (
                    <Link key={a.id} href={`/visits/${a.id}`}
                      className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm hover:bg-muted/50">
                      <div className="min-w-0">
                        <div className="font-medium">{fmtWhen(a.scheduled_at)}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {a.doctor.profile.full_name} · {a.duration_minutes} min{a.notes ? ` · ${a.notes}` : ""}
                        </div>
                      </div>
                      <AppointmentStatusBadge status={a.status} />
                    </Link>
                  ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Clinics</CardTitle>
                <CardDescription>Where this patient can be booked.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                {links.length === 0
                  ? <p className="text-sm text-muted-foreground">Not linked to any clinic.</p>
                  : (
                    <div className="flex flex-wrap gap-2">
                      {links.map((l: any) => (
                        <Badge variant="secondary" key={l.id}>
                          {l.clinic.name}
                          {me?.role === "admin" && (
                            <form action={removeLink} className="inline-flex">
                              <input type="hidden" name="link_id" value={l.id} />
                              <Button type="submit" variant="ghost" size="icon-xs" title="Unlink" aria-label={`Unlink ${l.clinic.name}`}
                                className="-mr-1 size-4 rounded-full text-muted-foreground"><XIcon /></Button>
                            </form>
                          )}
                        </Badge>
                      ))}
                    </div>
                  )}
                {unlinkedClinics.length > 0 && (
                  <form action={addLink} className="flex gap-2">
                    <NativeSelect name="clinic_id" required defaultValue="" aria-label="Clinic to link" className="flex-1">
                      <NativeSelectOption value="" disabled>Add to another clinic…</NativeSelectOption>
                      {unlinkedClinics.map(c => <NativeSelectOption key={c.id} value={c.id}>{c.name}</NativeSelectOption>)}
                    </NativeSelect>
                    <Button variant="outline" type="submit">Link</Button>
                  </form>
                )}
              </CardContent>
            </Card>

            {clinical && conditions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Problem list</CardTitle>
                  <CardDescription>Recorded at visits by the treating doctor.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {conditions.map(c => (
                    <Badge key={c.id} variant={c.status === "active" ? "warning" : "secondary"}>
                      <span className="dot" />{c.name}{c.since ? ` · since ${fmtDate(c.since)}` : ""}
                    </Badge>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ---------- Visits ---------- */}
        <TabsContent value="visits">
          {past.length === 0 ? <Empty icon={<ClipboardListIcon />} text="No past visits yet." /> : (
            <div className="card divide-y">
              {past.map(a => {
                const r = recordByAppt.get(a.id);
                return (
                  <Link key={a.id} href={`/visits/${a.id}`} className="flex items-start justify-between gap-4 px-4 py-3 hover:bg-muted/50">
                    <div className="min-w-0">
                      <div className="font-medium">{fmtWhen(a.scheduled_at)}</div>
                      <div className="text-xs text-muted-foreground">{a.doctor.profile.full_name}{a.notes ? ` · ${a.notes}` : ""}</div>
                      {r && (
                        <div className="mt-1.5 text-sm">
                          <span className="font-medium">{r.diagnosis ?? "No diagnosis recorded"}</span>
                          {r.notes && <span className="text-muted-foreground"> — {r.notes}</span>}
                        </div>
                      )}
                    </div>
                    <AppointmentStatusBadge status={a.status} />
                  </Link>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ---------- Prescriptions ---------- */}
        {clinical && (
          <TabsContent value="rx">
            {prescriptions.length === 0 ? <Empty icon={<PillIcon />} text="No prescriptions issued." /> : (
              <div className="card divide-y">
                {prescriptions.map(p => (
                  <div key={p.id} className="flex items-start justify-between gap-4 px-4 py-3">
                    <div className="min-w-0">
                      <div className="font-medium">
                        {p.name}
                        <span className="font-normal text-muted-foreground">
                          {[p.dosage, p.frequency, p.duration].filter(Boolean).map(x => ` · ${x}`).join("")}
                        </span>
                      </div>
                      {p.instructions && <div className="text-sm text-muted-foreground">{p.instructions}</div>}
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{fmtStamp(p.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        )}

        {/* ---------- Labs ---------- */}
        {clinical && (
          <TabsContent value="labs">
            {labs.length === 0 ? <Empty icon={<FlaskConicalIcon />} text="No lab tests ordered." /> : (
              <div className="card divide-y">
                {labs.map(l => (
                  <div key={l.id} className="grid gap-2 px-4 py-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 font-medium">{l.name} <LabStatusBadge status={l.status} /></div>
                        {l.result && <div className="text-sm text-muted-foreground">Result: {l.result}</div>}
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">Ordered {fmtStamp(l.created_at)}</span>
                    </div>
                    <LabFiles labOrderId={l.id} files={labFilesByOrder[l.id] ?? []} />
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>
    </>
  );
}

function Count({ n }: { n: number }) {
  return <span className="text-xs font-normal tabular-nums text-muted-foreground">{n}</span>;
}

function Empty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center text-sm text-muted-foreground">
      <div className="flex size-11 items-center justify-center rounded-full bg-muted [&>svg]:size-5">{icon}</div>
      {text}
    </div>
  );
}
