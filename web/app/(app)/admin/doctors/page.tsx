import Link from "next/link";
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
      <div className="page-head">
        <div>
          <h1>Doctors</h1>
          <div className="sub">{docsRes.data.length} {docsRes.data.length === 1 ? "doctor" : "doctors"}</div>
        </div>
      </div>

      <p className="hint" style={{ marginBottom: 16 }}>
        New doctors join via OAuth/email and are promoted from <Link href="/admin/users" className="link">Pending users</Link>.
        Manage clinic pairings in <Link href="/admin/assignments" className="link">Assignments</Link>, hours in <Link href="/availability" className="link">Availability</Link>.
      </p>

      <div className="stack">
        {docsRes.data.length === 0 && <div className="card empty">No doctors yet.</div>}
        {docsRes.data.map((d: any) => {
          const clinics = dcRes.data.filter(x => x.doctor_id === d.profile_id);
          const slots = availRes.data.filter(x => x.doctor_id === d.profile_id);
          return (
            <div key={d.profile_id} className="card" style={{ padding: 20 }}>
              <div className="strong" style={{ fontSize: 15 }}>
                {d.profiles.full_name}
                <span style={{ color: "var(--fg-muted)", fontWeight: 400 }}> — {d.specialization ?? "—"}</span>
                {d.prc_license_no && <span className="hint"> · PRC {d.prc_license_no}</span>}
              </div>
              <dl className="kv" style={{ marginTop: 12 }}>
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
            </div>
          );
        })}
      </div>
    </>
  );
}
