import { revalidatePath } from "next/cache";
import { PageHeader } from "@/app/_components/page-header";
import { Section } from "@/app/_components/section";
import { createClient } from "@/lib/supabase/server";
import { assignUser } from "@/lib/actions/admin";
import { resendInvite, revokeInvite } from "@/lib/actions/invites";
import { InviteForm } from "./invite-form";

const ROLE_LABEL: Record<string, string> = { admin: "Admin", doctor: "Doctor", secretary: "Secretary" };
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric" });

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("") || "?";
}

export default async function TeamPage() {
  const sb = await createClient();
  const [{ data: pending, error }, { data: invites, error: invErr }] = await Promise.all([
    sb.rpc("list_pending_users"),
    sb.from("staff_invites").select("id, email, role, created_at, expires_at")
      .is("accepted_at", null).is("revoked_at", null).order("created_at", { ascending: false }),
  ]);
  if (error) throw error;
  if (invErr) throw invErr;
  const now = Date.now();
  // Invitees get an auth user (and a pending profile) as soon as the
  // invite email is sent; list them under Open invites only.
  const invited = new Set((invites ?? []).map(i => i.email));
  const awaiting = pending.filter((u: any) => !invited.has(String(u.email ?? "").toLowerCase()));

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
      <PageHeader icon="user" title="Team & invites"
        sub={`${invites?.length ?? 0} open ${invites?.length === 1 ? "invite" : "invites"} · ${awaiting.length} awaiting a role`} />

      <Section title="Invite staff"
        description="They get an email link and land in the app with this role — no approval step. Invites expire after 7 days.">
        <InviteForm />
      </Section>

      <Section title={<>Open invites <span className="count">· {invites?.length ?? 0}</span></>}
        description="Not accepted yet. Resend restarts the 7 days; revoke cancels the link."
        flush>
        {!invites || invites.length === 0
          ? <div className="empty">No open invites.</div>
          : invites.map(i => {
            const expired = new Date(i.expires_at).getTime() < now;
            return (
              <div key={i.id} className="queue-row" style={{ gridTemplateColumns: "1fr auto" }}>
                <div style={{ minWidth: 0 }}>
                  <div className="strong" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{i.email}</div>
                  <div className="plist-id">
                    {ROLE_LABEL[i.role] ?? i.role} · sent {fmtDate(i.created_at)} ·{" "}
                    {expired
                      ? <span style={{ color: "var(--danger)" }}>expired</span>
                      : <>expires {fmtDate(i.expires_at)}</>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <form action={resendInvite}>
                    <input type="hidden" name="id" value={i.id} />
                    <button type="submit" className="btn btn-secondary btn-sm">Resend</button>
                  </form>
                  <form action={revokeInvite}>
                    <input type="hidden" name="id" value={i.id} />
                    <button type="submit" className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }}>Revoke</button>
                  </form>
                </div>
              </div>
            );
          })}
      </Section>

      <Section title="Awaiting access"
        description="Signed in without an invite. Pick a role to let them in — doctors add a billing seat."
        flush>
        {awaiting.length === 0
          ? <div className="empty">None waiting.</div>
          : awaiting.map((u: any) => (
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
      </Section>
    </>
  );
}
