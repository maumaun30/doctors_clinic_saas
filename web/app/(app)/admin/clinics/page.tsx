import { revalidatePath } from "next/cache";
import { PageHeader } from "@/app/_components/page-header";
import { Section } from "@/app/_components/section";
import { Icon } from "@/app/_components/icons";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { listClinics, getMyProfile } from "@/lib/data/queries";
import { clinicBookingInput, clinicInput } from "@/lib/schemas";
import { ConfirmAction } from "@/app/_components/confirm-action";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

const suggestSlug = (name: string) =>
  name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

export default async function ClinicsAdmin() {
  const sb = await createClient();
  const clinics = await listClinics(sb);
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;

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

  async function updateBooking(formData: FormData) {
    "use server";
    const input = clinicBookingInput.parse({
      online_booking: formData.get("online_booking") === "on",
      booking_slug: (formData.get("booking_slug") as string)?.trim() || null,
    });
    const sb = await createClient();
    const { error } = await sb.from("clinics").update(input).eq("id", formData.get("id") as string);
    if (error) {
      if (error.code === "23505") throw new Error("That booking link is already taken — pick another.");
      throw new Error(error.message);
    }
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
      <PageHeader icon="building" title="Clinics"
        sub={`${clinics.length} ${clinics.length === 1 ? "clinic" : "clinics"}`}
        actions={<Button asChild><a href="#add-clinic"><Icon name="plus" /> Add clinic</a></Button>} />

      {clinics.map(c => (
        <Section key={c.id} title={c.name}
          description={<>
            {c.address ?? "No address yet"}
            <span style={{ display: "block", marginTop: 8 }}>
              {c.online_booking && c.booking_slug
                ? <Badge variant="success"><span className="dot" />Online booking on</Badge>
                : <Badge variant="secondary"><span className="dot" />Online booking off</Badge>}
            </span>
          </>}>
          <form action={update}>
            <input type="hidden" name="id" value={c.id} />
            <div className="grid-2">
              <div className="field">
                <Label htmlFor={`name-${c.id}`}>Name</Label>
                <Input id={`name-${c.id}`} name="name" defaultValue={c.name} required />
              </div>
              <div className="field">
                <Label htmlFor={`addr-${c.id}`}>Address</Label>
                <Input id={`addr-${c.id}`} name="address" defaultValue={c.address ?? ""} />
              </div>
            </div>
            <div className="settings-actions" style={{ marginTop: 0 }}>
              <Button variant="outline" size="sm" type="submit">Save details</Button>
            </div>
          </form>

          <div className="settings-subsection">
            <form action={updateBooking}>
              <input type="hidden" name="id" value={c.id} />
              <label className="row-check">
                <Checkbox name="online_booking" defaultChecked={c.online_booking} className="mt-0.5" />
                <span>
                  <span className="strong">Online booking</span>
                  <span className="hint" style={{ display: "block" }}>Patients can book open slots at this link without an account.</span>
                </span>
              </label>
              <div className="field" style={{ marginTop: 12 }}>
                <Label htmlFor={`slug-${c.id}`}>Booking link</Label>
                <div className="input-affix">
                  <span>{origin}/book/</span>
                  <Input
                    className="flex-1 rounded-l-none"
                    id={`slug-${c.id}`}
                    name="booking_slug"
                    defaultValue={c.booking_slug ?? suggestSlug(c.name)} />
                </div>
              </div>
              <div className="settings-actions" style={{ marginTop: 0 }}>
                {c.online_booking && c.booking_slug && (
                  <a className="link" href={`/book/${c.booking_slug}`} target="_blank" rel="noreferrer"
                     style={{ fontSize: 13, marginRight: "auto" }}>Open booking page ↗</a>
                )}
                <Button variant="outline" size="sm" type="submit">Save booking</Button>
              </div>
            </form>
          </div>

          <div className="settings-subsection settings-danger">
            <span className="hint">Deleting fails while the clinic still has appointments.</span>
            <ConfirmAction action={remove} fields={{ id: c.id }} label="Delete clinic"
              title={`Delete ${c.name}?`}
              description="This permanently removes the clinic, its doctor and secretary assignments, and its booking page. It can’t be undone."
              success="Clinic deleted"
              error="Couldn’t delete the clinic. It still has appointments — cancel or move them first." />
          </div>
        </Section>
      ))}

      {clinics.length === 0 && (
        <Section title="No clinics yet" description="Add your first clinic below.">
          <div className="empty">No clinics yet.</div>
        </Section>
      )}

      <Section id="add-clinic" title="Add clinic" description="Each clinic has its own doctors, secretaries, patients and booking link.">
        <form action={add}>
          <div className="grid-2">
            <div className="field">
              <Label htmlFor="new-name">Name</Label>
              <Input id="new-name" name="name" required />
            </div>
            <div className="field">
              <Label htmlFor="new-address">Address</Label>
              <Input id="new-address" name="address" />
            </div>
          </div>
          <div className="settings-actions">
            <Button type="submit">Add clinic</Button>
          </div>
        </form>
      </Section>
    </>
  );
}
