import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { listClinics, getMyProfile } from "@/lib/data/queries";
import { clinicInput } from "@/lib/schemas";

export default async function ClinicsAdmin() {
  const sb = await createClient();
  const clinics = await listClinics(sb);

  async function add(formData: FormData) {
    "use server";
    const input = clinicInput.parse({
      name: formData.get("name"),
      address: (formData.get("address") as string) || undefined,
    });
    const sb = await createClient();
    const me = await getMyProfile(sb);
    if (!me?.account_id) throw new Error("no account");
    const { error } = await sb.from("clinics").insert({ ...input, account_id: me.account_id });
    if (error) throw new Error(error.message);
    revalidatePath("/admin/clinics");
  }

  async function update(formData: FormData) {
    "use server";
    const id = formData.get("id") as string;
    const input = clinicInput.parse({
      name: formData.get("name"),
      address: (formData.get("address") as string) || undefined,
    });
    const sb = await createClient();
    const { error } = await sb.from("clinics").update(input).eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/clinics");
  }

  async function remove(formData: FormData) {
    "use server";
    const sb = await createClient();
    const { error } = await sb.from("clinics").delete().eq("id", formData.get("id") as string);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/clinics");
  }

  return (
    <>
      <div className="page-head">
        <div><h1>Clinics</h1><div className="sub">{clinics.length} {clinics.length === 1 ? "clinic" : "clinics"}</div></div>
      </div>

      <div className="stack">
        <div className="card">
          <div className="section-bar">All clinics</div>
          {clinics.length === 0
            ? <div className="empty">No clinics yet.</div>
            : clinics.map(c => (
              <div key={c.id} className="queue-row" style={{ gridTemplateColumns: "1fr auto" }}>
                <form action={update} style={{ display: "flex", gap: 8, flexWrap: "wrap", flex: 1 }}>
                  <input type="hidden" name="id" value={c.id} />
                  <input className="input" name="name" defaultValue={c.name} required style={{ flex: 1, minWidth: 160 }} />
                  <input className="input" name="address" defaultValue={c.address ?? ""} placeholder="Address" style={{ flex: 1, minWidth: 160 }} />
                  <button type="submit" className="btn btn-secondary btn-sm">Save</button>
                </form>
                <form action={remove}>
                  <input type="hidden" name="id" value={c.id} />
                  <button type="submit" className="btn btn-ghost btn-sm">Delete</button>
                </form>
              </div>
            ))}
        </div>

        <div>
          <div className="section-title" style={{ marginBottom: 12 }}>Add clinic</div>
          <form action={add} className="card" style={{ maxWidth: 560, padding: 24 }}>
            <div className="field">
              <label className="label">Name</label>
              <input className="input" name="name" required />
            </div>
            <div className="field">
              <label className="label">Address</label>
              <input className="input" name="address" />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button type="submit" className="btn btn-primary">Add clinic</button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
