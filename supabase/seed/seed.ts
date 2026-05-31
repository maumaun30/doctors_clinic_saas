// Seeder: ensures one admin (you), creates a dummy doctor + secretary,
// a sample clinic, doctor↔clinic pairing, secretary assignment, and a
// weekday availability window. Idempotent — safe to re-run.
//
// Run:
//   cd supabase/seed
//   npm install
//   cp .env.example .env   # fill values
//   npm run seed
//
// Required env:
//   SUPABASE_URL                 https://<ref>.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY    server-only key
//   SEED_ADMIN_EMAIL             the email you already promoted to admin
//   SEED_DOCTOR_EMAIL            e.g. doctor@example.com
//   SEED_DOCTOR_PASSWORD
//   SEED_SECRETARY_EMAIL         e.g. secretary@example.com
//   SEED_SECRETARY_PASSWORD
//   SEED_CLINIC_NAME             e.g. "Main Clinic"

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const env = (k: string) => {
  const v = process.env[k];
  if (!v) { console.error(`missing env: ${k}`); process.exit(1); }
  return v;
};

const sb = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ADMIN_EMAIL     = env("SEED_ADMIN_EMAIL").toLowerCase();
const DOCTOR_EMAIL    = env("SEED_DOCTOR_EMAIL").toLowerCase();
const DOCTOR_PASSWORD = env("SEED_DOCTOR_PASSWORD");
const SEC_EMAIL       = env("SEED_SECRETARY_EMAIL").toLowerCase();
const SEC_PASSWORD    = env("SEED_SECRETARY_PASSWORD");
const CLINIC_NAME     = env("SEED_CLINIC_NAME");

async function getUserByEmail(email: string) {
  // listUsers is paginated; for a seeder we scan a few pages.
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const u = data.users.find(u => u.email?.toLowerCase() === email);
    if (u) return u;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function ensureUser(email: string, password: string, fullName: string) {
  const existing = await getUserByEmail(email);
  if (existing) {
    console.log(`✓ user exists: ${email}`);
    return existing;
  }
  const { data, error } = await sb.auth.admin.createUser({
    email, password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) throw error;
  console.log(`+ created user: ${email}`);
  return data.user!;
}

async function main() {
  // 1. Verify the admin exists and grab their account_id.
  const admin = await getUserByEmail(ADMIN_EMAIL);
  if (!admin) throw new Error(`admin user ${ADMIN_EMAIL} not found in auth.users`);
  const { data: adminProfile, error: apErr } = await sb
    .from("profiles").select("id, role, account_id").eq("id", admin.id).single();
  if (apErr) throw apErr;
  if (adminProfile.role !== "admin" || !adminProfile.account_id) {
    throw new Error(
      `${ADMIN_EMAIL} is not yet admin. Run bootstrap_first_admin() first.`,
    );
  }
  const accountId = adminProfile.account_id;
  console.log(`✓ admin: ${ADMIN_EMAIL}  account_id=${accountId}`);

  // 2. Make sure they're the ONLY admin in this account.
  const { data: otherAdmins, error: oaErr } = await sb
    .from("profiles").select("id")
    .eq("account_id", accountId).eq("role", "admin").neq("id", admin.id);
  if (oaErr) throw oaErr;
  if (otherAdmins.length > 0) {
    const ids = otherAdmins.map(o => o.id);
    const { error } = await sb.from("profiles")
      .update({ role: "pending" }).in("id", ids);
    if (error) throw error;
    console.log(`- demoted ${ids.length} other admin(s) to pending`);
  } else {
    console.log("✓ no other admins to demote");
  }

  // 3. Ensure dummy doctor + secretary users exist (auth + profile via trigger).
  const docUser = await ensureUser(DOCTOR_EMAIL, DOCTOR_PASSWORD, "Dummy Doctor");
  const secUser = await ensureUser(SEC_EMAIL,    SEC_PASSWORD,    "Dummy Secretary");

  // 4. Promote them into the admin's account with the right roles.
  const upsertProfile = async (id: string, role: "doctor" | "secretary") => {
    const { error } = await sb.from("profiles")
      .update({ role, account_id: accountId }).eq("id", id);
    if (error) throw error;
  };
  await upsertProfile(docUser.id, "doctor");
  await upsertProfile(secUser.id, "secretary");
  console.log("✓ assigned roles");

  // 5. Make sure there's a doctors row for the doctor.
  const { error: dErr } = await sb.from("doctors")
    .upsert({ profile_id: docUser.id, specialization: "General Practice" });
  if (dErr) throw dErr;

  // 6. Sample clinic (idempotent by name within account).
  let clinicId: string;
  const { data: clinicHit } = await sb.from("clinics")
    .select("id").eq("account_id", accountId).eq("name", CLINIC_NAME).maybeSingle();
  if (clinicHit) {
    clinicId = clinicHit.id;
    console.log(`✓ clinic exists: ${CLINIC_NAME}`);
  } else {
    const { data, error } = await sb.from("clinics")
      .insert({ account_id: accountId, name: CLINIC_NAME, address: "Sample address" })
      .select("id").single();
    if (error) throw error;
    clinicId = data.id;
    console.log(`+ created clinic: ${CLINIC_NAME}`);
  }

  // 7. Doctor ↔ Clinic pairing.
  let dcId: string;
  const { data: dcHit } = await sb.from("doctor_clinics")
    .select("id").eq("doctor_id", docUser.id).eq("clinic_id", clinicId).maybeSingle();
  if (dcHit) {
    dcId = dcHit.id;
  } else {
    const { data, error } = await sb.from("doctor_clinics")
      .insert({ doctor_id: docUser.id, clinic_id: clinicId })
      .select("id").single();
    if (error) throw error;
    dcId = data.id;
    console.log("+ paired doctor ↔ clinic");
  }

  // 8. Secretary assignment.
  const { data: caHit } = await sb.from("clinic_assignments")
    .select("id").eq("doctor_clinic_id", dcId).eq("secretary_id", secUser.id).maybeSingle();
  if (!caHit) {
    const { error } = await sb.from("clinic_assignments")
      .insert({ doctor_clinic_id: dcId, secretary_id: secUser.id });
    if (error) throw error;
    console.log("+ assigned secretary to (doctor, clinic)");
  }

  // 9. Availability: Mon–Fri 09:00–17:00 PH.
  for (const weekday of [1, 2, 3, 4, 5]) {
    const { data: hit } = await sb.from("doctor_availability")
      .select("id")
      .eq("doctor_id", docUser.id).eq("clinic_id", clinicId)
      .eq("weekday", weekday).maybeSingle();
    if (!hit) {
      const { error } = await sb.from("doctor_availability").insert({
        doctor_id: docUser.id, clinic_id: clinicId,
        weekday, start_time: "09:00", end_time: "17:00",
      });
      if (error) throw error;
    }
  }
  console.log("✓ availability Mon–Fri 09:00–17:00 ensured");

  console.log("\nDone. Try logging in with:");
  console.log(`  doctor:    ${DOCTOR_EMAIL} / ${DOCTOR_PASSWORD}`);
  console.log(`  secretary: ${SEC_EMAIL} / ${SEC_PASSWORD}`);
}

main().catch(e => { console.error(e); process.exit(1); });
