# doctors_clinic_saas

A multi-clinic doctor's-office management platform. Three logged-in roles
(**admin**, **doctor**, **secretary**) manage clinics, staff, appointments,
and patient medical records. Built as a lean MVP, architected to grow into a
subscription SaaS without rewriting auth or tenancy.

**Stack:** Next.js 15 (App Router, TypeScript) · Supabase (Postgres + Auth +
RLS + Edge Functions) · Tailwind CSS v4. Clients talk to Supabase directly,
secured by RLS; privileged work runs in Server Actions with the service-role
key (never shipped to the browser).

## Features

- **Auth** — email/password + Google OAuth, with social accounts linkable to
  an existing email. Password reset flow included. (Apple & Facebook OAuth are
  scaffolded but disabled for now — re-enable in `(auth)/login` and `account`.)
- **Multi-clinic** — a global clinic switcher; doctors practice at multiple
  clinics, each with designated secretaries. Patients are scoped per clinic.
- **Today / Schedule** — appointment queue, booking against real availability
  slots, status flow (scheduled → confirmed → completed / cancelled / no-show).
- **Patients** — roster + detail (demographics, problem list, visits,
  prescriptions, lab orders with file uploads).
- **Reminders** — daily Edge Function emails next-day appointment
  reminders to patients via Resend, with per-appointment delivery log so
  nothing is sent twice (see `supabase/functions/appointment_reminders`).
- **Visits** — doctors complete a visit (vitals, diagnosis, tag-based
  prescriptions / labs / conditions from a reusable library) and print an Rx.
- **Analytics** — filterable summary (status, provider, completion rate,
  patients, care hours) with print-to-paper reports for documentation.
- **Admin** — clinics, doctors, secretaries, clinic assignments, common-use
  library, pending-user approval, and an audit log of all clinical writes.
- **UI** — minimal redesign with a single blue accent, light/dark theme
  (light default), collapsible icon-rail sidebar, and print stylesheets for
  hard copies.

## Repo layout

```
web/                     Next.js app (deploy this on Vercel)
  app/                   App Router pages + route groups (auth) / (app)
  app/_components/       shared UI: icons, theme toggle, app shell, etc.
  lib/                   Supabase clients, queries, Zod schemas, Server Actions
  lib/database.types.ts  generated from the DB schema (source of truth)
supabase/
  migrations/            0001–0015: schema, RLS, RPCs, clinical extensions,
                         lab files + storage policy, audit log, grant
                         lockdown, reminder delivery log
  functions/             Edge Functions (appointment reminders via Resend)
  seed/                  admin/doctor/secretary seeding
  tests/rls_test.sql     tenant/role isolation smoke tests
```

## Local development

```bash
# 1. Database (Supabase CLI)
supabase start
supabase db reset            # applies everything in supabase/migrations/

# 2. Web app
cd web
npm install
cp .env.example .env.local   # fill in the values below
npm run gen:types:local      # regenerate lib/database.types.ts from local DB
npm run dev                  # http://localhost:3000
```

### Environment variables (`web/.env.local`)

| Var | Where it's used |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser + server (RLS gates everything) |
| `SUPABASE_SERVICE_ROLE_KEY` | **server-only** — never exposed to the client |
| `SUPABASE_PROJECT_ID` | `npm run gen:types` against the hosted project |

### Bootstrap the first admin

After signing in once (which creates a `pending` profile), promote yourself in
the Supabase SQL editor:

```sql
select bootstrap_first_admin('you@example.com', 'Your Clinic Group');
```

Approve subsequent users from the admin UI (Pending users), which calls
`admin_assign_user(user_id, role)`.

## Deploy (Vercel)

The deployable app is the **`web/`** subdirectory.

1. Import this repo at [vercel.com/new](https://vercel.com/new).
2. **Set Root Directory to `web`** (Framework preset auto-detects Next.js).
3. Add the four env vars above in Project → Settings → Environment Variables.
4. In **Supabase → Auth → URL Configuration**, add your Vercel domain to
   Site URL / Redirect URLs, including `https://<domain>/auth/callback` —
   otherwise OAuth and password-reset links fail in production.

Every push to `main` then auto-deploys.

## Trust boundary

- `anon` / `authenticated` keys are safe in the browser — **RLS is the only
  thing standing between a tab and the data.**
- The `service_role` key is server-only (Server Actions / Edge Functions) and
  is never bundled into client code. Lab-file storage is locked down with a
  restrictive Storage policy so the bucket can't be hit with an anon key.

## Future-proofing (seams left open, not built)

- `accounts` table is in place — billing/subscriptions attach here later.
- All business tables are scoped by `account_id`, so multi-tenant isolation
  holds without policy rewrites.
- Data access lives in `web/lib/` so a future Expo app can reuse the queries,
  Zod schemas, and generated types.
