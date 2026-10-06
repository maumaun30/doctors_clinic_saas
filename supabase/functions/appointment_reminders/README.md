# appointment_reminders

Edge Function that emails next-day appointment reminders via
[Resend](https://resend.com).

- Fetches tomorrow's (Asia/Manila) scheduled/confirmed appointments via
  `appointments_for_reminder(1)`.
- Emails each patient that has an `email` on file. Patients without one
  are counted as `skipped_no_email`.
- Records every attempt in `appointment_reminders` (`sent` / `failed`).
  The RPC skips appointments that already have a `sent` email for their
  current `scheduled_at`, so re-running is safe; failed sends are retried
  on the next run, and a rescheduled appointment gets a fresh reminder.
- Without `RESEND_API_KEY` it runs as a **dry run**: logs what it would
  send and records nothing.

Response: `{ ok, dry_run, sent, failed, skipped_no_email }`.

## Secrets

```
supabase secrets set RESEND_API_KEY=re_xxx
supabase secrets set REMINDER_FROM="Clinic <reminders@yourdomain.com>"
supabase secrets set REMINDER_REPLY_TO=frontdesk@yourdomain.com   # optional
```

`REMINDER_FROM` must use a domain verified in Resend.

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

Sends are paced ~600 ms apart to stay under Resend's default rate limit,
so one run handles a few hundred reminders within the Edge Function
time limit. SMS is not wired yet; the `channel` column already allows
`'sms'` for when it is.
