#!/usr/bin/env bash
# Apply the Supabase stub + every migration to a plain Postgres, then run
# each *_test.sql. Any failed statement or ASSERT aborts with non-zero exit.
#
#   DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres supabase/tests/run.sh
#
# Point it at a throwaway database only — it creates roles and schemas.
set -euo pipefail

: "${DATABASE_URL:?set DATABASE_URL to a throwaway Postgres}"
here="$(cd "$(dirname "$0")" && pwd)"
psql_() { psql "$DATABASE_URL" -X -q -v ON_ERROR_STOP=1 "$@"; }

echo "==> stub"
PGOPTIONS='-c client_min_messages=warning' psql_ -f "$here/supabase_stub.sql" >/dev/null

for f in "$here"/../migrations/*.sql; do
  echo "==> migrate $(basename "$f")"
  PGOPTIONS='-c client_min_messages=warning' psql_ -f "$f" >/dev/null
done

for f in "$here"/*_test.sql; do
  echo "==> test $(basename "$f")"
  if ! out="$(psql_ -f "$f" 2>&1)"; then
    echo "$out" | grep -E "ok:|ASSERT|ERROR" || echo "$out" | tail -5
    echo "FAILED: $(basename "$f")"
    exit 1
  fi
  echo "$out" | grep -E "ok:" | sed 's/^.*NOTICE: */   /'
done

echo "==> all SQL tests passed"
