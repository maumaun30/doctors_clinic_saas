#!/usr/bin/env bash
# End-to-end test of the appointment_reminders Edge Function against a
# real PostgREST + migrated Postgres, with Resend replaced by a mock.
#
# Needs: deno, psql, openssl on PATH; DATABASE_URL already migrated
# (supabase/tests/run.sh); PostgREST at POSTGREST_URL started with
# PGRST_JWT_SECRET=$JWT_SECRET and its schema cache reloaded.
set -euo pipefail
: "${DATABASE_URL:?}" "${POSTGREST_URL:?}" "${JWT_SECRET:?}"
here="$(cd "$(dirname "$0")" && pwd)"
fn="$here/../../functions/appointment_reminders/index.ts"

b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }
header=$(printf '{"alg":"HS256","typ":"JWT"}' | b64url)
payload=$(printf '{"role":"service_role"}' | b64url)
sig=$(printf '%s.%s' "$header" "$payload" | openssl dgst -sha256 -hmac "$JWT_SECRET" -binary | b64url)
export SUPABASE_SERVICE_ROLE_KEY="$header.$payload.$sig"

psql "$DATABASE_URL" -X -q -v ON_ERROR_STOP=1 -f "$here/seed.sql"

export SUPABASE_URL=http://localhost:9200
export RESEND_API_KEY=re_test RESEND_API_URL=http://localhost:9100
export REMINDER_FROM="Clinic <r@example.com>" POSTGREST_URL
export APP_URL=https://app.example.test
export SEMAPHORE_API_KEY=sem_test SEMAPHORE_API_URL=http://localhost:9101 SEMAPHORE_SENDER_NAME=BAYSIDE

deno run --no-lock -A "$here/mock.ts" & mock=$!
deno run --no-lock -A "$fn" & func=$!
trap 'kill $mock $func 2>/dev/null || true' EXIT

for _ in $(seq 1 60); do
  curl -s -o /dev/null http://localhost:8000 && curl -s -o /dev/null http://localhost:9101/_got && break
  sleep 1
done

deno run --no-lock -A "$here/check.ts"
