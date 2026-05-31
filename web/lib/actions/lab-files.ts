"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "lab-results";
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED = new Set([
  "application/pdf",
  "image/png", "image/jpeg", "image/webp", "image/heic",
]);

const uploadInput = z.object({
  lab_order_id: z.string().uuid(),
});

// Upload a file attached to a lab_order. Auth path:
//   1. session client checks the caller can read the parent lab_order
//      (RLS-enforced — secretaries fail here).
//   2. admin (service_role) client writes the binary to Storage.
//   3. session client inserts lab_result_files row; RLS checks again
//      that the caller is the treating doctor or account admin.
export async function uploadLabResult(formData: FormData) {
  const input = uploadInput.parse({
    lab_order_id: formData.get("lab_order_id"),
  });
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("file required");
  if (file.size === 0) throw new Error("empty file");
  if (file.size > MAX_BYTES) throw new Error("file too large (max 10 MB)");
  if (file.type && !ALLOWED.has(file.type)) throw new Error(`unsupported type: ${file.type}`);

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("not authenticated");

  // 1. Authorization probe: select the order through RLS. If we can't
  // see it, we can't attach to it.
  const { data: order, error: orderErr } = await sb
    .from("lab_orders")
    .select("id, patient_id, medical_record_id")
    .eq("id", input.lab_order_id)
    .single();
  if (orderErr || !order) throw new Error("lab order not found or forbidden");

  // 2. Upload the binary via service_role.
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const objectPath =
    `${order.patient_id}/${order.id}/${Date.now()}_${safeName}`;
  const admin = createAdminClient();
  const { error: upErr } = await admin.storage
    .from(BUCKET)
    .upload(objectPath, file, { contentType: file.type, upsert: false });
  if (upErr) throw new Error(`storage: ${upErr.message}`);

  // 3. Metadata row — RLS enforces doctor/admin write.
  const { error: insErr } = await sb.from("lab_result_files").insert({
    lab_order_id: order.id,
    file_path: objectPath,
    file_name: file.name,
    content_type: file.type || null,
    size_bytes: file.size,
    uploaded_by: user.id,
  });
  if (insErr) {
    // Roll back the binary so we don't leak orphaned objects.
    await admin.storage.from(BUCKET).remove([objectPath]);
    throw new Error(`db: ${insErr.message}`);
  }

  // Auto-advance the order status to completed on first attachment.
  await sb.from("lab_orders").update({ status: "completed", result_at: new Date().toISOString() })
    .eq("id", order.id).eq("status", "ordered");
}

// Returns a short-lived signed URL the browser can use to download the
// file. RLS check happens implicitly: if the caller can't see the row,
// the select returns nothing.
export async function getLabFileSignedUrl(file_id: string): Promise<string> {
  const sb = await createClient();
  const { data: row, error } = await sb
    .from("lab_result_files").select("file_path").eq("id", file_id).single();
  if (error || !row) throw new Error("file not found or forbidden");
  const admin = createAdminClient();
  const { data, error: sErr } = await admin.storage
    .from(BUCKET).createSignedUrl(row.file_path, 60); // 60s
  if (sErr || !data) throw new Error(`signed url: ${sErr?.message}`);
  return data.signedUrl;
}

export async function deleteLabFile(file_id: string) {
  const sb = await createClient();
  const { data: row, error } = await sb
    .from("lab_result_files").select("file_path").eq("id", file_id).single();
  if (error || !row) throw new Error("not found or forbidden");
  // Delete the metadata row first (RLS-checked); if it succeeds, remove blob.
  const { error: delErr } = await sb.from("lab_result_files").delete().eq("id", file_id);
  if (delErr) throw new Error(delErr.message);
  const admin = createAdminClient();
  await admin.storage.from("lab-results").remove([row.file_path]);
}
