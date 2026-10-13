import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon, CopyIcon, SearchXIcon } from "lucide-react";
import { PageHeader } from "@/app/_components/page-header";
import { createClient } from "@/lib/supabase/server";
import { getActiveClinicId } from "@/lib/data/clinic-context";
import { getMyProfile } from "@/lib/data/queries";
import { Icon } from "@/app/_components/icons";
import { ageYearsMonths } from "@/app/_components/age";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PatientDialog } from "./patient-dialog";
import { PatientFilters } from "./filters";
import { phYmd, phYmdOffset } from "@/lib/dates";

const PAGE = 50;
const TZ = "Asia/Manila";
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-PH", { timeZone: TZ, month: "short", day: "numeric", year: "numeric" });
const fmtNext = (iso: string) =>
  new Date(iso).toLocaleString("en-PH", { timeZone: TZ, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function initials(name: string) {
  return (name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("") || "?");
}

type SP = { q?: string; sex?: string; age?: string; visit?: string; sort?: string; page?: string };

export default async function PatientsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const sb = await createClient();
  const [activeClinic, me] = await Promise.all([getActiveClinicId(sb), getMyProfile(sb)]);
  const clinical = me?.role !== "secretary";
  const page = Math.max(1, Number(sp.page) || 1);
  const nowIso = new Date().toISOString();

  // Appointment-based filters resolve to patient id sets first.
  const apptIds = async (build: (q: any) => any) => {
    let q = sb.from("appointments").select("patient_id");
    if (activeClinic) q = q.eq("clinic_id", activeClinic);
    const { data } = await build(q);
    return [...new Set((data ?? []).map((r: { patient_id: string }) => r.patient_id))] as string[];
  };

  let query = sb.from("patients")
    .select(`id, full_name, date_of_birth, sex, phone, email, created_at${activeClinic ? ", patient_clinics!inner(clinic_id)" : ""}`,
      { count: "exact" }) as any;
  if (activeClinic) query = query.eq("patient_clinics.clinic_id", activeClinic);

  // Strip PostgREST filter syntax characters from free text.
  const term = (sp.q ?? "").replace(/[,()%*\\]/g, " ").trim();
  if (term) query = query.or(`full_name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`);
  if (sp.sex === "female" || sp.sex === "male" || sp.sex === "other") query = query.eq("sex", sp.sex);

  const today = phYmd();
  const yearsAgo = (n: number) => `${Number(today.slice(0, 4)) - n}${today.slice(4)}`;
  if (sp.age === "child") query = query.gt("date_of_birth", yearsAgo(18));
  if (sp.age === "adult") query = query.lte("date_of_birth", yearsAgo(18)).gt("date_of_birth", yearsAgo(60));
  if (sp.age === "senior") query = query.lte("date_of_birth", yearsAgo(60));

  if (sp.visit === "upcoming") {
    const ids = await apptIds(q => q.gte("scheduled_at", nowIso).in("status", ["scheduled", "confirmed"]));
    query = query.in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  } else if (sp.visit === "lapsed") {
    const ids = await apptIds(q => q.eq("status", "completed").gte("scheduled_at", `${phYmdOffset(-182)}T00:00:00+08:00`));
    if (ids.length) query = query.not("id", "in", `(${ids.join(",")})`);
  } else if (sp.visit === "new") {
    query = query.gte("created_at", `${phYmdOffset(-30)}T00:00:00+08:00`);
  }

  query = sp.sort === "recent"
    ? query.order("created_at", { ascending: false })
    : query.order("full_name");
  const { data, count, error } = await query.range((page - 1) * PAGE, page * PAGE - 1);
  if (error) throw error;
  const patients = (data ?? []) as Array<{
    id: string; full_name: string; date_of_birth: string | null; sex: string | null; phone: string | null; email: string | null;
  }>;
  const total = count ?? patients.length;

  // Per-row context for just this page: last completed visit, next booking, active problems.
  const ids = patients.map(p => p.id);
  const last = new Map<string, string>();
  const next = new Map<string, string>();
  const problems = new Map<string, string[]>();
  if (ids.length) {
    let aq = sb.from("appointments").select("patient_id, scheduled_at, status").in("patient_id", ids).order("scheduled_at");
    if (activeClinic) aq = aq.eq("clinic_id", activeClinic);
    const [{ data: appts }, condRes] = await Promise.all([
      aq,
      clinical
        ? sb.from("patient_conditions").select("patient_id, name").in("patient_id", ids).eq("status", "active")
        : Promise.resolve({ data: [] as { patient_id: string; name: string }[] }),
    ]);
    for (const a of appts ?? []) {
      if (a.status === "completed" && a.scheduled_at < nowIso) last.set(a.patient_id, a.scheduled_at);
      if ((a.status === "scheduled" || a.status === "confirmed") && a.scheduled_at >= nowIso && !next.has(a.patient_id))
        next.set(a.patient_id, a.scheduled_at);
    }
    for (const c of condRes.data ?? []) problems.set(c.patient_id, [...(problems.get(c.patient_id) ?? []), c.name]);
  }

  const filtered = Boolean(term || sp.sex || sp.age || sp.visit);
  const pageHref = (n: number) => {
    const p = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "page") as [string, string][]);
    if (n > 1) p.set("page", String(n));
    const s = p.toString();
    return s ? `/patients?${s}` : "/patients";
  };
  const from = total === 0 ? 0 : (page - 1) * PAGE + 1;
  const to = Math.min(page * PAGE, total);

  return (
    <>
      <PageHeader icon="users" title="Patients"
        sub={`${total} ${total === 1 ? "patient" : "patients"}${filtered ? " match" : ""}${activeClinic ? " · active clinic" : " · all clinics"}`}
        actions={<>
          {me?.role === "admin" && (
            <Button asChild variant="outline"><Link href="/patients/duplicates"><CopyIcon /> Duplicates</Link></Button>
          )}
          {activeClinic && <PatientDialog />}
        </>} />

      <PatientFilters />

      {patients.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
          <div className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <SearchXIcon className="size-5" />
          </div>
          <div>
            <div className="font-medium">{filtered ? "No patients match these filters" : "No patients yet"}</div>
            <div className="text-sm text-muted-foreground">
              {filtered ? "Try fewer filters, or part of the name or phone number." : "Add the first patient for this clinic."}
            </div>
          </div>
          <div className="flex gap-2">
            {filtered && <Button asChild variant="outline"><Link href="/patients">Clear filters</Link></Button>}
            {activeClinic && <PatientDialog />}
          </div>
        </div>
      ) : (
        <div className="card table-wrap">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient</TableHead>
                <TableHead className="hidden md:table-cell">Mobile</TableHead>
                <TableHead className="hidden md:table-cell">Last visit</TableHead>
                <TableHead className="hidden lg:table-cell">Next appointment</TableHead>
                {clinical && <TableHead className="hidden xl:table-cell">Active problems</TableHead>}
                <TableHead className="w-10"><span className="sr-only">Open</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {patients.map(p => {
                const meta = [p.sex, ageYearsMonths(p.date_of_birth)].filter(Boolean).join(" · ");
                const probs = problems.get(p.id) ?? [];
                const nx = next.get(p.id);
                const ls = last.get(p.id);
                return (
                  <TableRow key={p.id} className="group">
                    <TableCell>
                      <Link href={`/patients/${p.id}`} className="flex items-center gap-3">
                        <span className="avatar">{initials(p.full_name)}</span>
                        <span className="min-w-0">
                          <span className="block font-medium group-hover:underline">{p.full_name}</span>
                          <span className="block text-xs text-muted-foreground capitalize">
                            {meta || "—"}<span className="md:hidden">{p.phone ? ` · ${p.phone}` : ""}</span>
                          </span>
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell className="hidden tabular-nums md:table-cell">
                      {p.phone ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {ls ? fmtDate(ls) : <span className="text-muted-foreground">Never</span>}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {nx ? <Badge variant="info">{fmtNext(nx)}</Badge> : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    {clinical && (
                      <TableCell className="hidden max-w-60 xl:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {probs.slice(0, 2).map(n => <Badge key={n} variant="warning">{n}</Badge>)}
                          {probs.length > 2 && <Badge variant="secondary">+{probs.length - 2}</Badge>}
                          {probs.length === 0 && <span className="text-muted-foreground">—</span>}
                        </div>
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="icon-sm">
                        <Link href={`/patients/${p.id}`} aria-label={`Open ${p.full_name}`}><Icon name="chevright" /></Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {total > PAGE && (
            <div className="flex items-center justify-between border-t px-4 py-2 text-sm text-muted-foreground">
              <span className="tabular-nums">{from}–{to} of {total}</span>
              <div className="flex gap-1">
                <Button asChild={page > 1} variant="outline" size="sm" disabled={page <= 1}>
                  {page > 1 ? <Link href={pageHref(page - 1)}><ChevronLeftIcon /> Previous</Link> : <span><ChevronLeftIcon /> Previous</span>}
                </Button>
                <Button asChild={to < total} variant="outline" size="sm" disabled={to >= total}>
                  {to < total ? <Link href={pageHref(page + 1)}>Next <ChevronRightIcon /></Link> : <span>Next <ChevronRightIcon /></span>}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {!activeClinic && (
        <p className="hint" style={{ marginTop: 16 }}>Pick an active clinic in the sidebar to add a patient.</p>
      )}
    </>
  );
}
