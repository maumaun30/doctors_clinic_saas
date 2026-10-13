"use server";

import "server-only";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

// Patient self-service links (/a/<token>, sent in reminders). Like the
// online booking actions, these use the service key but only call the
// public_* RPCs from 0032, which check the token and every rule.

const token = z.string().regex(/^[0-9a-f]{20}$/);

export type PatientAppointment = {
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  patient_response: string | null;
  patient_first_name: string;
  doctor_name: string;
  clinic_name: string;
  clinic_address: string | null;
  can_confirm: boolean;
  can_cancel: boolean;
};

export async function getPatientAppointment(raw: string): Promise<PatientAppointment | null> {
  if (!token.safeParse(raw).success) return null;
  const { data, error } = await createAdminClient().rpc("public_appointment", { p_token: raw });
  if (error) throw new Error(error.message);
  return (data?.[0] as PatientAppointment | undefined) ?? null;
}

export type RespondResult = { ok: true; status: string } | { ok: false; error: string };

export async function respondToAppointment(raw: string, action: "confirm" | "cancel"): Promise<RespondResult> {
  if (!token.safeParse(raw).success || (action !== "confirm" && action !== "cancel")) {
    return { ok: false, error: "This link isn’t valid." };
  }
  const { data, error } = await createAdminClient().rpc("public_respond_appointment", { p_token: raw, p_action: action });
  if (error) {
    // RPC raises patient-facing messages prefixed with "respond:".
    const m = /respond:\s*(.*)$/.exec(error.message);
    return { ok: false, error: m?.[1] ? m[1][0].toUpperCase() + m[1].slice(1) + "." : "Something went wrong. Please call the clinic." };
  }
  return { ok: true, status: data as string };
}
