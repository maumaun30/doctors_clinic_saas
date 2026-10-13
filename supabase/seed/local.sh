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

here="$(cd "$(dirname "$0")" && pwd)"
psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f "$here/local.sql"

# Profile pictures (illustrations in avatars/) for one doctor and one
# secretary; the others keep initials. Uploaded through the local Storage
# API, so it needs the local API URL + service_role key from `supabase status`.
API_URL="${API_URL:-http://127.0.0.1:54321}"
case "$API_URL" in
  http://127.0.0.1:*|http://localhost:*) ;;
  *) echo "refusing to upload to non-local API: $API_URL" >&2; exit 1 ;;
esac
if [ -z "${SERVICE_ROLE_KEY:-}" ]; then
  SERVICE_ROLE_KEY="$(cd "$here/../.." && web/node_modules/.bin/supabase status -o env 2>/dev/null \
    | sed -n 's/^SERVICE_ROLE_KEY="\(.*\)"$/\1/p')"
fi
if [ -z "$SERVICE_ROLE_KEY" ]; then
  echo "skipping profile pictures: no SERVICE_ROLE_KEY (is the local stack running?)" >&2
else
  seed_avatar() { # <profile id> <png>
    local obj="$1/seed.png"
    curl -sf -X POST "$API_URL/storage/v1/object/avatars/$obj" \
      -H "Authorization: Bearer $SERVICE_ROLE_KEY" -H "apikey: $SERVICE_ROLE_KEY" \
      -H "Content-Type: image/png" -H "x-upsert: true" --data-binary "@$here/avatars/$2" >/dev/null
    psql "$DB_URL" -v ON_ERROR_STOP=1 -q -c "update profiles set avatar_path = '$obj' where id = '$1'"
  }
  seed_avatar 5eed0000-0000-0000-0000-0000000000d1 doctor.png     # Dr. Ana Reyes
  seed_avatar 5eed0000-0000-0000-0000-0000000000e1 secretary.png  # Sec. Cruz
fi

echo "Seeded. Sign in at http://localhost:3000/login — e.g. admin@local.test / password123"
