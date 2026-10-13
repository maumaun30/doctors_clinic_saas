"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasTwoFactorSession } from "@/lib/auth/mfa";
import { AVATAR_BUCKET, avatarUrl } from "@/lib/avatar";

const MAX_BYTES = 2 * 1024 * 1024; // matches the bucket limit
const EXT: Record<string, string> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };
const userId = z.string().uuid().optional();

type Result = { ok: true; url: string | null } | { ok: false; error: string };
type Target = { ok: true; id: string; before: string | null } | { ok: false; error: string };

// Whose picture is being changed. Your own, or (admins only) someone in
// your account. Defense in depth: the profiles UPDATE policies enforce the
// same thing (own row, or is_admin() — which needs 2FA — on a same-account
// row), and the check constraint keeps the path in the target's folder.
async function resolveTarget(sb: SupabaseClient, raw: unknown): Promise<Target> {
  const parsed = userId.safeParse(raw || undefined);
  if (!parsed.success) return { ok: false, error: "Unknown person." };
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "You’re signed out. Sign in and try again." };

  const id = parsed.data ?? user.id;
  if (id !== user.id) {
    const { data: me } = await sb.from("profiles").select("role").eq("id", user.id).single();
    if (me?.role !== "admin" || !(await hasTwoFactorSession(sb))) {
      return { ok: false, error: "Only admins can change someone else’s picture." };
    }
  }
  // RLS: you see your own row; admins see same-account rows.
  const { data: row } = await sb.from("profiles").select("avatar_path").eq("id", id).maybeSingle();
  if (!row) return { ok: false, error: "Unknown person." };
  return { ok: true, id, before: row.avatar_path };
}

// Upload a profile picture: your own, or a staff member's when you're an
// admin. The browser has already cropped and resized it
// (app/_components/avatar-field.tsx). The service_role client writes the
// image under <target id>/ (the bucket is service_role-write only); the
// session client then points profiles.avatar_path at it, under RLS.
export async function uploadAvatar(formData: FormData): Promise<Result> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose an image." };
  if (file.size > MAX_BYTES) return { ok: false, error: "That image is too large (max 2 MB)." };
  const ext = EXT[file.type];
  if (!ext) return { ok: false, error: "Use a PNG, JPEG or WebP image." };

  const sb = await createClient();
  const target = await resolveTarget(sb, formData.get("user_id"));
  if (!target.ok) return target;

  // A new name per upload, so browsers never show a cached old picture.
  const path = `${target.id}/${Date.now()}.${ext}`;
  const admin = createAdminClient();
  const { error: upErr } = await admin.storage.from(AVATAR_BUCKET)
    .upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
  if (upErr) {
    console.error("avatar upload failed:", upErr.message);
    return { ok: false, error: "Couldn’t upload the picture. Please try again." };
  }

  const { data: saved, error } = await sb.from("profiles").update({ avatar_path: path }).eq("id", target.id).select("id");
  if (error || !saved?.length) {
    await admin.storage.from(AVATAR_BUCKET).remove([path]);
    console.error("avatar save failed:", error?.message ?? "no row updated");
    return { ok: false, error: "Couldn’t save the picture. Please try again." };
  }

  if (target.before) await admin.storage.from(AVATAR_BUCKET).remove([target.before]);
  revalidatePath("/", "layout"); // sidebar and staff pages show the picture
  return { ok: true, url: avatarUrl(path) };
}

export async function removeAvatar(forUserId?: string): Promise<Result> {
  const sb = await createClient();
  const target = await resolveTarget(sb, forUserId);
  if (!target.ok) return target;

  const { data: saved, error } = await sb.from("profiles").update({ avatar_path: null }).eq("id", target.id).select("id");
  if (error || !saved?.length) {
    console.error("avatar remove failed:", error?.message ?? "no row updated");
    return { ok: false, error: "Couldn’t remove the picture. Please try again." };
  }
  if (target.before) await createAdminClient().storage.from(AVATAR_BUCKET).remove([target.before]);
  revalidatePath("/", "layout");
  return { ok: true, url: null };
}
