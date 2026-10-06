// Supabase Edge Function: appointment_reminders
//
// Pulls tomorrow's active appointments via the SECURITY DEFINER RPC
// `appointments_for_reminder(1)` and emails each patient that has an
// address on file, via Resend. Every attempt is recorded in
// `appointment_reminders`; the RPC skips anything already sent, so
// re-running the job never double-sends.
//
// Env (set with `supabase secrets set ...`):
//   RESEND_API_KEY   Resend API key. Unset => dry run (log only, nothing recorded).
//   REMINDER_FROM    Sender, e.g. "Clinic <reminders@yourdomain.com>" (verified in Resend).
//   REMINDER_REPLY_TO  optional reply-to address.
//
// Deployed with --no-verify-jwt (cron calls it), so the function checks
// the bearer token itself: it must equal the service_role key.
//
// Schedule + invoke: see README.md.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

const TZ = "Asia/Manila";
// Resend's default rate limit is a few requests/second; stay under it.
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
  apiKey: string, from: string, replyTo: string | undefined, to: string,
  msg: { subject: string; text: string; html: string }, idempotencyKey: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const res = await fetch("https://api.resend.com/emails", {
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

Deno.serve(async (req) => {
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (req.headers.get("Authorization") !== `Bearer ${serviceKey}`) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("REMINDER_FROM");
  const replyTo = Deno.env.get("REMINDER_REPLY_TO") || undefined;
  const dryRun = !apiKey;
  if (!dryRun && !from) {
    return json({ ok: false, error: "REMINDER_FROM not set" }, 500);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase.rpc("appointments_for_reminder", {
    p_days_ahead: 1,
  });
  if (error) {
    console.error("rpc error:", error);
    return json({ ok: false, error: error.message }, 500);
  }

  let sent = 0, failed = 0, skipped = 0;
  for (const r of (data ?? []) as Reminder[]) {
    if (!r.patient_email) {
      skipped++;
      continue;
    }
    const msg = buildEmail(r);

    if (dryRun) {
      console.log(`[reminder:dry-run] ${r.patient_email} — ${msg.subject}`);
      sent++;
      continue;
    }

    if (sent + failed > 0) await new Promise(res => setTimeout(res, SEND_GAP_MS));
    const result = await sendResend(
      apiKey!, from!, replyTo, r.patient_email, msg,
      `reminder-${r.appointment_id}-${r.scheduled_at}`,
    );
    const { error: logErr } = await supabase.from("appointment_reminders").insert({
      appointment_id: r.appointment_id,
      channel: "email",
      scheduled_at: r.scheduled_at,
      status: result.ok ? "sent" : "failed",
      provider_id: result.ok ? result.id : null,
      error: result.ok ? null : result.error,
    });
    if (logErr) console.error(`log insert failed for ${r.appointment_id}:`, logErr.message);

    if (result.ok) sent++;
    else {
      failed++;
      console.error(`[reminder] send failed for ${r.appointment_id}: ${result.error}`);
    }
  }

  return json({ ok: failed === 0, dry_run: dryRun, sent, failed, skipped_no_email: skipped });
});
