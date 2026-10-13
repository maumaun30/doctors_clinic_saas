"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveClinicId } from "@/lib/data/clinic-context";
import { getMyProfile } from "@/lib/data/queries";

// Shared by add and edit. Blank strings from the form mean "not given".
const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const patientFields = z.object({
  full_name: z.string().trim().min(1, "Enter the patient’s full name.").max(200),
  date_of_birth: z.preprocess(blank, z.string().date("Enter a valid date.")
    .refine(d => d <= new Date().toISOString().slice(0, 10), "Date of birth can’t be in the future.").optional()),
  sex: z.preprocess(blank, z.enum(["male", "female", "other"]).optional()),
  phone: z.preprocess(blank, z.string().trim().max(40, "Phone number is too long.").optional()),
  email: z.preprocess(blank, z.string().trim().email("Enter a valid email address.").max(254).optional()),
  address: z.preprocess(blank, z.string().trim().max(500, "Address is too long.").optional()),
});
export type PatientFields = z.input<typeof patientFields>;

// Results instead of throws: production hides thrown server-action
// messages, and the form needs per-field errors.
export type PatientResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Partial<Record<keyof PatientFields, string>> };

function invalid(e: z.ZodError): PatientResult {
  const fieldErrors: Partial<Record<keyof PatientFields, string>> = {};
  for (const i of e.issues) fieldErrors[i.path[0] as keyof PatientFields] ??= i.message;
  return { ok: false, error: "Check the highlighted fields.", fieldErrors };
}

function friendly(message: string): string {
  if (message.includes("account_read_only")) return "This account is read-only until the subscription is active.";
  if (message.includes("forbidden")) return "You don’t have access to change patients at this clinic.";
  console.error("patient save failed:", message);
  return "Couldn’t save the patient. Please try again.";
}

/** Adds a patient to the active clinic (chosen in the sidebar). */
export async function createPatient(raw: PatientFields): Promise<PatientResult> {
  const parsed = patientFields.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const input = parsed.data;
  const sb = await createClient();
  const clinicId = await getActiveClinicId(sb);
  if (!clinicId) return { ok: false, error: "Pick an active clinic in the sidebar first." };
  const { data, error } = await sb.rpc("create_patient", {
    p_clinic_id: clinicId,
    p_full_name: input.full_name,
    p_date_of_birth: input.date_of_birth,
    p_sex: input.sex,
    p_phone: input.phone,
    p_address: input.address,
    p_email: input.email,
  });
  if (error) return { ok: false, error: friendly(error.message) };
  revalidatePath("/patients");
  return { ok: true, id: (data as { id: string }).id };
}

export async function updatePatient(id: string, raw: PatientFields): Promise<PatientResult> {
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "Patient not found." };
  const parsed = patientFields.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const input = parsed.data;
  const sb = await createClient();
  const { error } = await sb.from("patients").update({
    full_name: input.full_name,
    date_of_birth: input.date_of_birth ?? null,
    sex: input.sex ?? null,
    phone: input.phone ?? null,
    address: input.address ?? null,
    email: input.email ?? null,
  }).eq("id", id);
  if (error) return { ok: false, error: friendly(error.message) };
  revalidatePath(`/patients/${id}`);
  revalidatePath("/patients");
  return { ok: true, id };
}

export async function linkPatientToClinic(patient_id: string, clinic_id: string) {
  const sb = await createClient();
  const { error } = await sb.from("patient_clinics")
    .insert({ patient_id, clinic_id });
  if (error) throw new Error(error.message);
}

export async function unlinkPatientFromClinic(id: string) {
  const sb = await createClient();
  const { error } = await sb.from("patient_clinics").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

const uuid = z.string().uuid();

/** Admins with 2FA: fold `removeId` into `keepId` (see admin_merge_patients). */
export async function mergePatients(keepId: string, removeId: string): Promise<PatientResult> {
  if (!uuid.safeParse(keepId).success || !uuid.safeParse(removeId).success) return { ok: false, error: "Patient not found." };
  const sb = await createClient();
  const { error } = await sb.rpc("admin_merge_patients", { p_keep: keepId, p_remove: removeId });
  if (error) {
    if (error.message.includes("forbidden")) return { ok: false, error: "Only admins with two-factor sign-in can merge patients." };
    if (error.message.includes("not_found")) return { ok: false, error: "One of these patients no longer exists. It may already be merged." };
    if (error.message.includes("same_patient")) return { ok: false, error: "Pick two different patients." };
    return { ok: false, error: friendly(error.message) };
  }
  revalidatePath("/patients");
  revalidatePath("/patients/duplicates");
  revalidatePath(`/patients/${keepId}`);
  return { ok: true, id: keepId };
}

/** Admins: stop suggesting a pair that are two different people. */
export async function dismissDuplicate(a: string, b: string): Promise<PatientResult> {
  if (!uuid.safeParse(a).success || !uuid.safeParse(b).success || a === b) return { ok: false, error: "Patient not found." };
  const sb = await createClient();
  const me = await getMyProfile(sb);
  if (me?.role !== "admin" || !me.account_id) return { ok: false, error: "Only admins can do this." };
  // Stored in uuid order (the table checks patient_a < patient_b).
  const [lo, hi] = [a.toLowerCase(), b.toLowerCase()].sort();
  const { error } = await sb.from("patient_not_duplicates")
    .upsert({ account_id: me.account_id, patient_a: lo, patient_b: hi, dismissed_by: me.id }, { ignoreDuplicates: true });
  if (error) {
    if (error.message.includes("row-level security")) return { ok: false, error: "Only admins with two-factor sign-in can do this." };
    return { ok: false, error: friendly(error.message) };
  }
  revalidatePath("/patients/duplicates");
  return { ok: true, id: lo };
}
