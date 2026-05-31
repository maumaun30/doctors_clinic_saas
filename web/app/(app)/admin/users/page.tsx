import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assignUser } from "@/lib/actions/admin";

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("") || "?";
}

export default async function PendingUsersPage() {
  const sb = await createClient();
  const { data: pending, error } = await sb.rpc("list_pending_users");
  if (error) throw error;

  async function approve(formData: FormData) {
    "use server";
    await assignUser({
      user_id: formData.get("user_id") as string,
      role: formData.get("role") as "admin" | "doctor" | "secretary",
    });
    revalidatePath("/admin/users");
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Pending users</h1>
          <div className="sub">{pending.length} awaiting a role</div>
        </div>
      </div>

      <div className="card">
        {pending.length === 0
          ? <div className="empty">None waiting.</div>
          : pending.map((u: any) => (
            <div key={u.id} className="queue-row" style={{ gridTemplateColumns: "1fr auto" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                <span className="avatar">{initials(u.full_name ?? u.email ?? "?")}</span>
                <div style={{ minWidth: 0 }}>
                  <div className="strong">{u.full_name ?? "(no name)"}</div>
                  <div className="plist-id">{u.email}</div>
                </div>
              </div>
              <form action={approve} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="hidden" name="user_id" value={u.id} />
                <select name="role" defaultValue="secretary" className="select">
                  <option value="admin">Admin</option>
                  <option value="doctor">Doctor</option>
                  <option value="secretary">Secretary</option>
                </select>
                <button type="submit" className="btn btn-primary btn-sm">Assign</button>
              </form>
            </div>
          ))}
      </div>
    </>
  );
}
