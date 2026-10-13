"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AVATAR_BUCKET, avatarUrl } from "@/lib/avatar";

const MAX_BYTES = 2 * 1024 * 1024; // matches the bucket limit
const EXT: Record<string, string> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };

type Result = { ok: true; url: string | null } | { ok: false; error: string };

// Upload the signed-in user's profile picture. The browser has already
// cropped and resized it (see account/avatar-field.tsx). Auth path:
//   1. session client identifies the user.
//   2. service_role client writes the image under <user id>/ in Storage
//      (the bucket is service_role-write only).
//   3. session client points profiles.avatar_path at it (RLS: own row;
//      a check constraint keeps the path inside the user's folder).
export async function uploadAvatar(formData: FormData): Promise<Result> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose an image." };
  if (file.size > MAX_BYTES) return { ok: false, error: "That image is too large (max 2 MB)." };
  const ext = EXT[file.type];
  if (!ext) return { ok: false, error: "Use a PNG, JPEG or WebP image." };

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "You’re signed out. Sign in and try again." };

  const { data: before } = await sb.from("profiles").select("avatar_path").eq("id", user.id).single();

  // A new name per upload, so browsers never show a cached old picture.
  const path = `${user.id}/${Date.now()}.${ext}`;
  const admin = createAdminClient();
  const { error: upErr } = await admin.storage.from(AVATAR_BUCKET)
    .upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
  if (upErr) {
    console.error("avatar upload failed:", upErr.message);
    return { ok: false, error: "Couldn’t upload the picture. Please try again." };
  }

  const { error } = await sb.from("profiles").update({ avatar_path: path }).eq("id", user.id);
  if (error) {
    await admin.storage.from(AVATAR_BUCKET).remove([path]);
    console.error("avatar save failed:", error.message);
    return { ok: false, error: "Couldn’t save the picture. Please try again." };
  }

  if (before?.avatar_path) await admin.storage.from(AVATAR_BUCKET).remove([before.avatar_path]);
  revalidatePath("/", "layout"); // sidebar shows the picture
  return { ok: true, url: avatarUrl(path) };
}

export async function removeAvatar(): Promise<Result> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "You’re signed out. Sign in and try again." };

  const { data: before } = await sb.from("profiles").select("avatar_path").eq("id", user.id).single();
  const { error } = await sb.from("profiles").update({ avatar_path: null }).eq("id", user.id);
  if (error) {
    console.error("avatar remove failed:", error.message);
    return { ok: false, error: "Couldn’t remove the picture. Please try again." };
  }
  if (before?.avatar_path) await createAdminClient().storage.from(AVATAR_BUCKET).remove([before.avatar_path]);
  revalidatePath("/", "layout");
  return { ok: true, url: null };
}
