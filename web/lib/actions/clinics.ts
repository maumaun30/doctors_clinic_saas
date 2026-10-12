"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/data/queries";
import { clinicBookingInput } from "@/lib/schemas";

// Results instead of throws: production hides thrown server-action messages.
export type ClinicResult = { ok: true; id?: string } | { ok: false; error: string; field?: string };

const details = z.object({
  name: z.string().trim().min(1, "Enter the clinic name.").max(200),
  address: z.string().trim().max(500, "Address is too long.").optional().transform(v => v || null),
});

function friendly(message: string, fallback: string) {
  if (message.includes("account_read_only")) return "This account is read-only until the subscription is active.";
  if (message.includes("row-level security") || message.includes("permission"))
    return "Only admins can change clinics.";
  console.error("clinic action failed:", message);
  return fallback;
}

export async function addClinic(raw: unknown): Promise<ClinicResult> {
  const p = details.safeParse(raw);
  if (!p.success) return { ok: false, error: p.error.issues[0].message, field: String(p.error.issues[0].path[0]) };
  const sb = await createClient();
  const me = await getMyProfile(sb);
  if (!me?.account_id) return { ok: false, error: "Your account isn’t set up yet." };
  const { data, error } = await sb.from("clinics").insert({ ...p.data, account_id: me.account_id }).select("id").single();
  if (error) return { ok: false, error: friendly(error.message, "Couldn’t add the clinic. Please try again.") };
  revalidatePath("/admin/clinics");
  return { ok: true, id: data.id };
}

export async function updateClinic(id: string, raw: unknown): Promise<ClinicResult> {
  const p = details.safeParse(raw);
  if (!p.success) return { ok: false, error: p.error.issues[0].message, field: String(p.error.issues[0].path[0]) };
  const sb = await createClient();
  const { error } = await sb.from("clinics").update(p.data).eq("id", id);
  if (error) return { ok: false, error: friendly(error.message, "Couldn’t save the clinic. Please try again.") };
  revalidatePath("/admin/clinics");
  revalidatePath("/", "layout"); // clinic switcher shows the name
  return { ok: true };
}

export async function updateClinicBooking(id: string, raw: unknown): Promise<ClinicResult> {
  const p = clinicBookingInput.safeParse(raw);
  if (!p.success) return { ok: false, error: p.error.issues[0].message, field: "booking_slug" };
  const sb = await createClient();
  const { error } = await sb.from("clinics").update(p.data).eq("id", id);
  if (error) {
    if (error.code === "23505") return { ok: false, error: "That booking link is already taken — pick another.", field: "booking_slug" };
    return { ok: false, error: friendly(error.message, "Couldn’t save booking settings. Please try again.") };
  }
  revalidatePath("/admin/clinics");
  return { ok: true };
}

/** For ConfirmAction (throws; it shows the toast). */
export async function deleteClinic(formData: FormData) {
  const sb = await createClient();
  const { error } = await sb.from("clinics").delete().eq("id", z.string().uuid().parse(formData.get("id")));
  if (error) throw new Error(error.message);
  revalidatePath("/admin/clinics");
  revalidatePath("/", "layout");
}
