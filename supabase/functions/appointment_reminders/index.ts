// Supabase Edge Function: appointment_reminders
//
// Pulls tomorrow's active appointments via the SECURITY DEFINER RPC
// `appointments_for_reminder(1)` and logs them. This is the seam for
// real SMS/email later (Twilio, Resend, etc.) — keep the dispatch
// pluggable via env vars; no provider wired in MVP.
//
// Schedule it daily once you're ready:
//
//   select cron.schedule(
//     'appointment_reminders_daily',
//     '0 22 * * *',  -- 22:00 UTC = 06:00 PH for next-day reminders
//     $$ select net.http_post(
//          url := 'https://<project-ref>.functions.supabase.co/appointment_reminders',
//          headers := jsonb_build_object(
//            'Authorization', 'Bearer ' || current_setting('app.service_role_key', true),
//            'Content-Type', 'application/json')) $$);
//
// Invoke manually:
//   supabase functions invoke appointment_reminders --no-verify-jwt

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (_req) => {
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase.rpc("appointments_for_reminder", {
    p_days_ahead: 1,
  });
  if (error) {
    console.error("rpc error:", error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }

  let sent = 0;
  for (const a of data ?? []) {
    // TODO: dispatch via SMS/email provider. For now, log only.
    console.log(
      `[reminder] ${a.scheduled_at} — ${a.patient_name} (${a.patient_phone ?? "no phone"}) ` +
      `with ${a.doctor_name} at ${a.clinic_name}`,
    );
    sent++;
  }

  return new Response(JSON.stringify({ ok: true, count: sent }), {
    headers: { "Content-Type": "application/json" },
  });
});
