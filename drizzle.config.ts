import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// Next.js loads .env.local for the app; drizzle-kit runs outside Next, so load it here.
// Real environment variables (CI, the VPS shell) win over file values.
config({ path: '.env.local', quiet: true });
config({ quiet: true });

// Migrations need a session-level connection (drizzle-kit takes an advisory lock
// and runs DDL in one transaction), so prefer the direct Postgres URL over PgBouncer.
//   local: postgres://kpm:kpm@localhost:55432/kpm
//   prod:  ssh -L 15432:127.0.0.1:5432 vps  ->  postgres://kpm:***@localhost:15432/kpm
const url = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
if (!url) throw new Error('Set DATABASE_URL_DIRECT or DATABASE_URL before running drizzle-kit');

export default defineConfig({
  dialect: 'postgresql',
  schema: './lib/db/schema',
  out: './drizzle/migrations',
  dbCredentials: { url },
  migrations: {
    table: '__drizzle_migrations',
    schema: 'drizzle',
  },
  strict: true,
  verbose: true,
});
