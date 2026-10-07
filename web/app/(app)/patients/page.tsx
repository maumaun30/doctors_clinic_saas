import Link from "next/link";
import { PageHeader } from "@/app/_components/page-header";
import { Section } from "@/app/_components/section";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveClinicId } from "@/lib/data/clinic-context";
import { createPatient } from "@/lib/actions/patients";
import { Icon } from "@/app/_components/icons";
import { ageYearsMonths } from "@/app/_components/age";

function initials(name: string) {
  return (
    name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("") || "?"
  );
}

export default async function PatientsPage({
  searchParams,
}: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const sb = await createClient();
  const activeClinic = await getActiveClinicId(sb);

  let patientIds: string[] | null = null;
  if (activeClinic) {
    const { data, error } = await sb.from("patient_clinics")
      .select("patient_id").eq("clinic_id", activeClinic);
    if (error) throw error;
    patientIds = data.map(r => r.patient_id);
  }

  let query = sb.from("patients")
    .select("id, full_name, date_of_birth, sex, phone")
    .order("full_name");
  if (patientIds) {
    if (patientIds.length === 0) {
      query = query.eq("id", "00000000-0000-0000-0000-000000000000");
    } else {
      query = query.in("id", patientIds);
    }
  }
  if (q && q.trim()) {
    const term = `%${q.trim()}%`;
    query = query.or(`full_name.ilike.${term},phone.ilike.${term}`);
  }
  const { data: patients, error } = await query;
  if (error) throw error;

  async function add(formData: FormData) {
    "use server";
    const sb = await createClient();
    const clinicId = await getActiveClinicId(sb);
    if (!clinicId) throw new Error("Pick an active clinic in the sidebar first.");
    await createPatient({
      clinic_id: clinicId,
      full_name: formData.get("full_name"),
      date_of_birth: (formData.get("date_of_birth") as string) || undefined,
      sex: (formData.get("sex") as string) || undefined,
      phone: (formData.get("phone") as string) || undefined,
      email: (formData.get("email") as string) || undefined,
      address: (formData.get("address") as string) || undefined,
    });
    revalidatePath("/patients");
  }

  const sub = (p: any) =>
    [p.sex, ageYearsMonths(p.date_of_birth), p.phone].filter(Boolean).join(" · ") || "—";

  return (
    <>
      <PageHeader icon="users" title="Patients"
        sub={`${patients.length} ${patients.length === 1 ? "patient" : "patients"}${activeClinic ? " · active clinic" : ""}`}
        actions={activeClinic && <a href="#add" className="btn btn-primary"><Icon name="plus" /> Add patient</a>} />

      <form method="get" className="filters">
        <div className="search" style={{ maxWidth: 420 }}>
          <Icon name="search" />
          <input className="input" name="q" defaultValue={q ?? ""} placeholder="Search by name or phone" />
        </div>
        <button type="submit" className="btn btn-secondary">Search</button>
        {q && <a href="/patients" className="btn btn-ghost">Clear</a>}
      </form>

      <div className="card">
        {patients.length === 0
          ? <div className="empty">No patients found.</div>
          : patients.map(p => (
            <Link key={p.id} href={`/patients/${p.id}`} className="plist-row">
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                <span className="avatar">{initials(p.full_name)}</span>
                <div style={{ minWidth: 0 }}>
                  <div className="strong">{p.full_name}</div>
                  <div className="plist-id">{sub(p)}</div>
                </div>
              </div>
              <Icon name="chevright" style={{ color: "var(--fg-subtle)", width: 16, height: 16 }} />
            </Link>
          ))}
      </div>

      {!activeClinic ? (
        <p className="hint" style={{ marginTop: 20 }}>Pick an active clinic in the sidebar to add a patient.</p>
      ) : (
        <Section id="add" title="Add patient"
          description="Adds the patient to the active clinic. An email or mobile number enables appointment reminders.">
          <form action={add}>
            <div className="field">
              <label className="label">Full name</label>
              <input className="input" name="full_name" required />
            </div>
            <div className="grid-2">
              <div className="field">
                <label className="label">Date of birth</label>
                <input className="input" name="date_of_birth" type="date" />
              </div>
              <div className="field">
                <label className="label">Sex</label>
                <select className="select" name="sex" defaultValue="" style={{ width: "100%" }}>
                  <option value="">—</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <div className="grid-2">
              <div className="field">
                <label className="label">Phone</label>
                <input className="input" name="phone" />
              </div>
              <div className="field">
                <label className="label">Email</label>
                <input className="input" name="email" type="email" placeholder="For appointment reminders" />
              </div>
            </div>
            <div className="field">
              <label className="label">Address</label>
              <input className="input" name="address" />
            </div>
            <div className="settings-actions">
              <button type="submit" className="btn btn-primary">Add patient</button>
            </div>
          </form>
        </Section>
      )}
    </>
  );
}
