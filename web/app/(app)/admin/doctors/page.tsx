import Link from "next/link";
import { PageHeader } from "@/app/_components/page-header";
import { Section } from "@/app/_components/section";
import { createClient } from "@/lib/supabase/server";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function DoctorsAdmin() {
  const sb = await createClient();
  const [docsRes, dcRes, availRes] = await Promise.all([
    sb.from("doctors").select("profile_id, specialization, prc_license_no, profiles!inner(full_name)"),
    sb.from("doctor_clinics").select("doctor_id, clinic_id, clinic:clinics!inner(name)"),
    sb.from("doctor_availability").select("doctor_id, clinic_id, weekday, start_time, end_time")
      .order("weekday").order("start_time"),
  ]);
  if (docsRes.error) throw docsRes.error;
  if (dcRes.error) throw dcRes.error;
  if (availRes.error) throw availRes.error;

  return (
    <>
      <PageHeader icon="user" title="Doctors"
        sub={<>{docsRes.data.length} {docsRes.data.length === 1 ? "doctor" : "doctors"} · promote new sign-ins in <Link href="/admin/users" className="link">Pending users</Link></>} />

      <div>
        {docsRes.data.length === 0 && (
          <Section title="No doctors yet" description="Doctors sign in, then you give them the Doctor role in Pending users.">
            <div className="empty">No doctors yet.</div>
          </Section>
        )}
        {docsRes.data.map((d: any) => {
          const clinics = dcRes.data.filter(x => x.doctor_id === d.profile_id);
          const slots = availRes.data.filter(x => x.doctor_id === d.profile_id);
          return (
            <Section key={d.profile_id} title={d.profiles.full_name}
              description={[d.specialization ?? "No specialization", d.prc_license_no && `PRC ${d.prc_license_no}`].filter(Boolean).join(" · ")}>
              <dl className="kv">
                <dt>Clinics</dt>
                <dd>{clinics.length === 0 ? <span className="hint">none</span> : clinics.map((c: any) => c.clinic.name).join(", ")}</dd>
                <dt>Availability</dt>
                <dd>
                  {slots.length === 0 ? <span className="hint">none</span> : (
                    <span style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {slots.map((s, i) => (
                        <span key={i} className="badge"><span className="num">{DAYS[s.weekday]} {s.start_time}–{s.end_time}</span></span>
                      ))}
                    </span>
                  )}
                </dd>
              </dl>
              <p className="hint" style={{ marginTop: 14 }}>
                Clinics in <Link href="/admin/assignments" className="link">Assignments</Link> · hours in <Link href="/availability" className="link">Availability</Link>
              </p>
            </Section>
          );
        })}
      </div>
    </>
  );
}
