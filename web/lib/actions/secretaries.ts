"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const profileInput = z.object({
  full_name: z.string().trim().min(1, "Enter the secretary’s name.").max(200),
  phone: z.string().trim().max(40, "Phone number is too long.").transform(v => v || null),
});

export type SecretaryResult = { ok: true } | { ok: false; error: string; field?: "full_name" | "phone" };

function friendly(message: string, fallback: string) {
  if (message.includes("account_read_only")) return "This account is read-only until the subscription is active.";
  console.error("secretary action failed:", message);
  return fallback;
}

/** Admin edit of a secretary's name and phone (profiles_admin_update_same_account). */
export async function updateSecretary(id: string, raw: unknown): Promise<SecretaryResult> {
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "Secretary not found." };
  const p = profileInput.safeParse(raw);
  if (!p.success) {
    const i = p.error.issues[0];
    return { ok: false, error: i.message, field: i.path[0] as "full_name" | "phone" };
  }
  const sb = await createClient();
  const { error } = await sb.from("profiles").update(p.data).eq("id", id).eq("role", "secretary");
  if (error) return { ok: false, error: friendly(error.message, "Couldn’t save. Please try again.") };
  revalidatePath("/admin/secretaries", "layout");
  return { ok: true };
}

/** Let a secretary book and manage appointments for one doctor at one clinic. */
export async function assignSecretary(secretaryId: string, doctorClinicId: string): Promise<SecretaryResult> {
  if (![secretaryId, doctorClinicId].every(v => z.string().uuid().safeParse(v).success))
    return { ok: false, error: "Pick a doctor." };
  const sb = await createClient();
  const { error } = await sb.from("clinic_assignments").insert({ secretary_id: secretaryId, doctor_clinic_id: doctorClinicId });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Already assigned to that doctor." };
    return { ok: false, error: friendly(error.message, "Couldn’t assign. Please try again.") };
  }
  revalidatePath("/admin/secretaries", "layout");
  return { ok: true };
}

/** For ConfirmAction (throws). */
export async function unassignSecretary(formData: FormData) {
  const id = z.string().uuid().parse(formData.get("id"));
  const sb = await createClient();
  const { error } = await sb.from("clinic_assignments").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/secretaries", "layout");
}
