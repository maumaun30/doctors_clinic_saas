import { revalidatePath } from "next/cache";
import { PageHeader } from "@/app/_components/page-header";
import { Section } from "@/app/_components/section";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/data/queries";
import { ConfirmAction } from "@/app/_components/confirm-action";

export default async function LibraryAdmin() {
  const sb = await createClient();
  const [meds, labs, conds] = await Promise.all([
    sb.from("common_medications").select("*").order("name"),
    sb.from("common_lab_tests").select("*").order("name"),
    sb.from("common_conditions").select("*").order("name"),
  ]);

  // ---- medications ----
  async function addMed(formData: FormData) {
    "use server";
    const sb = await createClient();
    const me = await getMyProfile(sb);
    const { error } = await sb.from("common_medications").insert({
      account_id: me!.account_id,
      name: formData.get("name") as string,
      default_dosage: (formData.get("default_dosage") as string) || null,
      default_frequency: (formData.get("default_frequency") as string) || null,
      default_instructions: (formData.get("default_instructions") as string) || null,
    });
    if (error) throw new Error(error.message);
    revalidatePath("/admin/library");
  }
  async function saveMed(formData: FormData) {
    "use server";
    const sb = await createClient();
    const { error } = await sb.from("common_medications").update({
      name: formData.get("name") as string,
      default_dosage: (formData.get("default_dosage") as string) || null,
      default_frequency: (formData.get("default_frequency") as string) || null,
      default_instructions: (formData.get("default_instructions") as string) || null,
    }).eq("id", formData.get("id") as string);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/library");
  }
  async function delMed(formData: FormData) {
    "use server";
    const sb = await createClient();
    await sb.from("common_medications").delete().eq("id", formData.get("id") as string);
    revalidatePath("/admin/library");
  }

  // ---- labs ----
  async function addLab(formData: FormData) {
    "use server";
    const sb = await createClient();
    const me = await getMyProfile(sb);
    const { error } = await sb.from("common_lab_tests").insert({
      account_id: me!.account_id,
      name: formData.get("name") as string,
      description: (formData.get("description") as string) || null,
    });
    if (error) throw new Error(error.message);
    revalidatePath("/admin/library");
  }
  async function saveLab(formData: FormData) {
    "use server";
    const sb = await createClient();
    const { error } = await sb.from("common_lab_tests").update({
      name: formData.get("name") as string,
      description: (formData.get("description") as string) || null,
    }).eq("id", formData.get("id") as string);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/library");
  }
  async function delLab(formData: FormData) {
    "use server";
    const sb = await createClient();
    await sb.from("common_lab_tests").delete().eq("id", formData.get("id") as string);
    revalidatePath("/admin/library");
  }

  // ---- conditions ----
  async function addCond(formData: FormData) {
    "use server";
    const sb = await createClient();
    const me = await getMyProfile(sb);
    const { error } = await sb.from("common_conditions").insert({
      account_id: me!.account_id,
      name: formData.get("name") as string,
      icd_code: (formData.get("icd_code") as string) || null,
    });
    if (error) throw new Error(error.message);
    revalidatePath("/admin/library");
  }
  async function saveCond(formData: FormData) {
    "use server";
    const sb = await createClient();
    const { error } = await sb.from("common_conditions").update({
      name: formData.get("name") as string,
      icd_code: (formData.get("icd_code") as string) || null,
    }).eq("id", formData.get("id") as string);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/library");
  }
  async function delCond(formData: FormData) {
    "use server";
    const sb = await createClient();
    await sb.from("common_conditions").delete().eq("id", formData.get("id") as string);
    revalidatePath("/admin/library");
  }

  const rowWrap: React.CSSProperties = { padding: "10px 18px", borderBottom: "1px solid var(--border)" };

  return (
    <>
      <PageHeader icon="settings" title="Most-used library"
        sub="Quick picks for visits. Edits never change past records — visits keep their own copy." />

      <div>
        {/* Medications */}
        <Section title={<>Medications <span className="count">· {meds.data?.length ?? 0}</span></>}
          description="Prefills dosage, frequency and instructions when a doctor adds a prescription." flush>
          {meds.data?.map(m => (
            <form key={m.id} action={saveMed} style={rowWrap}>
              <input type="hidden" name="id" value={m.id} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto auto", gap: 6, alignItems: "center" }}>
                <input className="input" name="name" defaultValue={m.name} required placeholder="name" />
                <input className="input" name="default_dosage" defaultValue={m.default_dosage ?? ""} placeholder="dosage" />
                <input className="input" name="default_frequency" defaultValue={m.default_frequency ?? ""} placeholder="frequency" />
                <input className="input" name="default_instructions" defaultValue={m.default_instructions ?? ""} placeholder="instructions" />
                <button type="submit" className="btn btn-secondary btn-sm">Save</button>
                <ConfirmAction action={delMed} fields={{ id: m.id }} label="Delete"
                  title={`Delete ${m.name}?`}
                  description="It’s removed from quick picks. Past prescriptions keep their own copy."
                  success="Medication deleted" error="Couldn’t delete the medication. Please try again." />
              </div>
            </form>
          ))}
          <form action={addMed} className="settings-add-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: 6 }}>
            <input className="input" name="name" placeholder="Add: name (e.g. Amoxicillin)" required />
            <input className="input" name="default_dosage" placeholder="default dosage" />
            <input className="input" name="default_frequency" placeholder="default frequency" />
            <input className="input" name="default_instructions" placeholder="default instructions" />
            <button type="submit" className="btn btn-primary btn-sm">Add</button>
          </form>
        </Section>

        {/* Lab tests */}
        <Section title={<>Lab tests <span className="count">· {labs.data?.length ?? 0}</span></>}
          description="Tests doctors can order in one tap during a visit." flush>
          {labs.data?.map(l => (
            <form key={l.id} action={saveLab} style={rowWrap}>
              <input type="hidden" name="id" value={l.id} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr auto auto", gap: 6, alignItems: "center" }}>
                <input className="input" name="name" defaultValue={l.name} required placeholder="name" />
                <input className="input" name="description" defaultValue={l.description ?? ""} placeholder="description" />
                <button type="submit" className="btn btn-secondary btn-sm">Save</button>
                <ConfirmAction action={delLab} fields={{ id: l.id }} label="Delete"
                  title={`Delete ${l.name}?`}
                  description="It’s removed from quick picks. Past lab orders keep their own copy."
                  success="Lab test deleted" error="Couldn’t delete the lab test. Please try again." />
              </div>
            </form>
          ))}
          <form action={addLab} className="settings-add-row" style={{ display: "grid", gridTemplateColumns: "1fr 2fr auto", gap: 6 }}>
            <input className="input" name="name" placeholder="Add: name (e.g. CBC)" required />
            <input className="input" name="description" placeholder="description" />
            <button type="submit" className="btn btn-primary btn-sm">Add</button>
          </form>
        </Section>

        {/* Conditions */}
        <Section title={<>Conditions <span className="count">· {conds.data?.length ?? 0}</span></>}
          description="Diagnoses for the patient problem list, optionally with an ICD code." flush>
          {conds.data?.map(c => (
            <form key={c.id} action={saveCond} style={rowWrap}>
              <input type="hidden" name="id" value={c.id} />
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr auto auto", gap: 6, alignItems: "center" }}>
                <input className="input" name="name" defaultValue={c.name} required placeholder="name" />
                <input className="input" name="icd_code" defaultValue={c.icd_code ?? ""} placeholder="ICD code" />
                <button type="submit" className="btn btn-secondary btn-sm">Save</button>
                <ConfirmAction action={delCond} fields={{ id: c.id }} label="Delete"
                  title={`Delete ${c.name}?`}
                  description="It’s removed from quick picks. Existing patient problem lists keep their own copy."
                  success="Condition deleted" error="Couldn’t delete the condition. Please try again." />
              </div>
            </form>
          ))}
          <form action={addCond} className="settings-add-row" style={{ display: "grid", gridTemplateColumns: "2fr 1fr auto", gap: 6 }}>
            <input className="input" name="name" placeholder="Add: name (e.g. Hypertension)" required />
            <input className="input" name="icd_code" placeholder="ICD code" />
            <button type="submit" className="btn btn-primary btn-sm">Add</button>
          </form>
        </Section>
      </div>
    </>
  );
}
