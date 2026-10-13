// SMS helpers for appointment reminders (Semaphore, Philippines).
// Pure functions — unit-tested in sms_test.ts.

const TZ = "Asia/Manila";
const MAX_LEN = 160; // one Semaphore credit = 160 ASCII chars

/**
 * Normalize a PH mobile number to Semaphore's 09XXXXXXXXX form.
 * Accepts +639…, 639…, 09…, 9… with any spaces/dashes/brackets.
 * Returns null for anything that isn't a PH mobile (landlines, foreign).
 */
export function normalizePhMobile(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("63")) d = d.slice(2);
  else if (d.startsWith("0")) d = d.slice(1);
  return /^9\d{9}$/.test(d) ? `0${d}` : null;
}

/** Strip accents and anything non-ASCII so the message stays GSM/ASCII (160 chars, 1 credit). */
export function toAscii(s: string): string {
  return s.normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7E]/g, "").replace(/\s+/g, " ").trim();
}

function clip(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, Math.max(0, n - 1)).trimEnd()}.`;
}

function whenShort(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  }).format(new Date(iso));
}

/**
 * Reminder text, guaranteed ASCII and ≤160 chars. Always starts with
 * "Reminder:" — Semaphore silently drops messages that start with "TEST".
 * With `link` (the patient's confirm/cancel page) the link is kept whole
 * and names are shortened to fit; if it can't fit, it's left out.
 */
export function buildSms(r: { scheduled_at: string; doctor_name: string; clinic_name: string }, link?: string | null): string {
  if (link) {
    const withLink = fit(r, ` Confirm/cancel: ${link}`, 10);
    if (withLink) return withLink;
  }
  return fit(r, " To reschedule, call the clinic.", 12)
    ?? clip(`Reminder: ${toAscii(r.doctor_name)}, ${whenShort(r.scheduled_at)} at ${toAscii(r.clinic_name)}.`, MAX_LEN);
}

/** "Reminder: <doctor>, <when> at <clinic>.<tail>", shrinking names to fit; null if even short names don't. */
function fit(r: { scheduled_at: string; doctor_name: string; clinic_name: string }, tail: string, minName: number): string | null {
  const when = whenShort(r.scheduled_at);
  const doctor = toAscii(r.doctor_name);
  const clinic = toAscii(r.clinic_name);
  const make = (d: string, c: string) => `Reminder: ${d}, ${when} at ${c}.${tail}`;

  const msg = make(doctor, clinic);
  if (msg.length <= MAX_LEN) return msg;
  // Shrink the clinic name first, then the doctor's.
  const budget = MAX_LEN - make("", "").length;
  if (budget < minName + 8) return null;
  const d = clip(doctor, Math.max(minName, Math.floor(budget / 2)));
  const c = clip(clinic, Math.max(8, budget - d.length));
  const out = make(d, c);
  return out.length <= MAX_LEN ? out : null;
}
