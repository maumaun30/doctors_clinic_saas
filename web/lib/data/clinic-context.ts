import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

export const ACTIVE_CLINIC_COOKIE = "active_clinic_id";

// Returns clinics the caller can pick from. RLS already filters per
// account + role, so we just select everything the session sees.
export async function getMyClinics(sb: SupabaseClient) {
  const { data, error } = await sb.from("clinics").select("id, name").order("name");
  if (error) throw error;
  return data ?? [];
}

// Resolves the "active" clinic: cookie value if it's still in the
// visible set, otherwise the first one. Returns null if the caller has
// no clinics at all.
export async function getActiveClinicId(sb: SupabaseClient): Promise<string | null> {
  const clinics = await getMyClinics(sb);
  if (clinics.length === 0) return null;
  const c = await cookies();
  const cookieVal = c.get(ACTIVE_CLINIC_COOKIE)?.value;
  if (cookieVal && clinics.some(x => x.id === cookieVal)) return cookieVal;
  return clinics[0].id;
}
