import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/data/queries";

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
        <div className="page-head"><div><h1>Assignments</h1></div></div>
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
      <div className="page-head">
        <div><h1>Assignments</h1><div className="sub">Link doctors and secretaries to a clinic</div></div>
      </div>

      <form method="get" className="filters">
        <label className="field" style={{ margin: 0 }}>
          <span className="label">Clinic</span>
          <select name="clinic" defaultValue={clinicId} className="select" style={{ minWidth: 200 }}>
            {clinics?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <button type="submit" className="btn btn-secondary" style={{ alignSelf: "flex-end" }}>Switch</button>
      </form>

      <div className="stack">
        {docsHere.length === 0 && <div className="card empty">No doctors at this clinic yet.</div>}
        {docsHere.map((d: any) => {
          const dcRow = dcs.find(x => x.doctor_id === d.doctor_id)!;
          const secsHere = cas.filter((c: any) => c.doctor_clinic_id === dcRow.id);
          const secIdsHere = new Set(secsHere.map((c: any) => c.secretary_id));
          const addableSecs = allSecs.filter(s => !secIdsHere.has(s.id));
          return (
            <div key={dcRow.id} className="card" style={{ padding: 20 }}>
              <div className="row-between">
                <strong style={{ fontSize: 15 }}>{d.doctor.profiles.full_name}</strong>
                <form action={removeDoctor}>
                  <input type="hidden" name="id" value={dcRow.id} />
                  <button type="submit" className="btn btn-ghost btn-sm" title="Remove from clinic">Remove</button>
                </form>
              </div>

              <div className="section-title" style={{ marginTop: 16, marginBottom: 8 }}>Secretaries</div>
              {secsHere.length === 0
                ? <p className="hint">None assigned.</p>
                : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {secsHere.map((c: any) => (
                      <span key={c.id} className="badge">
                        <span className="dot" />{c.secretary.full_name}
                        <form action={removeSec} style={{ display: "inline-flex" }}>
                          <input type="hidden" name="id" value={c.id} />
                          <button type="submit" title="Unassign"
                                  style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--fg-subtle)", padding: 0, marginLeft: 2 }}>✕</button>
                        </form>
                      </span>
                    ))}
                  </div>
                )}

              {addableSecs.length > 0 && (
                <form action={addSec} style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <input type="hidden" name="doctor_clinic_id" value={dcRow.id} />
                  <select name="secretary_id" required defaultValue="" className="select">
                    <option value="" disabled>— add secretary —</option>
                    {addableSecs.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                  </select>
                  <button type="submit" className="btn btn-secondary btn-sm">Add</button>
                </form>
              )}
            </div>
          );
        })}

        <div>
          <div className="section-title" style={{ marginBottom: 12 }}>Add doctor to this clinic</div>
          {addableDocs.length === 0
            ? <p className="hint">All doctors are already at this clinic.</p>
            : (
              <form action={addDoctor} style={{ display: "flex", gap: 8 }}>
                <input type="hidden" name="clinic_id" value={clinicId} />
                <select name="doctor_id" required defaultValue="" className="select">
                  <option value="" disabled>— doctor —</option>
                  {addableDocs.map((d: any) => (
                    <option key={d.profile_id} value={d.profile_id}>{d.profiles.full_name}</option>
                  ))}
                </select>
                <button type="submit" className="btn btn-secondary">Add</button>
              </form>
            )}
        </div>
      </div>
    </>
  );
}
