import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/app/_components/page-header";
import { getMyProfile } from "@/lib/data/queries";
import { getActiveClinicId } from "@/lib/data/clinic-context";
import { PrintButton } from "@/app/_components/print-button";
import { Button } from "@/components/ui/button";

const STATUS_ORDER = ["scheduled", "confirmed", "completed", "cancelled", "no_show"] as const;
const STATUS_LABEL: Record<string, string> = {
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
};

export default async function AnalyticsPage({
  searchParams,
}: { searchParams: Promise<{ from?: string; to?: string; doctor?: string; status?: string }> }) {
  const sp = await searchParams;
  const sb = await createClient();
  const me = await getMyProfile(sb);
  if (!me) throw new Error("not authenticated");

  const activeClinic = await getActiveClinicId(sb);
  const isDoctor = me.role === "doctor";

  const todayPh = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
  const ymd = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().slice(0, 10);
  const defaultTo = sp.to ?? ymd(todayPh);
  const defaultFrom = sp.from ?? ymd(new Date(todayPh.getTime() - 29 * 86_400_000));

  // Appointments in range (scoped to clinic / doctor like the rest of the app).
  let q = sb.from("appointments")
    .select("id, scheduled_at, duration_minutes, status, patient_id, doctor_id, clinic_id")
    .gte("scheduled_at", `${defaultFrom}T00:00:00+08:00`)
    .lte("scheduled_at", `${defaultTo}T23:59:59+08:00`);
  if (activeClinic) q = q.eq("clinic_id", activeClinic);
  if (isDoctor) q = q.eq("doctor_id", me.id);
  else if (sp.doctor) q = q.eq("doctor_id", sp.doctor);
  if (sp.status && (STATUS_ORDER as readonly string[]).includes(sp.status)) {
    q = q.eq("status", sp.status as (typeof STATUS_ORDER)[number]);
  }
  const { data: apptData, error } = await q;
  if (error) throw error;
  const rows = (apptData ?? []) as any[];

  // Doctor options + name resolution (for the provider filter and breakdown).
  let dcq = sb.from("doctor_clinics")
    .select("doctor_id, doctor:doctors!inner(profiles!inner(full_name))");
  if (activeClinic) dcq = dcq.eq("clinic_id", activeClinic);
  const { data: dcData } = await dcq;
  const doctorName = new Map<string, string>();
  for (const dc of (dcData ?? []) as any[]) {
    doctorName.set(dc.doctor_id, dc.doctor?.profiles?.full_name ?? dc.doctor_id);
  }
  const doctorOpts = Array.from(doctorName, ([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Clinic name for the report header.
  let clinicName = "All clinics";
  if (activeClinic) {
    const { data: c } = await sb.from("clinics").select("name").eq("id", activeClinic).single();
    clinicName = (c as any)?.name ?? "Clinic";
  }

  // ---- aggregate ----
  const total = rows.length;
  const byStatus: Record<string, number> = {};
  for (const r of rows) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
  const completed = byStatus["completed"] ?? 0;
  const cancelled = byStatus["cancelled"] ?? 0;
  const noShow = byStatus["no_show"] ?? 0;
  const completionRate = total ? Math.round((completed / total) * 100) : 0;
  const uniquePatients = new Set(rows.map(r => r.patient_id)).size;
  const totalMinutes = rows.reduce((s, r) => s + (r.duration_minutes || 0), 0);

  const byDoctor = new Map<string, { total: number; completed: number; noShow: number }>();
  for (const r of rows) {
    const m = byDoctor.get(r.doctor_id) ?? { total: 0, completed: 0, noShow: 0 };
    m.total++;
    if (r.status === "completed") m.completed++;
    if (r.status === "no_show") m.noShow++;
    byDoctor.set(r.doctor_id, m);
  }
  const providerRows = Array.from(byDoctor, ([id, m]) => ({
    name: doctorName.get(id) ?? id.slice(0, 8),
    ...m,
  })).sort((a, b) => b.total - a.total);

  // New patients registered in range (best-effort; scoped to clinic).
  let newPatients: number | null = null;
  try {
    let pq = sb.from("patients").select("id, created_at")
      .gte("created_at", `${defaultFrom}T00:00:00+08:00`)
      .lte("created_at", `${defaultTo}T23:59:59+08:00`);
    if (activeClinic) {
      const { data: pcs } = await sb.from("patient_clinics").select("patient_id").eq("clinic_id", activeClinic);
      const ids = ((pcs ?? []) as any[]).map(x => x.patient_id);
      pq = ids.length ? pq.in("id", ids) : pq.eq("id", "00000000-0000-0000-0000-000000000000");
    }
    const { data } = await pq;
    newPatients = data?.length ?? 0;
  } catch { newPatients = null; }

  // Clinical activity in range (best-effort; secretary RLS may block).
  let visitsDocumented: number | null = null;
  try {
    const { count } = await sb.from("medical_records")
      .select("id", { count: "exact", head: true })
      .gte("created_at", `${defaultFrom}T00:00:00+08:00`)
      .lte("created_at", `${defaultTo}T23:59:59+08:00`);
    visitsDocumented = count ?? 0;
  } catch { visitsDocumented = null; }

  const rangeLabel = `${defaultFrom} – ${defaultTo}`;
  const careHours = (totalMinutes / 60).toFixed(1);
  const generated = new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" });

  return (
    <>
      <PageHeader icon="chart" title="Analytics" sub={`${clinicName} · ${rangeLabel}`}
        actions={<PrintButton label="Print report" />} />

      {/* Printed hard-copy header (hidden on screen) */}
      <div className="print-only print-report-head">
        <h1>Analytics report</h1>
        <div className="meta">
          Clinic: {clinicName}<br />
          Date range: {rangeLabel}<br />
          {sp.status ? <>Status: {STATUS_LABEL[sp.status] ?? sp.status}<br /></> : null}
          {!isDoctor && sp.doctor ? <>Provider: {doctorName.get(sp.doctor) ?? sp.doctor}<br /></> : null}
          {isDoctor ? <>Provider: {me.full_name}<br /></> : null}
          Generated: {generated}
        </div>
      </div>

      <form method="get" className="filters">
        <label className="field" style={{ margin: 0 }}>
          <span className="label">From</span>
          <input className="input" type="date" name="from" defaultValue={defaultFrom} style={{ width: 170 }} />
        </label>
        <label className="field" style={{ margin: 0 }}>
          <span className="label">To</span>
          <input className="input" type="date" name="to" defaultValue={defaultTo} style={{ width: 170 }} />
        </label>
        {!isDoctor && (
          <label className="field" style={{ margin: 0 }}>
            <span className="label">Provider</span>
            <select className="select" name="doctor" defaultValue={sp.doctor ?? ""}>
              <option value="">All providers</option>
              {doctorOpts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
        )}
        <label className="field" style={{ margin: 0 }}>
          <span className="label">Status</span>
          <select className="select" name="status" defaultValue={sp.status ?? ""}>
            <option value="">All statuses</option>
            {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </label>
        <Button variant="outline" type="submit" style={{ alignSelf: "flex-end" }}>Apply</Button>
      </form>

      <div className="stats">
        <div className="card stat"><div className="k">Appointments</div><div className="v">{total}</div></div>
        <div className="card stat"><div className="k">Completed</div><div className="v">{completed} <small>/ {total}</small></div></div>
        <div className="card stat"><div className="k">Completion rate</div><div className="v">{completionRate}<small>%</small></div></div>
        <div className="card stat"><div className="k">No-show</div><div className="v">{noShow}</div></div>
        <div className="card stat"><div className="k">Cancelled</div><div className="v">{cancelled}</div></div>
        <div className="card stat"><div className="k">Unique patients</div><div className="v">{uniquePatients}</div></div>
        <div className="card stat"><div className="k">New patients</div><div className="v">{newPatients ?? "—"}</div></div>
        <div className="card stat"><div className="k">Care hours</div><div className="v">{careHours}<small>h</small></div></div>
      </div>

      <div className="stack">
        <div className="card table-wrap">
          <div className="section-bar">By status</div>
          <table className="tbl">
            <thead><tr><th>Status</th><th>Count</th><th>Share</th></tr></thead>
            <tbody>
              {STATUS_ORDER.filter(s => byStatus[s]).map(s => (
                <tr key={s}>
                  <td className="strong">{STATUS_LABEL[s]}</td>
                  <td className="num">{byStatus[s]}</td>
                  <td className="num">{total ? Math.round((byStatus[s] / total) * 100) : 0}%</td>
                </tr>
              ))}
              {total === 0 && <tr><td colSpan={3} className="empty">No appointments in this range.</td></tr>}
            </tbody>
          </table>
        </div>

        {!isDoctor && providerRows.length > 0 && (
          <div className="card table-wrap">
            <div className="section-bar">By provider <span className="count">· {providerRows.length}</span></div>
            <table className="tbl">
              <thead><tr><th>Provider</th><th>Appointments</th><th>Completed</th><th>No-show</th><th>Completion</th></tr></thead>
              <tbody>
                {providerRows.map((p, i) => (
                  <tr key={i}>
                    <td className="strong">{p.name}</td>
                    <td className="num">{p.total}</td>
                    <td className="num">{p.completed}</td>
                    <td className="num">{p.noShow}</td>
                    <td className="num">{p.total ? Math.round((p.completed / p.total) * 100) : 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {visitsDocumented != null && (
          <div className="card" style={{ padding: 20 }}>
            <div className="section-title">Clinical activity</div>
            <dl className="kv">
              <dt>Visits documented</dt><dd>{visitsDocumented}</dd>
            </dl>
          </div>
        )}
      </div>
    </>
  );
}
