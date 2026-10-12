import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/app/_components/page-header";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Input } from "@/components/ui/input";
import { Badge, type BadgeVariant } from "@/components/ui/badge";

const TABLES = [
  "patients", "medical_records", "prescriptions", "lab_orders",
  "lab_result_files", "patient_conditions", "appointments",
];

const OP_BADGE: Record<string, BadgeVariant> = {
  INSERT: "success",
  UPDATE: "info",
  DELETE: "destructive",
};

export default async function AuditPage({
  searchParams,
}: { searchParams: Promise<{ table?: string; actor?: string; row?: string; days?: string }> }) {
  const sp = await searchParams;
  const sb = await createClient();

  const days = Number(sp.days ?? 7);
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  let q = sb.from("audit_log")
    .select("id, occurred_at, actor_id, table_name, row_id, operation, before, after")
    .gte("occurred_at", since)
    .order("occurred_at", { ascending: false })
    .limit(500);
  if (sp.table) q = q.eq("table_name", sp.table);
  if (sp.actor) q = q.eq("actor_id", sp.actor);
  if (sp.row)   q = q.eq("row_id", sp.row);
  const { data: events, error } = await q;
  if (error) throw error;

  const actorIds = Array.from(new Set((events ?? []).map(e => e.actor_id).filter(Boolean) as string[]));
  let actors: Record<string, string> = {};
  if (actorIds.length > 0) {
    const { data } = await sb.from("profiles").select("id, full_name").in("id", actorIds);
    actors = Object.fromEntries((data ?? []).map(p => [p.id, p.full_name ?? p.id]));
  }

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("en-PH", { timeZone: "Asia/Manila" });

  const changedFields = (before: any, after: any) => {
    if (!before || !after) return null;
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    const diffs: string[] = [];
    for (const k of keys) {
      if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) diffs.push(k);
    }
    return diffs;
  };

  return (
    <>
      <PageHeader icon="shield" title="Audit log"
        sub={`${events?.length ?? 0} events · last ${days}d · max 500 · every clinical write, who and when`} />

      <form method="get" className="filters">
        <label className="field" style={{ margin: 0 }}>
          <span className="label">Table</span>
          <NativeSelect name="table" defaultValue={sp.table ?? ""}>
            <NativeSelectOption value="">All tables</NativeSelectOption>
            {TABLES.map(t => <NativeSelectOption key={t} value={t}>{t}</NativeSelectOption>)}
          </NativeSelect>
        </label>
        <label className="field" style={{ margin: 0 }}>
          <span className="label">Actor (uuid)</span>
          <Input name="actor" defaultValue={sp.actor ?? ""} style={{ width: 220 }} />
        </label>
        <label className="field" style={{ margin: 0 }}>
          <span className="label">Row (uuid)</span>
          <Input name="row" defaultValue={sp.row ?? ""} style={{ width: 220 }} />
        </label>
        <label className="field" style={{ margin: 0 }}>
          <span className="label">Days</span>
          <NativeSelect name="days" defaultValue={String(days)}>
            <NativeSelectOption value="1">1</NativeSelectOption>
            <NativeSelectOption value="7">7</NativeSelectOption>
            <NativeSelectOption value="30">30</NativeSelectOption>
            <NativeSelectOption value="90">90</NativeSelectOption>
          </NativeSelect>
        </label>
        <Button variant="outline" type="submit" style={{ alignSelf: "flex-end" }}>Filter</Button>
      </form>

      <div className="card">
        {(events?.length ?? 0) === 0 && <div className="empty">No events in range.</div>}
        {events?.map(e => {
          const diffs = e.operation === "UPDATE" ? changedFields(e.before, e.after) : null;
          return (
            <div key={e.id} className="queue-row" style={{ gridTemplateColumns: "1fr" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 13 }}>
                  <span className="num" style={{ color: "var(--fg-muted)" }}>{fmt(e.occurred_at)}</span>
                  <Badge variant={OP_BADGE[e.operation] ?? "secondary"}>{e.operation}</Badge>
                  <code style={{ fontSize: 12 }}>{e.table_name}</code>
                  {e.row_id && <span className="hint">row {e.row_id.slice(0, 8)}…</span>}
                  <span className="hint">· {e.actor_id ? (actors[e.actor_id] ?? e.actor_id.slice(0, 8)) : "(system)"}</span>
                </div>
                {diffs && diffs.length > 0 && (
                  <div className="hint" style={{ marginTop: 4 }}>changed: {diffs.join(", ")}</div>
                )}
                <details style={{ marginTop: 4 }}>
                  <summary className="link" style={{ fontSize: 12.5 }}>payload</summary>
                  <pre style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 10, overflow: "auto", fontSize: 12, marginTop: 6 }}>
{JSON.stringify({ before: e.before, after: e.after }, null, 2)}
                  </pre>
                </details>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
