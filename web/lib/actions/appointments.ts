"use server";

import { createClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/lib/database.types";
import { bookAppointmentInput, completeAppointmentInput, setStatusInput, rescheduleInput } from "@/lib/schemas";

export async function bookAppointment(raw: unknown) {
  const input = bookAppointmentInput.parse(raw);
  const sb = await createClient();
  const { data, error } = await sb.rpc("book_appointment", {
    p_patient_id: input.patient_id,
    p_doctor_id: input.doctor_id,
    p_clinic_id: input.clinic_id,
    p_scheduled_at: input.scheduled_at,
    p_duration_minutes: input.duration_minutes,
    p_notes: input.notes,
  });
  if (error) throw new Error(error.message);
  return data;
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

export async function rescheduleAppointment(raw: unknown) {
  const input = rescheduleInput.parse(raw);
  const sb = await createClient();
  const { data, error } = await sb.rpc("reschedule_appointment", {
    p_appointment_id: input.appointment_id,
    p_scheduled_at: input.scheduled_at,
    p_duration_minutes: input.duration_minutes,
  });
  if (error) throw new Error(error.message);
  return data;
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
  const { data, error } = await sb.rpc("complete_visit_full", {
    p_appointment_id: raw.appointment_id,
    p_chief_complaint: raw.chief_complaint ?? null,
    p_diagnosis: raw.diagnosis ?? null,
    p_vitals: (raw.vitals ?? null) as Json,
    p_notes: raw.notes ?? null,
    p_prescriptions: raw.prescriptions,
    p_labs: raw.labs,
    p_conditions: raw.conditions,
  } as Database["public"]["Functions"]["complete_visit_full"]["Args"]);
  if (error) throw new Error(error.message);
  return data;
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
