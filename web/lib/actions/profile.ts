"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const profileInput = z.object({
  full_name: z.string().min(1).max(200),
  phone: z.string().max(40).optional().nullable(),
});

export async function updateMyProfile(raw: unknown) {
  const input = profileInput.parse(raw);
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("not authenticated");
  const { error } = await sb
    .from("profiles")
    .update({ full_name: input.full_name, phone: input.phone ?? null })
    .eq("id", user.id);
  if (error) throw new Error(error.message);
}
