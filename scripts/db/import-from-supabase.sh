#!/usr/bin/env bash
# One-time copy of a Supabase project's data into the self-hosted database.
#
#   SUPABASE_DB_URL='postgres://postgres.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:5432/postgres' \
#   TARGET_DB_URL='postgres://kpm:<pw>@127.0.0.1:5432/kpm' \
#   bash scripts/db/import-from-supabase.sh
#
# Preconditions:
#   - TARGET schema already created:  DATABASE_URL_DIRECT=$TARGET_DB_URL npm run db:migrate
#   - TARGET is empty (the script refuses otherwise)
#   - Use Supabase's direct or session-pooler URL (port 5432), not the transaction pooler (6543)
#   - Docker is available (pg_dump/psql run in a throwaway container)
#
# On Docker Desktop (Windows/macOS) a database on your machine is host.docker.internal, not 127.0.0.1.
#
# What it does:
#   1. auth.users -> users  (same ids, bcrypt hashes, verified flags: everyone keeps their password)
#   2. public.*   -> public.* (data only, all 24 app tables, FK checks deferred during load)
set -euo pipefail

: "${SUPABASE_DB_URL:?Set SUPABASE_DB_URL}"
: "${TARGET_DB_URL:?Set TARGET_DB_URL}"

PG_IMAGE=postgres:17-alpine # pg_dump must be >= the Supabase server version
NET_ARGS=()
[[ "$(uname -s)" == "Linux" ]] && NET_ARGS=(--network host)

pg() { docker run --rm -i "${NET_ARGS[@]}" "$PG_IMAGE" "$@"; }

echo "==> Checking target is migrated and empty"
existing=$(pg psql "$TARGET_DB_URL" -Atc "select (select count(*) from users) + (select count(*) from organizations)")
if [[ "$existing" != "0" ]]; then
  echo "Target already has data ($existing rows in users+organizations). Aborting." >&2
  exit 1
fi

echo "==> Copying auth.users -> users"
pg psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -Atc "\copy (
  select id,
         lower(email),
         coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name'),
         email_confirmed_at,
         nullif(encrypted_password, ''),
         last_sign_in_at,
         coalesce(created_at, now()),
         coalesce(updated_at, now())
  from auth.users
  where email is not null and deleted_at is null
) to stdout with csv" \
| pg psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1 -c "\copy users (id, email, name, email_verified, password_hash, last_sign_in_at, created_at, updated_at) from stdin with csv"

echo "==> Copying public schema data"
# --disable-triggers defers FK checks so tables can load in any order (needs a superuser on the target).
# pg_dump 17 emits `SET transaction_timeout`, which PostgreSQL 16 does not know; drop it.
pg pg_dump "$SUPABASE_DB_URL" \
    --data-only --schema=public --disable-triggers --no-owner --no-privileges \
  | sed '/^SET transaction_timeout/d' \
  | pg psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1 -q

echo "==> Row counts on target"
pg psql "$TARGET_DB_URL" -c "
  select 'users' as table, count(*) from users
  union all select 'organizations', count(*) from organizations
  union all select 'members', count(*) from members
  union all select 'projects', count(*) from projects
  union all select 'features', count(*) from features
  union all select 'activity_logs', count(*) from activity_logs"

echo "Done. Existing users sign in with their current passwords."
