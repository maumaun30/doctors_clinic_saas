"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMyProfile } from "@/lib/data/queries";
import { syncSeats } from "@/lib/billing";

export type StaffAccessResult = { ok: true } | { ok: false; error: string };

// ~100 years: Supabase Auth has no "forever"; this blocks sign-in and
// session refresh until access is restored.
const BAN = "876000h";

/**
 * Remove or restore a staff member's access (admins only).
 *  1. admin_set_staff_active (session client): checks admin + 2FA, same
 *     account, not yourself, no upcoming appointments for a doctor;
 *     flips profiles.deactivated_at and writes the audit log. From then on
 *     RLS gives the person no account data at all.
 *  2. Ban / unban the auth user (service_role) so they can't sign in or
 *     refresh their session. Their current access token expires within
 *     the hour, and the database already denies it everything.
 *  3. Re-sync billing seats (removed doctors don't count).
 */
export async function setStaffAccess(userId: string, active: boolean): Promise<StaffAccessResult> {
  const id = z.string().uuid().safeParse(userId);
  if (!id.success) return { ok: false, error: "Unknown person." };
  const sb = await createClient();

  const { error } = await sb.rpc("admin_set_staff_active", { p_user_id: id.data, p_active: active });
  if (error) {
    const m = error.message;
    const upcoming = m.match(/upcoming_appointments:(\d+)/);
    if (upcoming) {
      const n = Number(upcoming[1]);
      return { ok: false, error: `They have ${n} upcoming appointment${n === 1 ? "" : "s"}. Reschedule them to another doctor or cancel them first.` };
    }
    if (m.includes("cannot_change_self")) return { ok: false, error: "You can’t remove your own access." };
    if (m.includes("forbidden")) return { ok: false, error: "Only admins (with two-factor) can change access." };
    if (m.includes("not_found")) return { ok: false, error: "That person isn’t in your clinic account." };
    console.error("set staff access failed:", m);
    return { ok: false, error: "Couldn’t change access. Please try again." };
  }

  const { error: banErr } = await createAdminClient().auth.admin.updateUserById(id.data, {
    ban_duration: active ? "none" : BAN,
  });
  if (banErr) {
    // The database change already took effect; this only affects sign-in.
    console.error("auth ban update failed:", banErr.message);
  }

  const me = await getMyProfile(sb);
  if (me?.account_id) await syncSeats(me.account_id);
  revalidatePath("/", "layout");
  return { ok: true };
}
