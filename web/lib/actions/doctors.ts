"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const input = z.object({
  specialization: z.string().trim().max(120, "Keep the specialization under 120 characters.")
    .transform(v => v || null),
  prc_license_no: z.string().trim().max(40, "License number is too long.")
    .regex(/^[A-Za-z0-9-]*$/, "Use letters, numbers and dashes only.")
    .transform(v => v || null),
});

export type DoctorResult = { ok: true } | { ok: false; error: string; field?: "specialization" | "prc_license_no" };

/** Admin edit of a doctor's professional details (RLS: doctors_admin_write). */
export async function updateDoctor(profileId: string, raw: unknown): Promise<DoctorResult> {
  if (!z.string().uuid().safeParse(profileId).success) return { ok: false, error: "Doctor not found." };
  const p = input.safeParse(raw);
  if (!p.success) {
    const i = p.error.issues[0];
    return { ok: false, error: i.message, field: i.path[0] as "specialization" | "prc_license_no" };
  }
  const sb = await createClient();
  const { error } = await sb.from("doctors").update(p.data).eq("profile_id", profileId);
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Another doctor already has that PRC license number.", field: "prc_license_no" };
    if (error.message.includes("account_read_only")) return { ok: false, error: "This account is read-only until the subscription is active." };
    console.error("update doctor failed:", error.message);
    return { ok: false, error: "Couldn’t save. Please try again." };
  }
  revalidatePath("/admin/doctors");
  return { ok: true };
}
