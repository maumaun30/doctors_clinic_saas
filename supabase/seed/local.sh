#!/usr/bin/env bash
# Seed the LOCAL Supabase stack (npx supabase start) with demo data.
# See local.sql for the logins it creates. Re-runnable.
#
#   ./supabase/seed/local.sh
#
# Only ever talks to the local database; DB_URL may point elsewhere only
# if it is still a localhost address.
set -euo pipefail

DB_URL="${DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
case "$DB_URL" in
  *@127.0.0.1:*|*@localhost:*) ;;
  *) echo "refusing to seed non-local database: $DB_URL" >&2; exit 1 ;;
esac

psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f "$(dirname "$0")/local.sql"
echo "Seeded. Sign in at http://localhost:3000/login — e.g. admin@local.test / password123"
