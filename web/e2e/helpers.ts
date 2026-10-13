import { createHmac } from "node:crypto";
import { expect, type Page } from "@playwright/test";

// Fixture logins from supabase/seed/e2e.sql (test-only values).
export const PASSWORD = "e2e-test-password";
export const USERS = {
  admin: "admin@e2e.test",
  doctor: "doctor@e2e.test",
  secretary: "sec@e2e.test",
} as const;
export const IDS = {
  patient: "e2e00000-0000-0000-0000-000000000101",
  openAppointment: "e2e00000-0000-0000-0000-000000000201",
} as const;

export async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

/** Signs in as a doctor or secretary and waits for the app. */
export async function signInAs(page: Page, who: "doctor" | "secretary") {
  await signIn(page, USERS[who]);
  await expect(page).toHaveURL(/\/today/);
}

/** RFC 6238 code (SHA-1, 6 digits, 30 s) for a base32 secret. */
export function totp(secret: string, at = Date.now()): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of secret.replace(/=+$/, "").toUpperCase()) bits += alphabet.indexOf(c).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g)!.map(b => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30_000)));
  const h = createHmac("sha1", key).update(counter).digest();
  const o = h[h.length - 1] & 0xf;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

/** Tomorrow in Manila as YYYY-MM-DD. */
export function tomorrowPh(): string {
  return new Date(Date.now() + 86_400_000).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}
