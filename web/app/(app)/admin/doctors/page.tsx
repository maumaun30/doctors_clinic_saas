import Link from "next/link";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/app/_components/user-avatar";
import { avatarUrl } from "@/lib/avatar";
import { AlertTriangleIcon, ChevronRightIcon, UserPlusIcon, UserRoundXIcon } from "lucide-react";
import { PageHeader } from "@/app/_components/page-header";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEK = [1, 2, 3, 4, 5, 6, 0];
const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

export default async function DoctorsAdmin() {
  const sb = await createClient();
  const now = Date.now();
  const [docsRes, dcRes, availRes, apptRes] = await Promise.all([
    sb.from("doctors").select("profile_id, specialization, prc_license_no, profiles!inner(full_name, avatar_path, deactivated_at)"),
    sb.from("doctor_clinics").select("doctor_id, clinic:clinics!inner(name)"),
    sb.from("doctor_availability").select("doctor_id, weekday, start_time, end_time"),
    sb.from("appointments").select("doctor_id, status, scheduled_at")
      .gte("scheduled_at", new Date(now - 30 * 86_400_000).toISOString())
      .lt("scheduled_at", new Date(now + 7 * 86_400_000).toISOString()),
  ]);
  if (docsRes.error) throw docsRes.error;
  const nowIso = new Date(now).toISOString();

  const doctors = (docsRes.data as any[]).map(d => {
    const id = d.profile_id as string;
    const slots = (availRes.data ?? []).filter(a => a.doctor_id === id);
    const days = WEEK.filter(w => slots.some(s => s.weekday === w)).map(w => DAY[w]);
    const appts = (apptRes.data ?? []).filter(a => a.doctor_id === id);
    return {
      profile_id: id,
      name: d.profiles.full_name as string,
      avatar: avatarUrl(d.profiles.avatar_path),
      removed: Boolean(d.profiles.deactivated_at),
      specialization: d.specialization as string | null,
      prc_license_no: d.prc_license_no as string | null,
      clinics: (dcRes.data ?? []).filter(x => x.doctor_id === id).map(x => (x.clinic as any).name as string).sort(),
      days,
      hours: slots.reduce((s, a) => s + mins(a.end_time) - mins(a.start_time), 0) / 60,
      upcoming: appts.filter(a => a.scheduled_at >= nowIso && (a.status === "scheduled" || a.status === "confirmed")).length,
      seen: appts.filter(a => a.status === "completed").length,
    };
  }).sort((a, b) => Number(a.removed) - Number(b.removed) || a.name.localeCompare(b.name));

  const active = doctors.filter(d => !d.removed);
  const removed = doctors.length - active.length;
  const needsSetup = active.filter(d => !d.clinics.length || !d.hours).length;
  const fmtH = (h: number) => (h % 1 ? h.toFixed(1) : String(h));

  return (
    <>
      <PageHeader icon="user" title="Doctors"
        sub={`${active.length} ${active.length === 1 ? "doctor" : "doctors"}${needsSetup ? ` · ${needsSetup} need setup before they can be booked` : ""}${removed ? ` · ${removed} removed` : ""}`}
        actions={<Button asChild><Link href="/admin/users?role=doctor"><UserPlusIcon /> Invite doctor</Link></Button>} />

      {doctors.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
          <div className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <UserRoundXIcon className="size-5" />
          </div>
          <div>
            <div className="font-medium">No doctors yet</div>
            <div className="text-sm text-muted-foreground">Invite one by email — they get the Doctor role when they sign in.</div>
          </div>
          <Button asChild><Link href="/admin/users?role=doctor"><UserPlusIcon /> Invite doctor</Link></Button>
        </div>
      ) : (
        <div className="card table-wrap">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Doctor</TableHead>
                <TableHead className="hidden md:table-cell">Clinics</TableHead>
                <TableHead>Weekly hours</TableHead>
                <TableHead className="hidden text-right lg:table-cell">Next 7 days</TableHead>
                <TableHead className="hidden text-right lg:table-cell">Seen (30 days)</TableHead>
                <TableHead className="w-10"><span className="sr-only">Manage</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {doctors.map(d => (
                <TableRow key={d.profile_id} className={cn("group", d.removed && "text-muted-foreground")}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <UserAvatar name={d.name} src={d.avatar} />
                      <span className="min-w-0">
                        <Link href={`/admin/doctors/${d.profile_id}`} className="block font-medium group-hover:underline">
                          {d.name}{d.removed && <Badge variant="outline" className="ml-2 align-middle">Access removed</Badge>}
                        </Link>
                        <span className="block text-xs text-muted-foreground">
                          {[d.specialization ?? "No specialization", d.prc_license_no && `PRC ${d.prc_license_no}`].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {d.removed ? <span className="text-sm">—</span> : d.clinics.length
                      ? <div className="flex flex-wrap gap-1">{d.clinics.map(c => <Badge key={c} variant="secondary">{c}</Badge>)}</div>
                      : <Link href={`/admin/doctors/${d.profile_id}`} className="inline-flex items-center gap-1 text-sm text-(--warning) hover:underline">
                          <AlertTriangleIcon className="size-3.5" />No clinic — assign
                        </Link>}
                  </TableCell>
                  <TableCell>
                    {d.removed ? <span className="text-sm">—</span> : d.hours
                      ? <span className="grid">
                          <span className="tabular-nums">{fmtH(d.hours)} h/week</span>
                          <span className="text-xs text-muted-foreground">{d.days.join(", ")}</span>
                        </span>
                      : <Link href={`/admin/doctors/${d.profile_id}`} className="inline-flex items-center gap-1 text-sm text-(--warning) hover:underline">
                          <AlertTriangleIcon className="size-3.5" />No hours — set
                        </Link>}
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums lg:table-cell">{d.upcoming}</TableCell>
                  <TableCell className="hidden text-right tabular-nums lg:table-cell">{d.seen}</TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="icon-sm">
                      <Link href={`/admin/doctors/${d.profile_id}`} aria-label={`Manage ${d.name}`}><ChevronRightIcon /></Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <p className="hint" style={{ marginTop: 12 }}>
        Open a doctor to edit their details, clinics and weekly hours.
      </p>
    </>
  );
}
