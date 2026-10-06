# appointment_reminders

Edge Function that sends next-day appointment reminders on two
independent channels:

- **Email** via [Resend](https://resend.com) to patients with an `email`.
- **SMS** via [Semaphore](https://semaphore.co) to patients whose `phone`
  is a PH mobile (`09…`, `+639…`, `639…`, `9…`; spaces/dashes fine).
  Landlines and foreign numbers are skipped. Texts are ASCII-only and
  ≤160 chars (one credit), and always start with `Reminder:` — Semaphore
  silently drops messages that start with "TEST".

How it works:

- Each channel fetches its due list with
  `appointments_for_reminder(1, '<channel>')` — tomorrow's (Asia/Manila)
  scheduled/confirmed appointments with no `sent` reminder **on that
  channel** for their current `scheduled_at`.
- Every attempt is recorded in `appointment_reminders` (`sent` /
  `failed`), so re-running is safe, failed sends retry next run, and a
  rescheduled appointment gets fresh reminders.
- A channel whose API key is unset runs as a **dry run**: logs what it
  would send and records nothing. So you can enable email and SMS
  independently.

Response:

```json
{ "ok": true,
  "email": { "dry_run": false, "sent": 3, "failed": 0, "skipped": 1 },
  "sms":   { "dry_run": false, "sent": 4, "failed": 0, "skipped": 0 } }
```

`skipped` = no email (email) or no PH mobile (SMS).

## Secrets

```
# email
supabase secrets set RESEND_API_KEY=re_xxx
supabase secrets set REMINDER_FROM="Clinic <reminders@yourdomain.com>"
supabase secrets set REMINDER_REPLY_TO=frontdesk@yourdomain.com   # optional

# SMS
supabase secrets set SEMAPHORE_API_KEY=xxxxxxxx
supabase secrets set SEMAPHORE_SENDER_NAME=YOURCLINIC   # optional; must be approved in Semaphore
```

`REMINDER_FROM` must use a domain verified in Resend. Without
`SEMAPHORE_SENDER_NAME`, Semaphore uses your account's default sender.

## Deploy

```
supabase functions deploy appointment_reminders --no-verify-jwt
```

`--no-verify-jwt` because cron / `pg_net` calls it without a user JWT.
The function instead requires `Authorization: Bearer <service_role key>`
and returns 401 otherwise, so the public URL can't be used to trigger
sends.

## Schedule with pg_cron + pg_net

In the SQL editor (one-time):

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Store the service_role key as a DB setting so cron jobs can read it.
-- Run once from the SQL editor.
alter database postgres set app.service_role_key = '<SERVICE_ROLE_KEY>';

select cron.schedule(
  'appointment_reminders_daily',
  '0 22 * * *',  -- 22:00 UTC = 06:00 PH for next-day reminders
  $$
    select net.http_post(
      url := 'https://<project-ref>.functions.supabase.co/appointment_reminders',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.service_role_key', true),
        'Content-Type', 'application/json'))
  $$
);
```

Check delivery history:

```sql
select r.attempted_at, r.status, r.error, p.full_name, p.email
from appointment_reminders r
join appointments a on a.id = r.appointment_id
join patients p on p.id = a.patient_id
order by r.attempted_at desc limit 50;
```

## Local invoke

```
supabase functions serve appointment_reminders --no-verify-jwt
# in another shell:
curl -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  http://localhost:54321/functions/v1/appointment_reminders
```

## Limits

Sends are paced ~600 ms apart per channel to stay under Resend's and
Semaphore's (120/min) rate limits, so one run handles a few hundred
reminders per channel within the Edge Function time limit. Each SMS costs
one Semaphore credit; check your balance before enabling.

## Tests

```
deno test --no-lock supabase/functions/appointment_reminders/sms_test.ts
```

The end-to-end run (`supabase/tests/e2e/run.sh`, also in CI) exercises
both channels against mock Resend and Semaphore servers.
