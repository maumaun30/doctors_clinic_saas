import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * True when this session has passed two-factor (aal2). Admin powers need it:
 * the database enforces it in is_admin() (migration 0024); the app checks it
 * too so admins get sent to /mfa instead of seeing empty pages, and so
 * actions that reach outside the database (Stripe, email) are covered.
 */
export async function hasTwoFactorSession(sb: SupabaseClient): Promise<boolean> {
  const { data } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  return data?.currentLevel === "aal2";
}
