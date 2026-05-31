import Link from "next/link";
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
      <div className="page-head">
        <div>
          <h1>Secretaries</h1>
          <div className="sub">{data.length} {data.length === 1 ? "secretary" : "secretaries"}</div>
        </div>
      </div>

      <p className="hint" style={{ marginBottom: 16 }}>
        Bind each secretary to (doctor, clinic) pairings on the{" "}
        <Link href="/admin/assignments" className="link">Assignments</Link> page.
      </p>

      <div className="card">
        {data.length === 0
          ? <div className="empty">No secretaries yet.</div>
          : data.map(s => (
            <div key={s.id} className="plist-row" style={{ cursor: "default" }}>
              <div className="strong">{s.full_name}</div>
              {s.phone && <span className="hint">{s.phone}</span>}
            </div>
          ))}
      </div>
    </>
  );
}
