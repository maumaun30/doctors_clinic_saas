"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createClient as createStatelessClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMyProfile } from "@/lib/data/queries";

export type InviteResult = { ok: true; message: string } | { ok: false; message: string };

const inviteInput = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(254),
  role: z.enum(["admin", "doctor", "secretary"]),
});

async function requireAdmin() {
  const sb = await createClient();
  const me = await getMyProfile(sb);
  if (me?.role !== "admin" || !me.account_id) throw new Error("Only admins can invite staff.");
  return { sb, me: { id: me.id, account_id: me.account_id } };
}

async function origin() {
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
}

/**
 * Email the invite. New addresses get Supabase's invite email (creates the
 * auth user); addresses that already have an auth user get a magic link.
 * Either way, signing in with that verified email accepts the invite.
 */
async function sendInviteEmail(email: string): Promise<"invited" | "magiclink"> {
  const base = await origin();
  const { error } = await createAdminClient().auth.admin.inviteUserByEmail(email, {
    redirectTo: `${base}/auth/callback`,
  });
  if (!error) return "invited";
  if (!/already.*(registered|exists)/i.test(error.message)) throw new Error(error.message);

  // Stateless client: a cookie-bound one would store the PKCE verifier in
  // the *admin's* browser and the invitee's link could never complete.
  const anon = createStatelessClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, flowType: "implicit" } },
  );
  const { error: otpErr } = await anon.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: `${base}/auth/callback` },
  });
  if (otpErr) throw new Error(otpErr.message);
  return "magiclink";
}

export async function inviteStaff(_prev: InviteResult | null, formData: FormData): Promise<InviteResult> {
  const parsed = inviteInput.safeParse({ email: formData.get("email"), role: formData.get("role") });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form." };
  const { email, role } = parsed.data;

  const { sb, me } = await requireAdmin();
  const { error } = await sb.from("staff_invites").insert({
    account_id: me.account_id, email, role, invited_by: me.id,
  });
  if (error) {
    if (error.code === "23505") return { ok: false, message: `${email} already has an open invite — use Resend.` };
    if (error.message.includes("account_read_only")) return { ok: false, message: "Your account is read-only — subscribe under Billing to invite staff." };
    return { ok: false, message: error.message };
  }
  revalidatePath("/admin/users");

  try {
    await sendInviteEmail(email);
  } catch (e: any) {
    return { ok: false, message: `Invite saved, but the email failed (${e.message}). Try Resend, or ask them to sign in with ${email}.` };
  }
  return { ok: true, message: `Invite sent to ${email}. They’ll have access as soon as they sign in.` };
}

export async function resendInvite(formData: FormData) {
  const { sb } = await requireAdmin();
  const id = z.string().uuid().parse(formData.get("id"));
  const { data, error } = await sb.from("staff_invites")
    .update({ expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString() })
    .eq("id", id).select("email").single();
  if (error) throw new Error(error.message);
  await sendInviteEmail(data.email);
  revalidatePath("/admin/users");
}

export async function revokeInvite(formData: FormData) {
  const { sb } = await requireAdmin();
  const id = z.string().uuid().parse(formData.get("id"));
  const { error } = await sb.from("staff_invites").update({ revoked_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/users");
}
