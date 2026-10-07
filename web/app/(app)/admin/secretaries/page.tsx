import Link from "next/link";
import { PageHeader } from "@/app/_components/page-header";
import { Section } from "@/app/_components/section";
import { createClient } from "@/lib/supabase/server";

export default async function SecretariesAdmin() {
  const sb = await createClient();
  const { data, error } = await sb
    .from("profiles")
    .select("id, full_name, phone")
    .eq("role", "secretary");
  if (error) throw error;
  return (
    <>
      <PageHeader icon="users" title="Secretaries"
        sub={`${data.length} ${data.length === 1 ? "secretary" : "secretaries"}`} />

      <Section title="Front desk staff"
        description={<>Secretaries book and manage appointments for the doctors they’re assigned to. Set pairings on <Link href="/admin/assignments" className="link">Assignments</Link>.</>}
        flush>
        {data.length === 0
          ? <div className="empty">No secretaries yet.</div>
          : data.map(s => (
            <div key={s.id} className="plist-row" style={{ cursor: "default" }}>
              <div className="strong">{s.full_name}</div>
              {s.phone && <span className="hint">{s.phone}</span>}
            </div>
          ))}
      </Section>
    </>
  );
}
