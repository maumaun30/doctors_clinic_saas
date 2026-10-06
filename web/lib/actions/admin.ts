"use server";

import { createClient } from "@/lib/supabase/server";
import { assignUserInput } from "@/lib/schemas";
import { getMyProfile } from "@/lib/data/queries";
import { syncSeats } from "@/lib/billing";

// admin_assign_user is callable by authenticated admins (enforced in
// the SQL function via auth.uid()). No service_role needed here.
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
