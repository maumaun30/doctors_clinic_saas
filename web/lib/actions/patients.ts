"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const createPatientInput = z.object({
  clinic_id: z.string().uuid(),
  full_name: z.string().min(1).max(200),
  date_of_birth: z.string().date().optional(),
  sex: z.enum(["male", "female", "other"]).optional(),
  phone: z.string().max(40).optional(),
  address: z.string().max(500).optional(),
});

export async function createPatient(raw: unknown) {
  const input = createPatientInput.parse(raw);
  const sb = await createClient();
  const { data, error } = await sb.rpc("create_patient", {
    p_clinic_id: input.clinic_id,
    p_full_name: input.full_name,
    p_date_of_birth: input.date_of_birth ?? null,
    p_sex: input.sex ?? null,
    p_phone: input.phone ?? null,
    p_address: input.address ?? null,
  });
  if (error) throw new Error(error.message);
  return data;
}

const updatePatientInput = z.object({
  id: z.string().uuid(),
  full_name: z.string().min(1).max(200),
  date_of_birth: z.string().date().optional().nullable(),
  sex: z.enum(["male", "female", "other"]).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
});

export async function updatePatient(raw: unknown) {
  const input = updatePatientInput.parse(raw);
  const sb = await createClient();
  const { error } = await sb.from("patients").update({
    full_name: input.full_name,
    date_of_birth: input.date_of_birth ?? null,
    sex: input.sex ?? null,
    phone: input.phone ?? null,
    address: input.address ?? null,
  }).eq("id", input.id);
  if (error) throw new Error(error.message);
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
