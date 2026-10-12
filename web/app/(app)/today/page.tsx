import Link from "next/link";
import { PageHeader } from "@/app/_components/page-header";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/data/queries";
import { getActiveClinicId } from "@/lib/data/clinic-context";
import { setAppointmentStatus } from "@/lib/actions/appointments";
import { Icon } from "@/app/_components/icons";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { StatCard } from "@/app/_components/stat-card";

const STATUS_BADGE: Record<string, { variant: BadgeVariant; label: string }> = {
  scheduled: { variant: "secondary", label: "Scheduled" },
  confirmed: { variant: "info",             label: "Confirmed" },
  completed: { variant: "success",           label: "Completed" },
  cancelled: { variant: "destructive",     label: "Cancelled" },
  no_show: { variant: "destructive",     label: "No-show" },
};

export default async function TodayPage() {
  const sb = await createClient();
  const me = await getMyProfile(sb);
  if (!me) throw new Error("not authenticated");

  const activeClinic = await getActiveClinicId(sb);

  // PH-local "today" bounds in UTC
  const phNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
  const ymd = `${phNow.getFullYear()}-${String(phNow.getMonth() + 1).padStart(2, "0")}-${String(phNow.getDate()).padStart(2, "0")}`;
  const fromIso = `${ymd}T00:00:00+08:00`;
  const toIso = `${ymd}T23:59:59+08:00`;

  let q = sb.from("appointments")
    .select("id, scheduled_at, duration_minutes, status, notes, source, patient:patients!inner(id, full_name, phone)")
    .gte("scheduled_at", fromIso)
    .lte("scheduled_at", toIso)
    .order("scheduled_at");
  if (activeClinic) q = q.eq("clinic_id", activeClinic);
  if (me.role === "doctor") q = q.eq("doctor_id", me.id);
  const { data: appts, error } = await q;
  if (error) throw error;

  async function mark(formData: FormData) {
    "use server";
    await setAppointmentStatus({
      appointment_id: formData.get("appointment_id") as string,
      status: formData.get("status") as any,
    });
    revalidatePath("/today");
  }

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-PH", {
      timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit",
    });

  const buckets = {
    upcoming: appts.filter(a => a.status === "scheduled" || a.status === "confirmed"),
    done: appts.filter(a => a.status === "completed"),
    skipped: appts.filter(a => a.status === "cancelled" || a.status === "no_show"),
  };

  const dateLabel = phNow.toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila", weekday: "long", month: "short", day: "numeric",
  });
  const confirmedCount = appts.filter(a => a.status === "confirmed").length;

  const row = (a: any) => {
    const active = a.status === "scheduled" || a.status === "confirmed";
    const badge = STATUS_BADGE[a.status] ?? STATUS_BADGE.scheduled;
    return (
      <div className="queue-row" key={a.id}>
        <div className="queue-time">
          {fmtTime(a.scheduled_at)}
          <span className="dur">{a.duration_minutes}m</span>
        </div>
        <div className="queue-patient">
          <div style={{ minWidth: 0 }}>
            <div className="name">
              <Link href={`/patients/${a.patient.id}`} style={{ color: "inherit", textDecoration: "none" }}>
                {a.patient.full_name}
              </Link>
            </div>
            <div className="meta">{a.patient.phone ?? "No phone on file"}</div>
          </div>
        </div>
        <div className="queue-actions">
          {a.source === "online" && <Badge variant="info" title="Booked by the patient online">Online</Badge>}
          <Badge variant={badge.variant}><span className="dot" />{badge.label}</Badge>
          {a.status === "scheduled" && (
            <form action={mark}>
              <input type="hidden" name="appointment_id" value={a.id} />
              <input type="hidden" name="status" value="confirmed" />
              <Button variant="ghost" size="icon-sm" type="submit" title="Confirm">
                <Icon name="check" />
              </Button>
            </form>
          )}
          {active && (
            <form action={mark}>
              <input type="hidden" name="appointment_id" value={a.id} />
              <input type="hidden" name="status" value="no_show" />
              <Button variant="ghost" size="sm" type="submit" title="Mark no-show">No-show</Button>
            </form>
          )}
          {active
            ? <Button asChild size="sm"><Link href={`/visits/${a.id}`}>Start visit</Link></Button>
            : <Button asChild variant="ghost" size="sm"><Link href={`/visits/${a.id}`}>View</Link></Button>}
        </div>
      </div>
    );
  };

  return (
    <>
      <PageHeader icon="today" title="Today"
        sub={`${dateLabel} · ${activeClinic ? "Active clinic" : "All clinics"} · ${me.full_name ?? "You"}`}
        actions={<>
          <Button asChild variant="outline"><Link href="/schedule"><Icon name="calendar" /> View schedule</Link></Button>
          <Button asChild><Link href="/schedule#book"><Icon name="plus" /> Book</Link></Button>
        </>} />

      <div className="stats">
        <StatCard label="Scheduled">{appts.length}</StatCard>
        <StatCard label="Confirmed">{confirmedCount}</StatCard>
        <StatCard label="Completed">{buckets.done.length} <small>/ {appts.length}</small></StatCard>
        <StatCard label="Cancelled">{buckets.skipped.length}</StatCard>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="section-bar">Up next <span className="count">· {buckets.upcoming.length} remaining</span></div>
        {buckets.upcoming.length === 0
          ? <div className="empty">Nothing scheduled.</div>
          : <div className="queue">{buckets.upcoming.map(row)}</div>}
      </div>

      {buckets.done.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="section-bar">Completed <span className="count">· {buckets.done.length}</span></div>
          <div className="queue">{buckets.done.map(row)}</div>
        </div>
      )}

      {buckets.skipped.length > 0 && (
        <div className="card">
          <div className="section-bar">Cancelled / No-show <span className="count">· {buckets.skipped.length}</span></div>
          <div className="queue">{buckets.skipped.map(row)}</div>
        </div>
      )}
    </>
  );
}
