# appointment_reminders

Edge Function that fetches tomorrow's active appointments via
`appointments_for_reminder(1)` and (currently) logs them. Hook in an
SMS/email provider where the `// TODO: dispatch` comment lives.

## Deploy

```
supabase functions deploy appointment_reminders --no-verify-jwt
```

`--no-verify-jwt` because cron / `pg_net` will call it without a user
JWT. The function authenticates to the DB with the service_role key
already present in the function environment.

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

## Local invoke

```
supabase functions serve appointment_reminders --no-verify-jwt
# in another shell:
curl http://localhost:54321/functions/v1/appointment_reminders
```
