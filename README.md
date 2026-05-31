# doctors_clinic_saas

Multi-clinic doctor's-office management platform. Supabase + Next.js (web first, Expo later).

## Status

**Phase 0 — schema only.** Migrations, RLS policies, and RLS test script are in place. The Next.js app has not been scaffolded yet, pending review of the SQL.

## Layout

```
supabase/
  migrations/
    0001_schema.sql   -- tables, enums, indexes, auth.users trigger
    0002_rls.sql      -- RLS helpers + per-table policies
    0003_rpcs.sql     -- admin_assign_user, book_appointment,
                          complete_appointment, bootstrap_first_admin
  tests/
    rls_test.sql      -- tenant/role isolation smoke tests (runs in a tx,
                          ROLLBACK at end)
```

## Local setup

1. Install Supabase CLI, then in this repo:
   ```
   supabase init        # only if not already initialized
   supabase start
   supabase db reset    # applies everything in migrations/
   ```
2. Run the RLS test script:
   ```
   psql "$(supabase status -o env | grep DB_URL | cut -d= -f2)" \
        -f supabase/tests/rls_test.sql
   ```
   All `ok: …` notices should print and no `ASSERT FAILED` should appear.

## OAuth providers (configure in Supabase Dashboard → Authentication → Providers)

- **Google** — create an OAuth client in Google Cloud Console; add the
  Supabase callback URL listed in the dashboard.
- **Apple** — requires a **paid Apple Developer account** ($99/yr). Apple
  Sign In is **required by the App Store** any time you ship other social
  logins, so plan for this before mobile launch.
- **Facebook** — create a Meta app, enable Facebook Login, add the
  Supabase callback URL.

No email/password login in the MVP.

## Seeding the first admin

A first OAuth sign-in creates a `profiles` row with `role='pending'`. To
bootstrap yourself as the first admin, after you've signed in once:

```sql
-- run in the Supabase SQL editor (service_role context)
select bootstrap_first_admin('you@example.com', 'Your Clinic Group');
```

This creates an `accounts` row if needed and promotes you to admin.
Subsequent users you approve via the (forthcoming) admin UI, which calls
`admin_assign_user(user_id, role)`.

## Type generation

Once a Next.js app is scaffolded:

```
supabase gen types typescript --local > web/lib/database.types.ts
```

Wire this into the build so the DB schema stays the single source of
truth — no hand-written or camelCase-remapped row types.

## Trust boundary

- `anon` / `authenticated` keys → safe in the browser. RLS is the only
  thing standing between a tab and the data.
- `service_role` key → server-only (Next.js Route Handlers / Server
  Actions / Edge Functions). Never bundled into client code.

## Future-proofing seams (not built)

- `accounts` table is in place — billing/subscriptions attach here later.
- All business tables are scoped by `account_id` so multi-tenant
  isolation works without policy rewrites.
- Data access lives in `lib/` (to be added) so Expo can reuse it.
- Reminders → Supabase Edge Functions + `pg_cron`.
