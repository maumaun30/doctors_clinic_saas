"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const input = z.object({
  full_name: z.string().trim().min(1, "Enter the doctor’s name.").max(200),
  specialization: z.string().trim().max(120, "Keep the specialization under 120 characters.")
    .transform(v => v || null),
  prc_license_no: z.string().trim().max(40, "License number is too long.")
    .regex(/^[A-Za-z0-9-]*$/, "Use letters, numbers and dashes only.")
    .transform(v => v || null),
});

type Field = "full_name" | "specialization" | "prc_license_no";
export type DoctorResult = { ok: true } | { ok: false; error: string; field?: Field };

/** Admin edit of a doctor's professional details (RLS: doctors_admin_write). */
export async function updateDoctor(profileId: string, raw: unknown): Promise<DoctorResult> {
  if (!z.string().uuid().safeParse(profileId).success) return { ok: false, error: "Doctor not found." };
  const p = input.safeParse(raw);
  if (!p.success) {
    const i = p.error.issues[0];
    return { ok: false, error: i.message, field: i.path[0] as Field };
  }
  const { full_name, ...pro } = p.data;
  const sb = await createClient();
  // Name lives on profiles (admins may update same-account profiles).
  const { error: nameErr } = await sb.from("profiles").update({ full_name }).eq("id", profileId);
  if (nameErr) {
    console.error("update doctor name failed:", nameErr.message);
    return { ok: false, error: "Couldn’t save the name. Please try again.", field: "full_name" };
  }
  const { error } = await sb.from("doctors").update(pro).eq("profile_id", profileId);
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Another doctor already has that PRC license number.", field: "prc_license_no" };
    if (error.message.includes("account_read_only")) return { ok: false, error: "This account is read-only until the subscription is active." };
    console.error("update doctor failed:", error.message);
    return { ok: false, error: "Couldn’t save. Please try again." };
  }
  revalidatePath("/admin/doctors", "layout");
  return { ok: true };
}

/** Pair a doctor with a clinic so they can be booked there. */
export async function linkDoctorClinic(doctorId: string, clinicId: string): Promise<DoctorResult> {
  if (![doctorId, clinicId].every(v => z.string().uuid().safeParse(v).success)) return { ok: false, error: "Pick a clinic." };
  const sb = await createClient();
  const { error } = await sb.from("doctor_clinics").insert({ doctor_id: doctorId, clinic_id: clinicId });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Already at that clinic." };
    console.error("link doctor clinic failed:", error.message);
    return { ok: false, error: "Couldn’t add the clinic. Please try again." };
  }
  revalidatePath(`/admin/doctors/${doctorId}`);
  revalidatePath("/admin/doctors");
  return { ok: true };
}

/**
 * For ConfirmAction (throws). Removes the doctor from a clinic and that
 * clinic's working hours (availability isn't tied to the pairing, so it
 * would otherwise linger). Secretary assignments cascade.
 */
export async function unlinkDoctorClinic(formData: FormData) {
  const doctorId = z.string().uuid().parse(formData.get("doctor_id"));
  const clinicId = z.string().uuid().parse(formData.get("clinic_id"));
  const sb = await createClient();
  const { error: hErr } = await sb.from("doctor_availability").delete().eq("doctor_id", doctorId).eq("clinic_id", clinicId);
  if (hErr) throw new Error(hErr.message);
  const { error } = await sb.from("doctor_clinics").delete().eq("doctor_id", doctorId).eq("clinic_id", clinicId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/doctors/${doctorId}`);
  revalidatePath("/admin/doctors");
  revalidatePath("/availability");
}
