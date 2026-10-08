import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// One-off: snapshot the live Supabase schema into TypeScript.
//   npx drizzle-kit pull --config=drizzle.introspect.config.ts
//
// SUPABASE_DB_URL must be the *direct* or *session pooler* (port 5432) string from
// Supabase > Project Settings > Database. The transaction pooler (6543) breaks introspection.
config({ path: '.env.local', quiet: true });

const url = process.env.SUPABASE_DB_URL;
if (!url) throw new Error('Set SUPABASE_DB_URL to introspect Supabase');

export default defineConfig({
  dialect: 'postgresql',
  out: './drizzle/supabase-introspect',
  dbCredentials: { url },
  // Only the app's tables; auth/storage/realtime schemas belong to Supabase and are not migrated.
  schemaFilter: ['public'],
  introspect: { casing: 'preserve' },
});
