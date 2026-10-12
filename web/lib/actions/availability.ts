"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const hhmm = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Enter a time.");
const addInput = z.object({
  doctor_id: z.string().uuid(),
  clinic_id: z.string().uuid(),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1, "Pick at least one day."),
  start_time: hhmm,
  end_time: hhmm,
});

export type AvailabilityResult = { ok: true; added: number } | { ok: false; error: string };

const t = (s: string) => s.slice(0, 5); // "09:00:00" -> "09:00"

/** Adds the same window to each selected weekday, refusing overlaps. */
export async function addAvailability(raw: unknown): Promise<AvailabilityResult> {
  const parsed = addInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  const { doctor_id, clinic_id, weekdays, start_time, end_time } = parsed.data;
  if (t(end_time) <= t(start_time)) return { ok: false, error: "End time must be after the start time." };

  const sb = await createClient();
  const { data: existing, error: readErr } = await sb.from("doctor_availability")
    .select("weekday, start_time, end_time")
    .eq("doctor_id", doctor_id).eq("clinic_id", clinic_id).in("weekday", weekdays);
  if (readErr) return { ok: false, error: "Couldn’t check existing hours. Please try again." };

  const clashes = (existing ?? []).filter(e => t(e.start_time) < t(end_time) && t(start_time) < t(e.end_time));
  if (clashes.length) {
    const days = [...new Set(clashes.map(c => DAYS[c.weekday]))].join(", ");
    return { ok: false, error: `Overlaps hours already set on ${days}. Edit or remove those first.` };
  }

  const { error } = await sb.from("doctor_availability").insert(
    weekdays.map(weekday => ({ doctor_id, clinic_id, weekday, start_time, end_time })),
  );
  if (error) {
    if (error.message.includes("account_read_only")) return { ok: false, error: "This account is read-only until the subscription is active." };
    if (error.code === "42501" || error.message.includes("row-level security"))
      return { ok: false, error: "You can only change your own hours." };
    console.error("add availability failed:", error.message);
    return { ok: false, error: "Couldn’t save the hours. Please try again." };
  }
  revalidatePath("/availability");
  return { ok: true, added: weekdays.length };
}

/** For ConfirmAction (throws on failure; it shows the toast). */
export async function removeAvailability(formData: FormData) {
  const id = z.string().uuid().parse(formData.get("id"));
  const sb = await createClient();
  const { error } = await sb.from("doctor_availability").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/availability");
}
