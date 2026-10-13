# Browser end-to-end tests

Playwright tests that drive the real app against the local Supabase stack:
sign-in errors, a secretary adding a patient and booking, a doctor
completing a visit, online booking, and an admin setting up 2FA and
using admin pages (including the data export).

They use their own fixture, `supabase/seed/e2e.sql` (account "E2E Health",
`*@e2e.test` logins), which is reloaded before every run. Your demo logins
from `local.sql` and their authenticators are never touched.

## Run locally

1. `npx supabase start` (Docker running).
2. Build and start the app against the local stack, on port 3000, with
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and
   `SUPABASE_SERVICE_ROLE_KEY` from `npx supabase status -o env`.
   Never point it at the hosted project.
3. From `web/`: `npx playwright install chromium` (once), then `npx playwright test`.

If nothing is listening on port 3000, Playwright runs `npm run start` itself
(the app must already be built with the local keys). Other settings:
`E2E_BASE_URL` (default `http://localhost:3000`) and `E2E_DB_URL` (default
the local database on port 54322; the setup refuses non-local databases).

CI runs the same tests in the "Browser e2e" job.
