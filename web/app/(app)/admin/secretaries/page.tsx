import Link from "next/link";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/app/_components/user-avatar";
import { avatarUrl } from "@/lib/avatar";
import { AlertTriangleIcon, ChevronRightIcon, UserPlusIcon, UsersRoundIcon } from "lucide-react";
import { PageHeader } from "@/app/_components/page-header";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";


export default async function SecretariesAdmin() {
  const sb = await createClient();
  const [secRes, caRes, dcRes] = await Promise.all([
    sb.from("profiles").select("id, full_name, phone, avatar_path, deactivated_at").eq("role", "secretary").order("full_name"),
    sb.from("clinic_assignments").select("secretary_id, doctor_clinic_id"),
    sb.from("doctor_clinics").select("id, doctor:doctors!inner(profiles!inner(full_name)), clinic:clinics!inner(name)"),
  ]);
  if (secRes.error) throw secRes.error;
  const pairLabel = new Map(((dcRes.data ?? []) as any[]).map(dc => [dc.id as string, {
    doctor: dc.doctor.profiles.full_name as string, clinic: dc.clinic.name as string,
  }]));

  const secretaries = secRes.data.map(s => {
    const mine = (caRes.data ?? []).filter(a => a.secretary_id === s.id)
      .map(a => pairLabel.get(a.doctor_clinic_id)).filter(Boolean) as { doctor: string; clinic: string }[];
    return { ...s, removed: Boolean(s.deactivated_at), doctors: mine, clinics: [...new Set(mine.map(m => m.clinic))].sort() };
  }).sort((a, b) => Number(a.removed) - Number(b.removed));
  const active = secretaries.filter(s => !s.removed);
  const removed = secretaries.length - active.length;
  const unassigned = active.filter(s => s.doctors.length === 0).length;

  return (
    <>
      <PageHeader icon="users" title="Secretaries"
        sub={`${active.length} ${active.length === 1 ? "secretary" : "secretaries"}${unassigned ? ` · ${unassigned} not assigned to any doctor` : ""}${removed ? ` · ${removed} removed` : ""}`}
        actions={<Button asChild><Link href="/admin/users?role=secretary"><UserPlusIcon /> Invite secretary</Link></Button>} />

      {secretaries.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
          <div className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <UsersRoundIcon className="size-5" />
          </div>
          <div>
            <div className="font-medium">No secretaries yet</div>
            <div className="text-sm text-muted-foreground">Front-desk staff book and manage appointments for the doctors they support.</div>
          </div>
          <Button asChild><Link href="/admin/users?role=secretary"><UserPlusIcon /> Invite secretary</Link></Button>
        </div>
      ) : (
        <div className="card table-wrap">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Secretary</TableHead>
                <TableHead>Supports</TableHead>
                <TableHead className="hidden md:table-cell">Clinics</TableHead>
                <TableHead className="w-10"><span className="sr-only">Manage</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {secretaries.map(s => (
                <TableRow key={s.id} className={cn("group", s.removed && "text-muted-foreground")}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <UserAvatar name={s.full_name ?? ""} src={avatarUrl(s.avatar_path)} />
                      <span className="min-w-0">
                        <Link href={`/admin/secretaries/${s.id}`} className="block font-medium group-hover:underline">
                          {s.full_name}{s.removed && <Badge variant="outline" className="ml-2 align-middle">Access removed</Badge>}
                        </Link>
                        <span className="block text-xs text-muted-foreground">{s.phone ?? "No phone"}</span>
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    {s.removed ? <span className="text-sm">—</span> : s.doctors.length
                      ? <div className="flex flex-wrap gap-1">
                          {[...new Set(s.doctors.map(d => d.doctor))].sort().map(d => <Badge key={d} variant="secondary">{d}</Badge>)}
                        </div>
                      : <Link href={`/admin/secretaries/${s.id}`} className="inline-flex items-center gap-1 text-sm text-(--warning) hover:underline">
                          <AlertTriangleIcon className="size-3.5" />Not assigned — assign
                        </Link>}
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground md:table-cell">{s.clinics.join(", ") || "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="icon-sm">
                      <Link href={`/admin/secretaries/${s.id}`} aria-label={`Manage ${s.full_name}`}><ChevronRightIcon /></Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <p className="hint" style={{ marginTop: 12 }}>Open a secretary to edit their details and the doctors they support.</p>
    </>
  );
}
