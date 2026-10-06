"use server";

import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

// Public (unauthenticated) self-booking. These actions run with the
// service key, but only ever call the public_* RPCs from 0016, which do
// all the authorization themselves (clinic opted in, doctor at clinic,
// slot genuinely free, rate limits).

const slug = z.string().trim().toLowerCase().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(60);

export type PublicDoctor = { id: string; name: string; specialization: string | null };
export type PublicClinic = { name: string; address: string | null; doctors: PublicDoctor[] };

export async function getPublicClinic(rawSlug: string): Promise<PublicClinic | null> {
  const parsed = slug.safeParse(rawSlug);
  if (!parsed.success) return null;
  const { data, error } = await createAdminClient()
    .rpc("public_booking_info", { p_slug: parsed.data });
  if (error) throw new Error(error.message);
  const row = data?.[0];
  if (!row) return null;
  return {
    name: row.clinic_name,
    address: row.clinic_address,
    doctors: (row.doctors as PublicDoctor[] | null) ?? [],
  };
}

const slotsInput = z.object({
  slug,
  doctor_id: z.string().uuid(),
  date: z.string().date(),
});

export async function getPublicSlots(raw: unknown): Promise<string[]> {
  const input = slotsInput.parse(raw);
  const { data, error } = await createAdminClient().rpc("public_available_slots", {
    p_slug: input.slug,
    p_doctor_id: input.doctor_id,
    p_date_local: input.date,
  });
  if (error) throw new Error("Could not load available times. Please try again.");
  return (data ?? []).map(r => r.slot_start);
}

const bookInput = z.object({
  slug,
  doctor_id: z.string().uuid(),
  scheduled_at: z.string().datetime({ offset: true }),
  full_name: z.string().trim().min(2, "Please enter your full name").max(200),
  phone: z.string().trim().min(7, "Please enter a valid phone number").max(40),
  email: z.string().trim().email("Please enter a valid email").max(254).optional().or(z.literal("")),
  date_of_birth: z.string().date().optional().or(z.literal("")),
  // Honeypot: real visitors never see or fill this field.
  website: z.string().max(0, "Please check your details.").optional().or(z.literal("")),
});

export type BookResult =
  | { ok: true; scheduled_at: string }
  | { ok: false; error: string };

export async function bookPublicAppointment(raw: unknown): Promise<BookResult> {
  const parsed = bookInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check your details." };
  }
  const input = parsed.data;

  const { data, error } = await createAdminClient().rpc("public_book_appointment", {
    p_slug: input.slug,
    p_doctor_id: input.doctor_id,
    p_scheduled_at: input.scheduled_at,
    p_full_name: input.full_name,
    p_phone: input.phone,
    p_email: input.email || undefined,
    p_date_of_birth: input.date_of_birth || undefined,
    p_ip_hash: await clientIpHash(),
  });
  if (error) {
    // RPC raises user-facing messages prefixed with "booking:".
    const m = /booking:\s*(.*)$/.exec(error.message);
    return { ok: false, error: m?.[1] ?? "Something went wrong. Please try again or call the clinic." };
  }
  return { ok: true, scheduled_at: data[0].scheduled_at };
}

// Salted hash so raw IPs are never stored.
async function clientIpHash(): Promise<string | undefined> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip");
  if (!ip) return undefined;
  return createHash("sha256")
    .update(`${ip}|${process.env.SUPABASE_SERVICE_ROLE_KEY}`)
    .digest("hex");
}
