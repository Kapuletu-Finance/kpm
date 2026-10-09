# KPM infrastructure runbook

KPM runs on PostgreSQL 16 with Drizzle ORM and Auth.js (credentials + JWT sessions).
Files are stored in Cloudinary; Postgres stores only their URLs.

| File | Purpose |
|---|---|
| `docker-compose.dev.yml` | Local Postgres on `localhost:55432` |
| `docker-compose.prod.yml` | VPS stack: Postgres, plus PgBouncer (`vercel` profile) or app + Caddy (`app` profile) |
| `drizzle.config.ts` | Schema in `lib/db/schema`, migrations in `drizzle/migrations` |
| `Dockerfile` | `runner` (standalone app) and `migrate` (applies migrations) targets |
| `scripts/db/seed.ts` | Demo org + users for local development |
| `scripts/db/import-from-supabase.sh` | One-time data copy from Supabase |

## Local development

```bash
cp .env.example .env.local      # then set AUTH_SECRET (openssl rand -base64 32)
npm install
npm run db:setup                # start Postgres, apply migrations, seed demo data
npm run dev
```

Sign in at http://localhost:3000/login as `admin@kpm.local`, `pm@kpm.local` or `dev@kpm.local`
(password `Password123!`). With Postmark unset, verification, invite and reset links are printed
in the `npm run dev` console.

| Command | Does |
|---|---|
| `npm run db:up` / `db:down` | Start / stop local Postgres (data persists in a Docker volume) |
| `npm run db:generate -- --name <change>` | Create a migration after editing `lib/db/schema` |
| `npm run db:migrate` | Apply pending migrations to `DATABASE_URL_DIRECT` |
| `npm run db:studio` | Browse the database in Drizzle Studio |
| `npm run db:seed` | Seed demo data (local databases only) |

Schema changes: edit `lib/db/schema/*.ts`, run `db:generate`, review the SQL in
`drizzle/migrations`, commit both. Never edit an applied migration.

## Production on a VPS

Requirements: Docker with Compose v2, a domain pointing at the server, ports 80/443 open
(and 6432 if Vercel connects to the database).

```bash
git clone <repo> kpm && cd kpm
cp infra/.env.prod.example infra/.env.prod   # fill in every value; chmod 600 infra/.env.prod
ENV="--env-file infra/.env.prod"
```

### Option A: whole app on the VPS (recommended for a single server)

```bash
docker compose -f docker-compose.prod.yml $ENV up -d --wait postgres
docker compose -f docker-compose.prod.yml $ENV --profile tools run --rm --build migrate
docker compose -f docker-compose.prod.yml $ENV --profile app up -d --build
```

Caddy obtains the TLS certificate for `APP_DOMAIN` automatically. The app talks to Postgres
directly over the private Docker network with a pool of 20; PgBouncer is not needed.

Deploying a new version:

```bash
git pull
docker compose -f docker-compose.prod.yml $ENV --profile tools run --rm --build migrate
docker compose -f docker-compose.prod.yml $ENV --profile app up -d --build app
```

### Option B: frontend on Vercel, database on the VPS

```bash
docker compose -f docker-compose.prod.yml $ENV up -d --wait postgres
# PgBouncer auth: copy the SCRAM verifier (not the password) into userlist.txt
cp infra/pgbouncer/userlist.txt.example infra/pgbouncer/userlist.txt
docker compose -f docker-compose.prod.yml $ENV exec postgres \
  psql -U kpm -d kpm -Atc "SELECT rolpassword FROM pg_authid WHERE rolname = 'kpm'"
# TLS for PgBouncer (Vercel connects over the internet), e.g. with certbot for db.example.com:
mkdir -p infra/pgbouncer/tls
cp /etc/letsencrypt/live/db.example.com/fullchain.pem infra/pgbouncer/tls/server.crt
cp /etc/letsencrypt/live/db.example.com/privkey.pem   infra/pgbouncer/tls/server.key
docker compose -f docker-compose.prod.yml $ENV --profile vercel up -d
```

Vercel environment variables: `DATABASE_URL=postgres://kpm:<pw>@db.example.com:6432/kpm`,
`AUTH_SECRET`, `NEXT_PUBLIC_APP_URL`, Cloudinary and Postmark keys.
Run migrations from your machine through an SSH tunnel:

```bash
ssh -N -L 15432:127.0.0.1:5432 user@vps &
DATABASE_URL_DIRECT=postgres://kpm:<pw>@localhost:15432/kpm npm run db:migrate
```

Firewall: allow 6432 only if Vercel needs it (Vercel has no fixed IPs, so TLS plus a strong
password is the protection). Never open 5432.

## Moving data off Supabase (once)

1. Check the live Supabase schema matches `lib/db/schema/app.ts` (it was generated from
   `supabase/migrations`; changes made in the Supabase dashboard would not be in it):
   ```bash
   npm run db:introspect && node scripts/db/clean-introspect.mjs
   # diff drizzle/supabase-introspect/app.cleaned.ts against lib/db/schema/app.ts
   ```
2. Create the empty schema on the target (`migrate` step above).
3. Copy the data:
   ```bash
   SUPABASE_DB_URL='postgres://postgres.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:5432/postgres' \
   TARGET_DB_URL='postgres://kpm:<pw>@127.0.0.1:5432/kpm' \
   bash scripts/db/import-from-supabase.sh
   ```
   User ids and bcrypt password hashes carry over, so everyone signs in with their existing
   password. Members still in `Invited` status need a fresh invite (Organization > Members >
   Resend), because Supabase invite links stop working.
4. Point the app at the new database and stop writes to Supabase.

## Authentication and security

- Sessions are encrypted JWT cookies (`__Secure-authjs.session-token` over HTTPS: Secure,
  HttpOnly, SameSite=Lax), valid 30 days from sign-in. Signing out deletes the cookie.
  Rotating `AUTH_SECRET` signs everyone out.
- A JWT stays valid until it expires, so removing a member or resetting a password does not end
  sessions that are already open. The API still denies a removed member, because every route
  checks membership.
- Brute-force limits (Postgres-backed, shared by all instances), table `rate_limits`:

  | Action | Limit |
  |---|---|
  | Sign-in | 10 failures per email and 50 per IP per 15 minutes |
  | Forgot password | 3 per email and 20 per IP per hour |
  | Sign-up | 10 per IP per hour |
  | Accept invite / reset password | 20 per IP per 15 minutes |

- Email links (verify 24h, invite 7d, reset 1h) are single-use; only their SHA-256 is stored.
- Caddy adds HSTS, `X-Frame-Options: DENY`, `nosniff` and a strict referrer policy.
- `AUTH_URL` must be the public `https://` origin when the app runs behind Caddy (compose sets it
  from `APP_DOMAIN`). Vercel detects it automatically.

## Backups

```bash
# nightly, e.g. from cron on the VPS
docker compose -f docker-compose.prod.yml --env-file infra/.env.prod exec -T postgres \
  pg_dump -U kpm -d kpm -Fc > /var/backups/kpm/kpm-$(date +%F).dump
# restore
docker compose -f docker-compose.prod.yml --env-file infra/.env.prod exec -T postgres \
  pg_restore -U kpm -d kpm --clean --if-exists < /var/backups/kpm/kpm-YYYY-MM-DD.dump
```

Copy dumps off the server (object storage or another host); a backup on the same disk is not a backup.
