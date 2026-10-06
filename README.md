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
- **Online booking** — admins opt a clinic in and pick a link
  (`/book/<slug>`); patients pick a doctor and an open slot without an
  account. Bookings land as `scheduled` with an **Online** badge for staff
  to confirm. Rate-limited per IP and per patient; the public page only
  reaches the DB through service-only RPCs.
- **Billing** — Stripe subscription billed per doctor seat. New accounts
  get a 14-day free trial (no card); after that, unpaid accounts are
  **read-only** (enforced in the database). Admins subscribe and manage
  cards/invoices under Admin → Billing; seats follow the doctor count
  with proration.
- **Reminders** — daily Edge Function sends next-day appointment
  reminders by email (Resend) and SMS (Semaphore, PH mobiles), with a
  per-channel delivery log so nothing is sent twice (see
  `supabase/functions/appointment_reminders`).
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
  migrations/            0001–0018: schema, RLS, RPCs, clinical extensions,
                         lab files + storage policy, audit log, grant
                         lockdown, reminder delivery log, online booking, billing
  functions/             Edge Functions (appointment reminders: Resend + Semaphore)
  seed/                  admin/doctor/secretary seeding
  tests/                 SQL tests (RLS isolation, reminders), Supabase stub
                         for plain Postgres, reminders Edge Function e2e
.github/workflows/ci.yml typecheck + build, migrations + SQL tests, types
                         freshness, Edge Function e2e
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
| `STRIPE_SECRET_KEY` | **server-only** — billing (Checkout, Portal, seat sync) |
| `STRIPE_PRICE_ID` | **server-only** — recurring monthly price, billed per doctor |
| `STRIPE_WEBHOOK_SECRET` | **server-only** — verifies `/api/stripe/webhook` |

### Bootstrap the first admin

After signing in once (which creates a `pending` profile), promote yourself in
the Supabase SQL editor:

```sql
select bootstrap_first_admin('you@example.com', 'Your Clinic Group');
```

Approve subsequent users from the admin UI (Pending users), which calls
`admin_assign_user(user_id, role)`.

## Billing setup (Stripe)

1. In Stripe, create a **Product** with a **recurring monthly price**
   (per unit — each doctor is one unit). Copy its `price_…` id to
   `STRIPE_PRICE_ID`.
2. Set `STRIPE_SECRET_KEY` (start with test mode `sk_test_…`).
3. Add a webhook endpoint `https://<domain>/api/stripe/webhook` with events
   `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`.
   Copy its signing secret to `STRIPE_WEBHOOK_SECRET`.
4. Enable the **Customer Portal** (Settings → Billing → Customer portal):
   allow updating payment methods, viewing invoices and cancelling.

Locally: `stripe listen --forward-to localhost:3000/api/stripe/webhook`
prints a `whsec_…` to use as `STRIPE_WEBHOOK_SECRET`.

Existing accounts get a fresh 14-day trial from the moment migration
`0018` is applied.

## Testing

CI (`.github/workflows/ci.yml`) runs on every push to `main` and every PR.
To run the database tests locally against a throwaway Postgres:

```bash
docker run -d --name clinic-testdb -e POSTGRES_PASSWORD=postgres -p 54398:5432 postgres:17
export DATABASE_URL=postgres://postgres:postgres@localhost:54398/postgres
supabase/tests/run.sh        # stub + all migrations + *_test.sql
cd web && npm run gen:types:db   # regenerate lib/database.types.ts from it
```

`supabase/tests/supabase_stub.sql` fakes the bits of Supabase the
migrations rely on (roles, `auth`, `storage`) — never apply it to a real
project. After adding a migration, regenerate types with
`npm run gen:types:db` and commit them; CI fails if they drift.

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
