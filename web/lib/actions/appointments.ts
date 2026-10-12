"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/lib/database.types";
import { bookAppointmentInput, completeAppointmentInput, setStatusInput, rescheduleInput } from "@/lib/schemas";

export type BookResult = { ok: true } | { ok: false; error: string; slotTaken?: boolean };

// Returns a result instead of throwing: production builds replace thrown
// server-action messages with a generic one, so the form couldn't say why
// a booking failed. Messages are mapped from book_appointment()'s errors.
export async function bookAppointment(raw: unknown): Promise<BookResult> {
  const parsed = bookAppointmentInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Some details are missing or invalid. Check the form and try again." };
  const input = parsed.data;
  const sb = await createClient();
  const { error } = await sb.rpc("book_appointment", {
    p_patient_id: input.patient_id,
    p_doctor_id: input.doctor_id,
    p_clinic_id: input.clinic_id,
    p_scheduled_at: input.scheduled_at,
    p_duration_minutes: input.duration_minutes,
    p_notes: input.notes,
  });
  if (!error) return { ok: true };

  const m = error.message;
  if (m.includes("double-booked"))
    return { ok: false, slotTaken: true, error: "That time was just taken. Pick another slot." };
  if (m.includes("not available"))
    return { ok: false, slotTaken: true, error: "The doctor isn’t available for that whole time. Try a shorter visit or another slot." };
  if (m.includes("forbidden"))
    return { ok: false, error: "You don’t have access to book for this doctor at this clinic." };
  if (m.includes("account_read_only"))
    return { ok: false, error: "This account is read-only until the subscription is active." };
  console.error("book_appointment failed:", m);
  return { ok: false, error: "Couldn’t book the appointment. Please try again." };
}

export async function setAppointmentStatus(raw: unknown) {
  const input = setStatusInput.parse(raw);
  const sb = await createClient();
  const { data, error } = await sb.rpc("set_appointment_status", {
    p_appointment_id: input.appointment_id,
    p_status: input.status,
  });
  if (error) throw new Error(error.message);
  return data;
}

export type StatusResult = { ok: true } | { ok: false; error: string };

// Client-callable variant of setAppointmentStatus for menus: returns a
// result (production hides thrown messages) and refreshes the lists.
export async function updateAppointmentStatus(raw: unknown): Promise<StatusResult> {
  const parsed = setStatusInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "That status change isn’t allowed." };
  const sb = await createClient();
  const { error } = await sb.rpc("set_appointment_status", {
    p_appointment_id: parsed.data.appointment_id,
    p_status: parsed.data.status,
  });
  if (error) {
    if (error.message.includes("account_read_only"))
      return { ok: false, error: "This account is read-only until the subscription is active." };
    if (error.message.includes("not permitted"))
      return { ok: false, error: "You don’t have access to change this appointment." };
    console.error("set_appointment_status failed:", error.message);
    return { ok: false, error: "Couldn’t update the appointment. Please try again." };
  }
  revalidatePath("/schedule");
  revalidatePath("/today");
  return { ok: true };
}

export async function rescheduleAppointment(raw: unknown): Promise<BookResult> {
  const parsed = rescheduleInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Pick a new time first." };
  const input = parsed.data;
  const sb = await createClient();
  const { error } = await sb.rpc("reschedule_appointment", {
    p_appointment_id: input.appointment_id,
    p_scheduled_at: input.scheduled_at,
    p_duration_minutes: input.duration_minutes,
  });
  if (error) {
    const m = error.message;
    if (m.includes("double-booked"))
      return { ok: false, slotTaken: true, error: "That time was just taken. Pick another slot." };
    if (m.includes("not available"))
      return { ok: false, slotTaken: true, error: "The doctor isn’t available for that whole time. Try a shorter visit or another slot." };
    if (m.includes("not permitted"))
      return { ok: false, error: "You don’t have access to reschedule this appointment." };
    if (m.includes("account_read_only"))
      return { ok: false, error: "This account is read-only until the subscription is active." };
    console.error("reschedule_appointment failed:", m);
    return { ok: false, error: "Couldn’t reschedule. Please try again." };
  }
  revalidatePath(`/visits/${input.appointment_id}`);
  revalidatePath("/schedule");
  revalidatePath("/today");
  return { ok: true };
}

export async function completeVisitFull(raw: {
  appointment_id: string;
  chief_complaint?: string;
  diagnosis?: string;
  vitals?: Record<string, unknown>;
  notes?: string;
  prescriptions: Array<{ medication_id?: string; name: string; dosage?: string; frequency?: string; duration?: string; instructions?: string }>;
  labs: Array<{ lab_test_id?: string; name: string }>;
  conditions: Array<{ condition_id?: string; name: string; status?: "active" | "resolved"; since?: string }>;
}) {
  const sb = await createClient();
  // These params have no SQL default, so they must be sent; null is valid
  // but the generated types can't express a nullable required arg.
  const { error } = await sb.rpc("complete_visit_full", {
    p_appointment_id: raw.appointment_id,
    p_chief_complaint: raw.chief_complaint ?? null,
    p_diagnosis: raw.diagnosis ?? null,
    p_vitals: (raw.vitals ?? null) as Json,
    p_notes: raw.notes ?? null,
    p_prescriptions: raw.prescriptions,
    p_labs: raw.labs,
    p_conditions: raw.conditions,
  } as Database["public"]["Functions"]["complete_visit_full"]["Args"]);
  if (error) {
    const m = error.message;
    if (m.includes("only the treating doctor"))
      return { ok: false as const, error: "Only the treating doctor can complete this visit." };
    if (m.includes("account_read_only"))
      return { ok: false as const, error: "This account is read-only until the subscription is active." };
    console.error("complete_visit_full failed:", m);
    return { ok: false as const, error: "Couldn’t save the visit. Your entries are still here — please try again." };
  }
  revalidatePath(`/visits/${raw.appointment_id}`);
  revalidatePath("/today");
  revalidatePath("/schedule");
  return { ok: true as const };
}

export async function completeAppointment(raw: unknown) {
  const input = completeAppointmentInput.parse(raw);
  const sb = await createClient();
  const { data, error } = await sb.rpc("complete_appointment", {
    p_appointment_id: input.appointment_id,
    p_chief_complaint: input.chief_complaint,
    p_diagnosis: input.diagnosis,
    p_vitals: input.vitals as Json | undefined,
    p_notes: input.notes,
  });
  if (error) throw new Error(error.message);
  return data;
}
