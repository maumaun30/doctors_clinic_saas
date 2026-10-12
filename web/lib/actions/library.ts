"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/data/queries";

// The three quick-pick lists doctors use during visits. Visits keep their
// own copy of each item, so edits and deletes never change past records.
const opt = (max: number) => z.string().trim().max(max, `Keep this under ${max} characters.`).transform(v => v || null);
const name = z.string().trim().min(1, "Enter a name.").max(200);
const KINDS = {
  meds: {
    table: "common_medications",
    noun: "medication",
    schema: z.object({ name, default_dosage: opt(80), default_frequency: opt(80), default_instructions: opt(300) }),
  },
  labs: {
    table: "common_lab_tests",
    noun: "lab test",
    schema: z.object({ name, description: opt(300) }),
  },
  conds: {
    table: "common_conditions",
    noun: "condition",
    schema: z.object({ name, icd_code: z.string().trim().toUpperCase().max(10, "ICD codes are at most 10 characters.").transform(v => v || null) }),
  },
} as const;
export type LibraryKind = keyof typeof KINDS;
export type LibraryResult = { ok: true } | { ok: false; error: string; field?: string };

/** Add (id = null) or update one library item. */
export async function saveLibraryItem(kind: LibraryKind, id: string | null, raw: unknown): Promise<LibraryResult> {
  const k = KINDS[kind];
  if (!k) return { ok: false, error: "Unknown list." };
  const p = k.schema.safeParse(raw);
  if (!p.success) return { ok: false, error: p.error.issues[0].message, field: String(p.error.issues[0].path[0]) };
  const sb = await createClient();
  let error;
  if (id) {
    if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "Item not found." };
    ({ error } = await sb.from(k.table).update(p.data as never).eq("id", id));
  } else {
    const me = await getMyProfile(sb);
    if (!me?.account_id) return { ok: false, error: "Your account isn’t set up yet." };
    ({ error } = await sb.from(k.table).insert({ ...p.data, account_id: me.account_id } as never));
  }
  if (error) {
    if (error.code === "23505") return { ok: false, error: `${p.data.name} is already in the ${k.noun} list.`, field: "name" };
    if (error.message.includes("account_read_only")) return { ok: false, error: "This account is read-only until the subscription is active." };
    console.error(`library save (${kind}) failed:`, error.message);
    return { ok: false, error: "Couldn’t save. Please try again." };
  }
  revalidatePath("/admin/library");
  return { ok: true };
}

/** For ConfirmAction (throws so it can show the error toast). */
export async function deleteLibraryItem(formData: FormData) {
  const k = KINDS[formData.get("kind") as LibraryKind];
  if (!k) throw new Error("Unknown list.");
  const id = z.string().uuid().parse(formData.get("id"));
  const sb = await createClient();
  const { error } = await sb.from(k.table).delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/library");
}
