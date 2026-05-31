import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/data/queries";

export default async function Home() {
  const sb = await createClient();
  const profile = await getMyProfile(sb);
  if (!profile) redirect("/login");
  if (profile.role === "pending" || !profile.account_id) redirect("/pending");
  if (profile.role === "admin") redirect("/admin/clinics");
  redirect("/today");
}
