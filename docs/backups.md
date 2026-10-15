# Nightly backups

`.github/workflows/backup.yml` runs every night at 02:00 Manila time (and on
demand from the Actions tab). It saves an encrypted copy of production as a
workflow artifact named `clinic-backup-YYYY-MM-DD`, kept for 30 days.

Each backup holds:

| File | What |
|---|---|
| `backup/db/roles.sql` | Settings on the Supabase roles |
| `backup/db/schema.sql` | Tables, functions, policies, triggers (our schemas) |
| `backup/db/data.sql` | Every row, including logins (`auth.users`), 2FA factors and storage file records |
| `backup/db/storage_policies.sql` | Access rules on stored files (not part of `schema.sql`) |
| `backup/storage/lab-results/…`, `backup/storage/avatars/…` | The files themselves |
| `backup/storage/content-types.json` | Each file's type, used when uploading them back |

The `exports` bucket is not backed up; it only holds short-lived download zips.

The file is encrypted with [age](https://age-encryption.org) to a public key.
Only the matching private key can open it, and that key never goes to GitHub.
**If the private key is lost, the backups cannot be opened.** Keep it in a
password manager and a second safe place.

## One-time setup

1. Install age and make a key pair (on your own computer):

   ```sh
   brew install age
   age-keygen -o clinic-backup-key.txt
   ```

   The command prints `Public key: age1…`. Store `clinic-backup-key.txt` in your
   password manager, then delete the file from the computer.

2. In GitHub, go to **Settings → Secrets and variables → Actions** and add these repository secrets:

   | Secret | Value |
   |---|---|
   | `BACKUP_AGE_RECIPIENT` | The `age1…` public key |
   | `BACKUP_DB_URL` | Supabase dashboard → **Connect** → **Session pooler** connection string, with the database password filled in. If the password has symbols, percent-encode it (`@` → `%40`, `#` → `%23`, `/` → `%2F`). Use the session pooler, not the direct connection: GitHub's servers can't reach the direct one. |
   | `BACKUP_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
   | `BACKUP_SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → **Project Settings → API keys** → service role / secret key |

3. Go to **Actions → Nightly backup → Run workflow** and check that the run is green and the artifact appears.

GitHub emails you when a scheduled run fails. If a backup is ever missing,
check the Actions tab first.

## Restoring

Use this after data loss, or once in a while as a drill. Restore into a **new**
Supabase project first, check it, and only then point the app at it.

1. **Download and open the backup.** Download the artifact from the run page,
   unzip it, then decrypt and extract it:

   ```sh
   age -d -i clinic-backup-key.txt clinic-backup-2026-10-15.tar.gz.age | tar -xzf -
   ```

2. **Create a new Supabase project** in the same region, on Postgres 17. Copy its
   session pooler connection string into `NEW_DB_URL`.

3. **Restore the database.** Run `roles.sql` on its own: a line about
   `log_min_messages` may fail, and that can be ignored. Then load the schema,
   data and storage rules in one transaction, so any other error leaves the
   new database untouched:

   ```sh
   psql "$NEW_DB_URL" -f backup/db/roles.sql
   psql "$NEW_DB_URL" --single-transaction -v ON_ERROR_STOP=1 \
     -f backup/db/schema.sql \
     -c 'SET session_replication_role = replica' \
     -f backup/db/data.sql \
     -f backup/db/storage_policies.sql
   ```

4. **Upload the files** (from `web/`, after `npm ci`), using the new project's URL and service role key:

   ```sh
   SUPABASE_URL=https://<new-ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<new key> \
     node scripts/backup-storage.mjs --restore ../backup/storage
   ```

5. **Bring the rest of the project back.** These aren't in the database dump:
   - Edge function: `npx supabase functions deploy appointment_reminders --project-ref <new-ref>`, plus its secrets.
   - Auth settings: site URL, redirect URLs, SMTP and email templates, MFA (TOTP) on.
   - The reminders schedule (pg_cron + pg_net): set it up again as in
     `supabase/functions/appointment_reminders/README.md`, with the new project URL and key.
   - In Vercel, update `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`, then redeploy.

6. **Mark the migrations as applied** so `db push` keeps working:
   `npx supabase migration repair --status applied 0001 0002 … 00NN`, using every
   number in `supabase/migrations`.

People sign in with their old passwords and 2FA apps, because logins and
factors are restored.

The restore steps above were tested on 2026-10-15 against a fresh local Supabase
stack. Row counts matched for every table checked, the storage rules were
identical, and the files came back byte for byte.
