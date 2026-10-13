import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/data/queries";

/**
 * Admin pages are for admins only. The data is already protected by RLS
 * (is_admin); this sends doctors and secretaries back instead of showing
 * them empty admin screens. 2FA is enforced by the (app) layout.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await getMyProfile(await createClient());
  if (me?.role !== "admin") redirect("/today");
  return children;
}
