import Link from "next/link";
import { PageHeader } from "@/app/_components/page-header";
import { Section } from "@/app/_components/section";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getPatient, listMedicalRecords, getMyProfile } from "@/lib/data/queries";
import { linkPatientToClinic, unlinkPatientFromClinic, updatePatient } from "@/lib/actions/patients";
import LabFiles from "@/app/(app)/visits/[appointmentId]/lab-files";
import { Icon } from "@/app/_components/icons";
import { ageYearsMonths, ageVerbose } from "@/app/_components/age";
import { Button } from "@/components/ui/button";

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("") || "?";
}

export default async function PatientDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const patient = await getPatient(sb, id);
  const me = await getMyProfile(sb);

  const [linksRes, allClinicsRes] = await Promise.all([
    sb.from("patient_clinics")
      .select("id, clinic_id, clinic:clinics!inner(name)")
      .eq("patient_id", id),
    sb.from("clinics").select("id, name").order("name"),
  ]);
  const links = linksRes.data ?? [];
  const linkedIds = new Set(links.map(l => l.clinic_id));
  const unlinkedClinics = (allClinicsRes.data ?? []).filter(c => !linkedIds.has(c.id));

  async function saveEdit(formData: FormData) {
    "use server";
    await updatePatient({
      id,
      full_name: formData.get("full_name"),
      date_of_birth: (formData.get("date_of_birth") as string) || null,
      sex: (formData.get("sex") as string) || null,
      phone: (formData.get("phone") as string) || null,
      email: (formData.get("email") as string) || null,
      address: (formData.get("address") as string) || null,
    });
    revalidatePath(`/patients/${id}`);
  }

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
  const [upcomingRes, pastRes] = await Promise.all([
    sb.from("appointments")
      .select("id, scheduled_at, status, duration_minutes")
      .eq("patient_id", id).gte("scheduled_at", nowIso)
      .in("status", ["scheduled", "confirmed"]).order("scheduled_at"),
    sb.from("appointments")
      .select("id, scheduled_at, status")
      .eq("patient_id", id).lt("scheduled_at", nowIso)
      .order("scheduled_at", { ascending: false }).limit(10),
  ]);

  let records: Awaited<ReturnType<typeof listMedicalRecords>> = [];
  let conditions: any[] = [];
  let prescriptions: any[] = [];
  let labs: any[] = [];
  let labFilesByOrder: Record<string, any[]> = {};
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
      const ids = labs.map(l => l.id);
      const { data: files } = await sb.from("lab_result_files")
        .select("id, lab_order_id, file_name, size_bytes, content_type")
        .in("lab_order_id", ids).order("uploaded_at");
      for (const f of files ?? []) {
        (labFilesByOrder[f.lab_order_id] ??= []).push(f);
      }
    }
  } catch { /* secretary RLS blocks clinical reads */ }

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("en-PH", { timeZone: "Asia/Manila" });
  const sub = [patient.sex, ageYearsMonths(patient.date_of_birth), patient.phone]
    .filter(Boolean).join(" · ") || "—";

  return (
    <>
      <PageHeader
        leading={<>
          <Button asChild variant="ghost" size="icon"><Link href="/patients" aria-label="Back to patients"><Icon name="back" /></Link></Button>
          <span className="avatar" style={{ width: 48, height: 48, fontSize: 16 }}>{initials(patient.full_name)}</span>
        </>}
        title={patient.full_name}
        sub={sub}
        actions={<Button asChild><Link href="/schedule#book"><Icon name="plus" /> New visit</Link></Button>} />

      <div>
        {/* Demographics */}
        <Section title="Demographics" description="Contact details also power appointment reminders.">
          <dl className="kv">
            <dt>Age</dt><dd>{ageVerbose(patient.date_of_birth) ?? "—"}</dd>
            <dt>Sex</dt><dd>{patient.sex ?? "—"}</dd>
            <dt>Phone</dt><dd>{patient.phone ?? "—"}</dd>
            <dt>Email</dt><dd>{patient.email ?? "—"}</dd>
            <dt>Address</dt><dd>{patient.address ?? "—"}</dd>
          </dl>
          <details style={{ marginTop: 14 }}>
            <summary className="link" style={{ fontSize: 13 }}>Edit demographics</summary>
            <form action={saveEdit} style={{ marginTop: 14 }}>
              <div className="field">
                <label className="label">Full name</label>
                <input className="input" name="full_name" defaultValue={patient.full_name} required />
              </div>
              <div className="grid-2">
                <div className="field">
                  <label className="label">Date of birth</label>
                  <input className="input" name="date_of_birth" type="date" defaultValue={patient.date_of_birth ?? ""} />
                </div>
                <div className="field">
                  <label className="label">Sex</label>
                  <select className="select" name="sex" defaultValue={patient.sex ?? ""} style={{ width: "100%" }}>
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
                  <input className="input" name="phone" defaultValue={patient.phone ?? ""} />
                </div>
                <div className="field">
                  <label className="label">Email</label>
                  <input className="input" name="email" type="email" defaultValue={patient.email ?? ""} />
                </div>
              </div>
              <div className="field">
                <label className="label">Address</label>
                <input className="input" name="address" defaultValue={patient.address ?? ""} />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <Button size="sm" type="submit">Save</Button>
              </div>
            </form>
          </details>
        </Section>

        {/* Clinics */}
        <Section title="Clinics" description="Clinics where this patient can be booked.">
          {links.length === 0
            ? <p className="hint">Not linked to any clinic.</p>
            : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: unlinkedClinics.length ? 14 : 0 }}>
                {links.map((l: any) => (
                  <span key={l.id} className="badge">
                    {l.clinic.name}
                    {me?.role === "admin" && (
                      <form action={removeLink} style={{ display: "inline-flex" }}>
                        <input type="hidden" name="link_id" value={l.id} />
                        <button type="submit" title="Unlink"
                                style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--fg-subtle)", padding: 0, marginLeft: 2 }}>✕</button>
                      </form>
                    )}
                  </span>
                ))}
              </div>
            )}
          {unlinkedClinics.length > 0 && (
            <form action={addLink} style={{ display: "flex", gap: 8 }}>
              <select className="select" name="clinic_id" required defaultValue="">
                <option value="" disabled>— link clinic —</option>
                {unlinkedClinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <Button variant="outline" type="submit">Link</Button>
            </form>
          )}
        </Section>

        {/* Active problems */}
        <Section title="Active problems" description="Recorded at visits by the treating doctor.">
          {conditions.length === 0
            ? <p className="hint">No conditions recorded.</p>
            : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {conditions.map(c => (
                  <span key={c.id} className={`badge ${c.status === "active" ? "badge-amber" : ""}`}>
                    <span className="dot" />{c.name}{c.since ? ` · since ${c.since}` : ""}
                  </span>
                ))}
              </div>
            )}
        </Section>

        {/* Upcoming */}
        <Section title={<>Upcoming <span className="count">· {upcomingRes.data?.length ?? 0}</span></>} description="Scheduled and confirmed appointments." flush>
          {!upcomingRes.data || upcomingRes.data.length === 0
            ? <div className="empty">None.</div>
            : (
              <table className="tbl">
                <tbody>
                  {upcomingRes.data.map(a => (
                    <tr key={a.id}>
                      <td className="strong num" style={{ width: 200 }}>{fmt(a.scheduled_at)}</td>
                      <td style={{ color: "var(--fg-muted)" }}>{a.status} · {a.duration_minutes} min</td>
                      <td style={{ textAlign: "right" }}><Button asChild variant="ghost" size="sm"><Link href={`/visits/${a.id}`}>Open</Link></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </Section>

        {/* Past */}
        <Section title={<>Past visits <span className="count">· {pastRes.data?.length ?? 0}</span></>} description="Completed, cancelled and missed appointments." flush>
          {!pastRes.data || pastRes.data.length === 0
            ? <div className="empty">None.</div>
            : (
              <table className="tbl">
                <tbody>
                  {pastRes.data.map(a => (
                    <tr key={a.id}>
                      <td className="strong num" style={{ width: 200 }}>{fmt(a.scheduled_at)}</td>
                      <td style={{ color: "var(--fg-muted)" }}>{a.status}</td>
                      <td style={{ textAlign: "right" }}><Button asChild variant="ghost" size="sm"><Link href={`/visits/${a.id}`}>Open</Link></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </Section>

        {/* Medical records */}
        <Section title={<>Medical records <span className="count">· {records.length}</span></>} description="Diagnoses and notes from completed visits. Not visible to secretaries." flush>
          {records.length === 0
            ? <div className="empty">No records visible to you.</div>
            : records.map(r => (
              <div key={r.id} className="queue-row" style={{ gridTemplateColumns: "1fr" }}>
                <div>
                  <div className="strong">{r.visit_date} — {r.diagnosis ?? "(no diagnosis)"}</div>
                  {r.notes && <div className="hint" style={{ marginTop: 2 }}>{r.notes}</div>}
                </div>
              </div>
            ))}
        </Section>

        {/* Prescriptions */}
        <Section title={<>Prescriptions <span className="count">· {prescriptions.length}</span></>} description="Medications issued at visits." flush>
          {prescriptions.length === 0
            ? <div className="empty">None.</div>
            : prescriptions.map(p => (
              <div key={p.id} className="queue-row" style={{ gridTemplateColumns: "1fr" }}>
                <div>
                  <div className="strong">
                    {p.name}
                    <span style={{ color: "var(--fg-muted)", fontWeight: 400 }}>
                      {[p.dosage, p.frequency, p.duration].filter(Boolean).map(x => ` · ${x}`).join("")}
                    </span>
                  </div>
                  {p.instructions && <div className="hint" style={{ marginTop: 2 }}>{p.instructions}</div>}
                </div>
              </div>
            ))}
        </Section>

        {/* Lab orders */}
        <Section title={<>Lab orders <span className="count">· {labs.length}</span></>} description="Tests ordered at visits, with attached result files." flush>
          {labs.length === 0
            ? <div className="empty">None.</div>
            : labs.map(l => (
              <div key={l.id} className="queue-row" style={{ gridTemplateColumns: "1fr" }}>
                <div>
                  <div className="strong">{l.name} <span className="badge" style={{ marginLeft: 6 }}>{l.status}</span></div>
                  {l.result && <div className="hint" style={{ marginTop: 2 }}>Result: {l.result}</div>}
                  <div style={{ marginTop: 8 }}>
                    <LabFiles labOrderId={l.id} files={labFilesByOrder[l.id] ?? []} />
                  </div>
                </div>
              </div>
            ))}
        </Section>
      </div>
    </>
  );
}
