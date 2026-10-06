// Supabase Edge Function: appointment_reminders
//
// Sends next-day appointment reminders on two independent channels:
//   * email via Resend, to patients with an email on file
//   * SMS via Semaphore, to patients with a PH mobile number on file
// Each channel pulls its own due list from `appointments_for_reminder(1,
// channel)` and records every attempt in `appointment_reminders`; the RPC
// skips anything already sent on that channel, so re-running never
// double-sends and failed sends are retried next run.
//
// Env (set with `supabase secrets set ...`):
//   RESEND_API_KEY      Resend key. Unset => email dry run (log only, nothing recorded).
//   REMINDER_FROM       Email sender, e.g. "Clinic <reminders@yourdomain.com>" (verified in Resend).
//   REMINDER_REPLY_TO   optional reply-to address.
//   SEMAPHORE_API_KEY   Semaphore key. Unset => SMS dry run.
//   SEMAPHORE_SENDER_NAME  optional approved sender name (defaults to the account's).
//   RESEND_API_URL / SEMAPHORE_API_URL  optional base-URL overrides (tests / proxies).
//
// Deployed with --no-verify-jwt (cron calls it), so the function checks
// the bearer token itself: it must equal the service_role key.
//
// Schedule + invoke: see README.md.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildSms, normalizePhMobile } from "./sms.ts";

type Reminder = {
  appointment_id: string;
  scheduled_at: string;
  duration_minutes: number;
  patient_name: string;
  patient_phone: string | null;
  patient_email: string | null;
  doctor_name: string;
  clinic_name: string;
  clinic_address: string | null;
};

type Channel = "email" | "sms";
type SendResult = { ok: true; id: string } | { ok: false; error: string };
type Summary = { dry_run: boolean; sent: number; failed: number; skipped: number };

const TZ = "Asia/Manila";
// Resend allows a few requests/second, Semaphore 120/minute; stay under both.
const SEND_GAP_MS = 600;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json" },
  });
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function whenText(iso: string) {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: TZ, weekday: "long", month: "long", day: "numeric",
    hour: "numeric", minute: "2-digit",
  }).format(new Date(iso));
}

function buildEmail(r: Reminder) {
  const when = whenText(r.scheduled_at);
  const subject = `Reminder: appointment with ${r.doctor_name} on ${when}`;
  const where = r.clinic_address ? `${r.clinic_name}, ${r.clinic_address}` : r.clinic_name;
  const text =
    `Hi ${r.patient_name},\n\n` +
    `This is a reminder of your appointment with ${r.doctor_name} on ${when} at ${where}.\n\n` +
    `If you need to reschedule or cancel, please contact the clinic.\n\n— ${r.clinic_name}`;
  const html =
    `<p>Hi ${esc(r.patient_name)},</p>` +
    `<p>This is a reminder of your appointment with <strong>${esc(r.doctor_name)}</strong> ` +
    `on <strong>${esc(when)}</strong> at ${esc(where)}.</p>` +
    `<p>If you need to reschedule or cancel, please contact the clinic.</p>` +
    `<p>— ${esc(r.clinic_name)}</p>`;
  return { subject, text, html };
}

async function sendResend(
  apiUrl: string, apiKey: string, from: string, replyTo: string | undefined, to: string,
  msg: { subject: string; text: string; html: string }, idempotencyKey: string,
): Promise<SendResult> {
  const res = await fetch(`${apiUrl}/emails`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({ from, to: [to], reply_to: replyTo, ...msg }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: `${res.status} ${body?.message ?? res.statusText}` };
  return { ok: true, id: body.id };
}

// Semaphore returns a JSON array of message objects on success. Its error
// shape is undocumented, so anything else counts as a failure.
async function sendSemaphore(
  apiUrl: string, apiKey: string, senderName: string | undefined, number: string, message: string,
): Promise<SendResult> {
  const form = new URLSearchParams({ apikey: apiKey, number, message });
  if (senderName) form.set("sendername", senderName);
  const res = await fetch(`${apiUrl}/api/v4/messages`, { method: "POST", body: form });
  const body = await res.json().catch(() => null);
  const m = Array.isArray(body) ? body[0] : null;
  if (res.ok && m?.message_id && m.status !== "Failed") return { ok: true, id: String(m.message_id) };
  const detail = m?.status ?? (body ? JSON.stringify(body).slice(0, 200) : res.statusText);
  return { ok: false, error: `${res.status} ${detail}` };
}

async function runChannel(
  supabase: SupabaseClient,
  channel: Channel,
  dryRun: boolean,
  target: (r: Reminder) => string | null,
  describe: (r: Reminder) => string,
  send: (r: Reminder, to: string) => Promise<SendResult>,
): Promise<Summary | { error: string }> {
  const { data, error } = await supabase.rpc("appointments_for_reminder", {
    p_days_ahead: 1, p_channel: channel,
  });
  if (error) {
    console.error(`[${channel}] rpc error:`, error);
    return { error: error.message };
  }

  const s: Summary = { dry_run: dryRun, sent: 0, failed: 0, skipped: 0 };
  for (const r of (data ?? []) as Reminder[]) {
    const to = target(r);
    if (!to) { s.skipped++; continue; }

    if (dryRun) {
      console.log(`[${channel}:dry-run] ${to} — ${describe(r)}`);
      s.sent++;
      continue;
    }

    if (s.sent + s.failed > 0) await new Promise(res => setTimeout(res, SEND_GAP_MS));
    const result = await send(r, to);
    const { error: logErr } = await supabase.from("appointment_reminders").insert({
      appointment_id: r.appointment_id,
      channel,
      scheduled_at: r.scheduled_at,
      status: result.ok ? "sent" : "failed",
      provider_id: result.ok ? result.id : null,
      error: result.ok ? null : result.error,
    });
    if (logErr) console.error(`[${channel}] log insert failed for ${r.appointment_id}:`, logErr.message);

    if (result.ok) s.sent++;
    else {
      s.failed++;
      console.error(`[${channel}] send failed for ${r.appointment_id}: ${result.error}`);
    }
  }
  return s;
}

Deno.serve(async (req) => {
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (req.headers.get("Authorization") !== `Bearer ${serviceKey}`) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const resendKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("REMINDER_FROM");
  const replyTo = Deno.env.get("REMINDER_REPLY_TO") || undefined;
  const resendUrl = Deno.env.get("RESEND_API_URL") || "https://api.resend.com";
  if (resendKey && !from) {
    return json({ ok: false, error: "REMINDER_FROM not set" }, 500);
  }

  const semaphoreKey = Deno.env.get("SEMAPHORE_API_KEY");
  const senderName = Deno.env.get("SEMAPHORE_SENDER_NAME") || undefined;
  const semaphoreUrl = Deno.env.get("SEMAPHORE_API_URL") || "https://api.semaphore.co";

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const email = await runChannel(
    supabase, "email", !resendKey,
    r => r.patient_email,
    r => buildEmail(r).subject,
    (r, to) => sendResend(resendUrl, resendKey!, from!, replyTo, to, buildEmail(r),
      `reminder-${r.appointment_id}-${r.scheduled_at}`),
  );
  const sms = await runChannel(
    supabase, "sms", !semaphoreKey,
    r => normalizePhMobile(r.patient_phone),
    r => buildSms(r),
    (r, to) => sendSemaphore(semaphoreUrl, semaphoreKey!, senderName, to, buildSms(r)),
  );

  const ok = [email, sms].every(c => !("error" in c) && c.failed === 0);
  return json({ ok, email, sms }, "error" in email || "error" in sms ? 500 : 200);
});
