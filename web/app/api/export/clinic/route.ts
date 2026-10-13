import { NextResponse } from "next/server";
import { strToU8, zipSync } from "fflate";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMyProfile } from "@/lib/data/queries";
import { hasTwoFactorSession } from "@/lib/auth/mfa";
import { fetchAll, toCsv } from "@/lib/export/csv";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BUCKET = "exports";

// One CSV per table. Read with the admin's own session, so RLS limits
// every query to their account exactly as the app does.
const TABLES: { file: string; table: string; select?: string; orderBy?: string; about: string }[] = [
  { file: "clinics.csv", table: "clinics", about: "Your clinics and online booking settings." },
  { file: "staff.csv", table: "profiles", select: "id, full_name, role, phone, avatar_path, created_at, deactivated_at",
    about: "Admins, doctors and secretaries. deactivated_at is set for people whose access was removed." },
  { file: "doctors.csv", table: "doctors", orderBy: "profile_id", about: "Doctor details (specialization, PRC licence). profile_id = staff.csv id." },
  { file: "doctor_clinics.csv", table: "doctor_clinics", about: "Which doctor works at which clinic." },
  { file: "doctor_hours.csv", table: "doctor_availability", about: "Weekly hours. weekday: 0 = Sunday … 6 = Saturday." },
  { file: "secretary_assignments.csv", table: "clinic_assignments", about: "Which secretary supports which doctor_clinics row." },
  { file: "patients.csv", table: "patients", about: "Patient details." },
  { file: "patient_clinics.csv", table: "patient_clinics", about: "Which clinics each patient is linked to." },
  { file: "appointments.csv", table: "appointments", about: "All appointments. Times are UTC (ISO 8601)." },
  { file: "visits.csv", table: "medical_records", about: "Visit records: complaint, diagnosis, vitals (JSON), notes." },
  { file: "prescriptions.csv", table: "prescriptions", about: "Prescriptions. medical_record_id = visits.csv id." },
  { file: "lab_orders.csv", table: "lab_orders", about: "Lab requests and results." },
  { file: "lab_files.csv", table: "lab_result_files",
    about: "Lab result files by name. The files themselves are not in this ZIP; download them from each visit in the app." },
  { file: "conditions.csv", table: "patient_conditions", about: "Patients' problem lists." },
  { file: "library_medications.csv", table: "common_medications", about: "Your medication quick picks." },
  { file: "library_lab_tests.csv", table: "common_lab_tests", about: "Your lab test quick picks." },
  { file: "library_conditions.csv", table: "common_conditions", about: "Your condition quick picks." },
  { file: "audit_log.csv", table: "audit_log", about: "Changes to records: who (actor_id = staff.csv id), what and when." },
];

/**
 * Whole-clinic export (admins with 2FA). Builds a ZIP of CSVs, stores it
 * in the private `exports` bucket (replacing the previous one) and
 * redirects to a short-lived signed download link. Works even when the
 * account is read-only, so a clinic can always take its data with it.
 */
export async function GET(req: Request) {
  const sb = await createClient();
  const me = await getMyProfile(sb);
  if (!me?.account_id || me.role !== "admin" || me.deactivated_at) {
    return NextResponse.json({ error: "Only clinic admins can export data." }, { status: 403 });
  }
  if (!(await hasTwoFactorSession(sb))) {
    return NextResponse.redirect(new URL("/mfa?next=/admin/export", req.url), 303);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const files: Record<string, Uint8Array> = {};
  const counts: string[] = [];
  for (const t of TABLES) {
    const rows = await fetchAll(sb, t.table, t.select, t.orderBy);
    files[t.file] = strToU8(toCsv(rows));
    counts.push(`${t.file.padEnd(28)} ${String(rows.length).padStart(7)} rows  ${t.about}`);
  }
  files["README.txt"] = strToU8([
    `Clinic data export — ${new Date().toISOString()}`,
    "",
    "One CSV file per kind of record. Columns ending in _id refer to the id column of another file",
    "(e.g. appointments.csv patient_id = patients.csv id). Times are UTC in ISO 8601 format.",
    "Open the CSV files in Excel, Google Sheets or any spreadsheet app.",
    "",
    ...counts,
    "",
  ].join("\r\n"));

  const zip = zipSync(files, { level: 6 });
  const folder = me.account_id;
  const path = `${folder}/clinic-export-${stamp}.zip`;
  const admin = createAdminClient();
  const store = admin.storage.from(BUCKET);

  const { data: old } = await store.list(folder);
  const { error: upErr } = await store.upload(path, zip, { contentType: "application/zip", upsert: true });
  if (upErr) {
    console.error("export upload failed:", upErr.message);
    return NextResponse.json({ error: "Couldn’t prepare the export. Please try again." }, { status: 500 });
  }
  if (old?.length) await store.remove(old.map(o => `${folder}/${o.name}`).filter(p => p !== path));

  const { data: signed, error: signErr } = await store.createSignedUrl(path, 300, { download: `clinic-export-${stamp}.zip` });
  if (signErr || !signed) {
    console.error("export sign failed:", signErr?.message);
    return NextResponse.json({ error: "Couldn’t prepare the download link." }, { status: 500 });
  }

  await admin.from("audit_log").insert({
    actor_id: me.id, account_id: me.account_id, table_name: "exports", row_id: null, operation: "INSERT",
    after: { kind: "clinic", files: TABLES.length, bytes: zip.byteLength },
  });

  return NextResponse.redirect(signed.signedUrl, 303);
}
