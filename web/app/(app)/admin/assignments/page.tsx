import { revalidatePath } from "next/cache";
import { PageHeader } from "@/app/_components/page-header";
import { Section } from "@/app/_components/section";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/data/queries";
import { ConfirmAction } from "@/app/_components/confirm-action";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Badge } from "@/components/ui/badge";
import { XIcon } from "lucide-react";

export default async function AssignmentsAdmin({
  searchParams,
}: { searchParams: Promise<{ clinic?: string }> }) {
  const sp = await searchParams;
  const sb = await createClient();
  const me = await getMyProfile(sb);
  if (me?.role !== "admin") return <div className="card empty">Forbidden.</div>;

  // Clinic chooser (this page is admin-only and works across clinics,
  // so we don't use the global active-clinic cookie here).
  const { data: clinics } = await sb.from("clinics").select("id, name").order("name");
  const clinicId = sp.clinic ?? clinics?.[0]?.id ?? null;

  if (!clinicId) {
    return (
      <>
        <PageHeader icon="shield" title="Assignments" />
        <div className="card empty">Create a clinic first.</div>
      </>
    );
  }

  const [doctorsRes, dcRes, caRes, allDocsRes, secsRes] = await Promise.all([
    sb.from("doctor_clinics")
      .select("id, doctor_id, doctor:doctors!inner(profiles!inner(full_name, phone))")
      .eq("clinic_id", clinicId),
    sb.from("doctor_clinics").select("id, doctor_id, clinic_id").eq("clinic_id", clinicId),
    sb.from("clinic_assignments")
      .select("id, doctor_clinic_id, secretary_id, secretary:profiles!inner(full_name)"),
    sb.from("doctors").select("profile_id, profiles!inner(full_name)"),
    sb.from("profiles").select("id, full_name").eq("role", "secretary"),
  ]);

  const dcs = dcRes.data ?? [];
  const dcIds = new Set(dcs.map(d => d.id));
  const docsHere = doctorsRes.data ?? [];
  const docIdsHere = new Set(docsHere.map((d: any) => d.doctor_id));
  const cas = (caRes.data ?? []).filter((c: any) => dcIds.has(c.doctor_clinic_id));
  const allDocs = allDocsRes.data ?? [];
  const allSecs = secsRes.data ?? [];

  async function addDoctor(formData: FormData) {
    "use server";
    const sb = await createClient();
    const { error } = await sb.from("doctor_clinics").insert({
      doctor_id: formData.get("doctor_id") as string,
      clinic_id: formData.get("clinic_id") as string,
    });
    if (error) throw new Error(error.message);
    revalidatePath("/admin/assignments");
  }
  async function removeDoctor(formData: FormData) {
    "use server";
    const sb = await createClient();
    const { error } = await sb.from("doctor_clinics")
      .delete().eq("id", formData.get("id") as string);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/assignments");
  }
  async function addSec(formData: FormData) {
    "use server";
    const sb = await createClient();
    const { error } = await sb.from("clinic_assignments").insert({
      doctor_clinic_id: formData.get("doctor_clinic_id") as string,
      secretary_id: formData.get("secretary_id") as string,
    });
    if (error) throw new Error(error.message);
    revalidatePath("/admin/assignments");
  }
  async function removeSec(formData: FormData) {
    "use server";
    const sb = await createClient();
    const { error } = await sb.from("clinic_assignments")
      .delete().eq("id", formData.get("id") as string);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/assignments");
  }

  const addableDocs = allDocs.filter((d: any) => !docIdsHere.has(d.profile_id));

  return (
    <>
      <PageHeader icon="shield" title="Assignments" sub="Link doctors and secretaries to a clinic" />

      <form method="get" className="filters">
        <label className="field" style={{ margin: 0 }}>
          <span className="label">Clinic</span>
          <NativeSelect name="clinic" defaultValue={clinicId} style={{ minWidth: 200 }}>
            {clinics?.map(c => <NativeSelectOption key={c.id} value={c.id}>{c.name}</NativeSelectOption>)}
          </NativeSelect>
        </label>
        <Button variant="outline" type="submit" style={{ alignSelf: "flex-end" }}>Switch</Button>
      </form>

      <div>
        {docsHere.length === 0 && (
          <Section title="No doctors yet" description="Add a doctor to this clinic below.">
            <div className="empty">No doctors at this clinic yet.</div>
          </Section>
        )}
        {docsHere.map((d: any) => {
          const dcRow = dcs.find(x => x.doctor_id === d.doctor_id)!;
          const secsHere = cas.filter((c: any) => c.doctor_clinic_id === dcRow.id);
          const secIdsHere = new Set(secsHere.map((c: any) => c.secretary_id));
          const addableSecs = allSecs.filter(s => !secIdsHere.has(s.id));
          return (
            <Section key={dcRow.id} title={d.doctor.profiles.full_name}
              description={`${secsHere.length} ${secsHere.length === 1 ? "secretary" : "secretaries"} can book and manage this doctor’s appointments here.`}>
              <div className="section-title" style={{ marginBottom: 8 }}>Secretaries</div>
              {secsHere.length === 0
                ? <p className="hint">None assigned.</p>
                : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {secsHere.map((c: any) => (
                      <Badge variant="secondary" key={c.id}>
                        <span className="dot" />{c.secretary.full_name}
                        <form action={removeSec} style={{ display: "inline-flex" }}>
                          <input type="hidden" name="id" value={c.id} />
                          <Button type="submit" variant="ghost" size="icon-xs" title="Unassign" aria-label="Unassign"
                                  className="-mr-1 size-4 rounded-full text-muted-foreground"><XIcon /></Button>
                        </form>
                      </Badge>
                    ))}
                  </div>
                )}

              {addableSecs.length > 0 && (
                <form action={addSec} style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <input type="hidden" name="doctor_clinic_id" value={dcRow.id} />
                  <NativeSelect name="secretary_id" required defaultValue="">
                    <NativeSelectOption value="" disabled>— add secretary —</NativeSelectOption>
                    {addableSecs.map(s => <NativeSelectOption key={s.id} value={s.id}>{s.full_name}</NativeSelectOption>)}
                  </NativeSelect>
                  <Button variant="outline" size="sm" type="submit">Add</Button>
                </form>
              )}

              <div className="settings-subsection settings-danger">
                <span className="hint">Past appointments stay; this doctor’s secretary assignments here are removed.</span>
                <ConfirmAction action={removeDoctor} fields={{ id: dcRow.id }} label="Remove from clinic"
                  title="Remove this doctor from the clinic?"
                  description="Past appointments stay. This doctor’s secretary assignments at this clinic are removed."
                  confirmLabel="Remove"
                  success="Doctor removed from clinic"
                  error="Couldn’t remove the doctor. Please try again." />
              </div>
            </Section>
          );
        })}

        <Section title="Add doctor" description="Doctors must first be approved under Pending users.">
          {addableDocs.length === 0
            ? <p className="hint">All doctors are already at this clinic.</p>
            : (
              <form action={addDoctor} style={{ display: "flex", gap: 8 }}>
                <input type="hidden" name="clinic_id" value={clinicId} />
                <NativeSelect name="doctor_id" required defaultValue="">
                  <NativeSelectOption value="" disabled>— doctor —</NativeSelectOption>
                  {addableDocs.map((d: any) => (
                    <NativeSelectOption key={d.profile_id} value={d.profile_id}>{d.profiles.full_name}</NativeSelectOption>
                  ))}
                </NativeSelect>
                <Button variant="outline" type="submit">Add</Button>
              </form>
            )}
        </Section>
      </div>
    </>
  );
}
