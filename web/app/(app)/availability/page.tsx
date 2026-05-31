import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/data/queries";
import { getActiveClinicId } from "@/lib/data/clinic-context";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function AvailabilityPage() {
  const sb = await createClient();
  const me = await getMyProfile(sb);
  if (!me) throw new Error("not authenticated");

  const isAdmin = me.role === "admin";
  const isDoctor = me.role === "doctor";
  if (!isAdmin && !isDoctor) {
    return (
      <>
        <div className="page-head"><div><h1>Availability</h1></div></div>
        <div className="card empty">Only doctors and admins manage availability.</div>
      </>
    );
  }

  const activeClinic = await getActiveClinicId(sb);
  let dcQuery = sb
    .from("doctor_clinics")
    .select("id, doctor_id, clinic_id, doctor:doctors!inner(profiles!inner(full_name)), clinic:clinics!inner(name)");
  if (isDoctor) dcQuery = dcQuery.eq("doctor_id", me.id);
  if (activeClinic) dcQuery = dcQuery.eq("clinic_id", activeClinic);
  const { data: dcs, error: dcErr } = await dcQuery;
  if (dcErr) throw dcErr;

  const { data: avail, error: avErr } = await sb
    .from("doctor_availability")
    .select("*")
    .order("weekday").order("start_time");
  if (avErr) throw avErr;

  async function add(formData: FormData) {
    "use server";
    const [doctor_id, clinic_id] = (formData.get("dc") as string).split("|");
    const sb = await createClient();
    const { error } = await sb.from("doctor_availability").insert({
      doctor_id, clinic_id,
      weekday: Number(formData.get("weekday")),
      start_time: formData.get("start_time") as string,
      end_time: formData.get("end_time") as string,
    });
    if (error) throw new Error(error.message);
    revalidatePath("/availability");
  }

  async function remove(formData: FormData) {
    "use server";
    const sb = await createClient();
    const { error } = await sb.from("doctor_availability")
      .delete().eq("id", formData.get("id") as string);
    if (error) throw new Error(error.message);
    revalidatePath("/availability");
  }

  const dcLabel = (doctor_id: string, clinic_id: string) => {
    const dc = dcs?.find(d => d.doctor_id === doctor_id && d.clinic_id === clinic_id) as any;
    return dc ? `${dc.doctor.profiles.full_name} @ ${dc.clinic.name}` : `${doctor_id} / ${clinic_id}`;
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Availability</h1>
          <div className="sub">Weekly working hours · times are clinic-local (Asia/Manila)</div>
        </div>
      </div>

      <div className="stack">
        <div className="card table-wrap">
          <div className="section-bar">Current slots <span className="count">· {avail?.length ?? 0}</span></div>
          <table className="tbl">
            <thead>
              <tr><th>Doctor @ Clinic</th><th>Day</th><th>Start</th><th>End</th><th></th></tr>
            </thead>
            <tbody>
              {avail?.map(a => (
                <tr key={a.id}>
                  <td className="strong">{dcLabel(a.doctor_id, a.clinic_id)}</td>
                  <td>{DAYS[a.weekday]}</td>
                  <td className="num">{a.start_time}</td>
                  <td className="num">{a.end_time}</td>
                  <td style={{ textAlign: "right" }}>
                    <form action={remove}>
                      <input type="hidden" name="id" value={a.id} />
                      <button type="submit" className="btn btn-ghost btn-sm">Delete</button>
                    </form>
                  </td>
                </tr>
              ))}
              {(!avail || avail.length === 0) && (
                <tr><td colSpan={5} className="empty">No availability set.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div>
          <div className="section-title" style={{ marginBottom: 12 }}>Add slot</div>
          {(!dcs || dcs.length === 0)
            ? <p className="hint">No doctor↔clinic pairings yet — set them up under Admin → Assignments.</p>
            : (
              <form action={add} className="card" style={{ maxWidth: 560, padding: 24 }}>
                <div className="field">
                  <label className="label">Doctor{activeClinic ? "" : " @ clinic"}</label>
                  <select className="select" name="dc" required defaultValue="" style={{ width: "100%" }}>
                    <option value="" disabled>{activeClinic ? "— select doctor —" : "— select doctor @ clinic —"}</option>
                    {dcs.map((dc: any) => (
                      <option key={dc.id} value={`${dc.doctor_id}|${dc.clinic_id}`}>
                        {activeClinic ? dc.doctor.profiles.full_name : `${dc.doctor.profiles.full_name} @ ${dc.clinic.name}`}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label className="label">Weekday</label>
                  <select className="select" name="weekday" defaultValue="1" required style={{ width: "100%" }}>
                    {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                </div>
                <div className="grid-2">
                  <div className="field">
                    <label className="label">Start</label>
                    <input className="input" type="time" name="start_time" defaultValue="09:00" required />
                  </div>
                  <div className="field">
                    <label className="label">End</label>
                    <input className="input" type="time" name="end_time" defaultValue="17:00" required />
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button type="submit" className="btn btn-primary">Add slot</button>
                </div>
              </form>
            )}
        </div>
      </div>
    </>
  );
}
