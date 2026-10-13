import Link from "next/link";
import { ChevronDownIcon, HistoryIcon, ShieldCheckIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/app/_components/page-header";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const PAGE = 100;
const TZ = "Asia/Manila";

// Audited tables, in plain language.
const AREAS: Record<string, { label: string; noun: string }> = {
  appointments: { label: "Appointments", noun: "an appointment" },
  patients: { label: "Patients", noun: "a patient" },
  medical_records: { label: "Visit records", noun: "a visit record" },
  prescriptions: { label: "Prescriptions", noun: "a prescription" },
  lab_orders: { label: "Lab orders", noun: "a lab order" },
  lab_result_files: { label: "Lab files", noun: "a lab result file" },
  patient_conditions: { label: "Conditions", noun: "a condition" },
  profiles: { label: "Staff access", noun: "staff access" },
};
const OP: Record<string, { verb: string; variant: BadgeVariant; label: string }> = {
  INSERT: { verb: "added", variant: "success", label: "Added" },
  UPDATE: { verb: "changed", variant: "info", label: "Changed" },
  DELETE: { verb: "deleted", variant: "destructive", label: "Deleted" },
};
// Fields that change on every write and aren't worth showing in diffs.
const NOISE = new Set(["updated_at", "created_at", "id", "account_id"]);
const FIELD: Record<string, string> = {
  scheduled_at: "time", duration_minutes: "duration", full_name: "name", date_of_birth: "date of birth",
  chief_complaint: "chief complaint", file_name: "file", doctor_id: "doctor", clinic_id: "clinic", patient_id: "patient",
};

type Ev = { id: number; occurred_at: string; actor_id: string | null; table_name: string; row_id: string | null; operation: string; before: any; after: any };

const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("en-PH", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
const dayOf = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(iso));
const fmtDay = (ymd: string) => new Date(`${ymd}T12:00:00+08:00`).toLocaleDateString("en-PH", { timeZone: TZ, weekday: "long", month: "short", day: "numeric", year: "numeric" });
const show = (v: unknown) => {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v))
    return new Date(v).toLocaleString("en-PH", { timeZone: TZ, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return s.length > 60 ? `${s.slice(0, 60)}…` : s;
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");

type SP = { table?: string; actor?: string; row?: string; days?: string; before?: string };

export default async function AuditPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const sb = await createClient();
  const days = [1, 7, 30, 90].includes(Number(sp.days)) ? Number(sp.days) : 7;
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  let q = sb.from("audit_log")
    .select("id, occurred_at, actor_id, table_name, row_id, operation, before, after")
    .gte("occurred_at", since)
    .order("occurred_at", { ascending: false })
    .limit(PAGE + 1);
  if (sp.table && sp.table in AREAS) q = q.eq("table_name", sp.table);
  if (sp.actor) q = sp.actor === "system" ? q.is("actor_id", null) : q.eq("actor_id", sp.actor);
  if (sp.row) q = q.eq("row_id", sp.row);
  if (sp.before) q = q.lt("occurred_at", sp.before);
  const [{ data, error }, { data: staff }] = await Promise.all([
    q,
    sb.from("profiles").select("id, full_name").in("role", ["admin", "doctor", "secretary"]).order("full_name"),
  ]);
  if (error) throw error;
  const rows = (data ?? []) as Ev[];
  const events = rows.slice(0, PAGE);
  const hasOlder = rows.length > PAGE;

  // Names for actors and for the patient each event is about.
  const actorName = new Map((staff ?? []).map(s => [s.id, s.full_name ?? "Staff"]));
  const patientOf = (e: Ev): string | null =>
    e.table_name === "patients" ? e.row_id : (e.after?.patient_id ?? e.before?.patient_id ?? null);
  const patientIds = [...new Set(events.map(patientOf).filter(Boolean) as string[])];
  const missingActors = [...new Set(events.map(e => e.actor_id).filter(a => a && !actorName.has(a)) as string[])];
  const [{ data: pats }, { data: others }] = await Promise.all([
    patientIds.length ? sb.from("patients").select("id, full_name").in("id", patientIds) : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    missingActors.length ? sb.from("profiles").select("id, full_name").in("id", missingActors) : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
  ]);
  const patientName = new Map((pats ?? []).map(p => [p.id, p.full_name]));
  for (const o of others ?? []) actorName.set(o.id, o.full_name ?? "Former staff");

  const describe = (e: Ev) => {
    const area = AREAS[e.table_name] ?? { label: e.table_name, noun: e.table_name };
    const rec = e.after ?? e.before ?? {};
    const pid = patientOf(e);
    const who = pid ? patientName.get(pid) ?? (e.operation === "DELETE" ? rec.full_name : null) ?? "a patient" : null;
    const op = OP[e.operation]?.verb ?? e.operation.toLowerCase();
    if (e.table_name === "appointments" && e.operation === "INSERT") return { what: "booked an appointment", who };
    // Patient events name the patient directly ("added patient Maria Santos").
    if (e.table_name === "patients") {
      const n = who ?? rec.full_name ?? "a patient";
      if (e.operation === "UPDATE") return { what: "updated the details of", who: n, direct: true };
      return { what: `${op} patient`, who: n, direct: true };
    }
    if (e.table_name === "prescriptions" && e.operation === "INSERT") return { what: `prescribed ${rec.name ?? "a medication"}`, who };
    if (e.table_name === "lab_orders" && e.operation === "INSERT") return { what: `ordered ${rec.name ?? "a lab test"}`, who };
    if (e.table_name === "lab_result_files") return { what: e.operation === "INSERT" ? "uploaded a lab result file" : `${op} a lab result file`, who };
    if (e.table_name === "medical_records" && e.operation === "INSERT") return { what: "completed a visit record", who };
    if (e.table_name === "patient_conditions" && e.operation === "INSERT") return { what: `added condition ${rec.name ?? ""}`.trim(), who };
    return { what: `${op} ${area.noun}`, who };
  };
  const diff = (e: Ev) => {
    if (e.operation !== "UPDATE" || !e.before || !e.after) return [];
    const keys = new Set([...Object.keys(e.before), ...Object.keys(e.after)]);
    return [...keys].filter(k => !NOISE.has(k) && JSON.stringify(e.before[k]) !== JSON.stringify(e.after[k]))
      .map(k => ({ field: FIELD[k] ?? k.replace(/_/g, " "), from: e.before[k], to: e.after[k], key: k }));
  };

  const byDay = new Map<string, Ev[]>();
  for (const e of events) byDay.set(dayOf(e.occurred_at), [...(byDay.get(dayOf(e.occurred_at)) ?? []), e]);

  const href = (over: Partial<SP>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, before: undefined, ...over })) if (v) p.set(k, String(v));
    const s = p.toString();
    return s ? `/admin/audit?${s}` : "/admin/audit";
  };
  const filtered = Boolean(sp.table || sp.actor || sp.row);

  return (
    <>
      <PageHeader icon="shield" title="Audit log"
        sub={`Every change to patients, appointments and clinical records — who, what and when · last ${days} day${days === 1 ? "" : "s"}`} />

      <form method="get" className="filters flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {[1, 7, 30, 90].map(d => (
            <Button key={d} asChild size="sm" variant={days === d ? "outline" : "ghost"} className={cn(days === d && "bg-background shadow-xs")}>
              <Link href={href({ days: String(d) })}>{d === 1 ? "24 hours" : `${d} days`}</Link>
            </Button>
          ))}
        </div>
        <input type="hidden" name="days" value={days} />
        {sp.row && <input type="hidden" name="row" value={sp.row} />}
        <NativeSelect name="table" defaultValue={sp.table ?? ""} aria-label="Area" className="w-44">
          <NativeSelectOption value="">Everything</NativeSelectOption>
          {Object.entries(AREAS).map(([k, a]) => <NativeSelectOption key={k} value={k}>{a.label}</NativeSelectOption>)}
        </NativeSelect>
        <NativeSelect name="actor" defaultValue={sp.actor ?? ""} aria-label="Who" className="w-48">
          <NativeSelectOption value="">Anyone</NativeSelectOption>
          {(staff ?? []).map(s => <NativeSelectOption key={s.id} value={s.id}>{s.full_name}</NativeSelectOption>)}
          <NativeSelectOption value="system">System / online booking</NativeSelectOption>
        </NativeSelect>
        <Button type="submit" variant="outline" size="sm">Apply</Button>
        {filtered && <Button asChild variant="link" size="sm"><Link href={href({ table: undefined, actor: undefined, row: undefined })}>Clear</Link></Button>}
      </form>

      {sp.row && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
          <HistoryIcon className="size-4 text-primary" />
          Showing the full history of one record.
          <Link href={href({ row: undefined })} className="ml-auto text-primary hover:underline">Show everything</Link>
        </div>
      )}

      {events.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
          <div className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground"><ShieldCheckIcon className="size-5" /></div>
          <div className="text-sm text-muted-foreground">No changes in this range{filtered ? " match these filters" : ""}.</div>
        </div>
      ) : (
        <div className="grid gap-4">
          {[...byDay].map(([day, list]) => (
            <section key={day} className="card overflow-hidden">
              <div className="border-b bg-muted/50 px-4 py-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {fmtDay(day)} <span className="font-normal normal-case tracking-normal">· {list.length} change{list.length === 1 ? "" : "s"}</span>
              </div>
              <ul className="divide-y">
                {list.map(e => {
                  const d = describe(e);
                  const changes = diff(e);
                  const actor = e.actor_id ? actorName.get(e.actor_id) ?? "Former staff" : "System";
                  const op = OP[e.operation];
                  return (
                    <li key={e.id} className="grid gap-1.5 px-4 py-3">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                        <span className="w-16 shrink-0 text-xs tabular-nums text-muted-foreground">{fmtTime(e.occurred_at)}</span>
                        <Badge variant={op?.variant ?? "secondary"}>{op?.label ?? e.operation}</Badge>
                        <span>
                          <span className="font-medium">{actor}</span> {d.what}
                          {d.who && <>{"direct" in d && d.direct ? " " : " for "}<span className="font-medium">{d.who}</span></>}
                        </span>
                        <span className="ml-auto text-xs text-muted-foreground">{AREAS[e.table_name]?.label ?? e.table_name}</span>
                      </div>
                      {changes.length > 0 && (
                        <ul className="ml-[4.5rem] grid gap-0.5 text-xs">
                          {changes.slice(0, 6).map(c => (
                            <li key={c.key} className="text-muted-foreground">
                              {cap(c.field)}: <span className="line-through decoration-muted-foreground/60">{show(c.from)}</span>
                              {" → "}<span className="font-medium text-foreground">{show(c.to)}</span>
                            </li>
                          ))}
                          {changes.length > 6 && <li className="text-muted-foreground">+{changes.length - 6} more fields</li>}
                        </ul>
                      )}
                      <div className="ml-[4.5rem] flex flex-wrap gap-3 text-xs">
                        {e.row_id && !sp.row && (
                          <Link href={href({ row: e.row_id })} className="text-primary hover:underline">History of this record</Link>
                        )}
                        <details className="group">
                          <summary className="flex cursor-pointer list-none items-center gap-1 text-muted-foreground hover:text-foreground">
                            Raw data <ChevronDownIcon className="size-3 transition-transform group-open:rotate-180" />
                          </summary>
                          <pre className="mt-2 max-h-72 overflow-auto rounded-lg border bg-muted/50 p-3 text-[11px] leading-relaxed">
{JSON.stringify({ before: e.before, after: e.after }, null, 2)}
                          </pre>
                        </details>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          {hasOlder && (
            <div className="flex justify-center">
              <Button asChild variant="outline">
                <Link href={`${href({})}${href({}).includes("?") ? "&" : "?"}before=${encodeURIComponent(events[events.length - 1].occurred_at)}`}>
                  Older changes
                </Link>
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
