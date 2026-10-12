"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assignUserInput } from "@/lib/schemas";
import { getMyProfile } from "@/lib/data/queries";
import { syncSeats } from "@/lib/billing";

// admin_assign_user is callable by authenticated admins (enforced in
// the SQL function via auth.uid()). No service_role needed here.
/** Result-returning assignUser for the Team page (production hides thrown messages). */
export async function approveUser(userId: string, role: "admin" | "doctor" | "secretary"): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await assignUser({ user_id: userId, role });
  } catch (e: any) {
    const m = String(e?.message ?? "");
    if (m.includes("account_read_only")) return { ok: false, error: "Your account is read-only — subscribe under Billing first." };
    console.error("approve user failed:", m);
    return { ok: false, error: "Couldn’t give access. Please try again." };
  }
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function assignUser(raw: unknown) {
  const input = assignUserInput.parse(raw);
  const sb = await createClient();
  const { data, error } = await sb.rpc("admin_assign_user", {
    p_user_id: input.user_id,
    p_role: input.role,
  });
  if (error) throw new Error(error.message);
  // Doctor count may have changed: keep Stripe seats in step.
  const me = await getMyProfile(sb);
  if (me?.account_id) await syncSeats(me.account_id);
  return data;
}
