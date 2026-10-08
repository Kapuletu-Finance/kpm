// One-off: turns raw `drizzle-kit pull` output from Supabase into drizzle/supabase-introspect/app.cleaned.ts.
// lib/db/schema/app.ts is now hand-maintained; rerun this only to diff against a live Supabase.
//   npm run db:introspect && node scripts/db/clean-introspect.mjs
//
// - drops pgPolicy(...) entries (they target Supabase's `authenticated` role, which
//   does not exist on plain Postgres; authorization now lives in the API layer)
// - uuid_generate_v4() -> gen_random_uuid() (built in, no uuid-ossp extension)
// - timestamp mode 'string' -> 'date' (Date objects; JSON responses stay ISO strings)
// - updated_at gets $onUpdate, replacing the Supabase updated_at triggers
// - points the old auth.users references at the Auth.js `users` table
import { readFileSync, writeFileSync } from 'node:fs';

const SRC = 'drizzle/supabase-introspect';
const OUT = SRC; // outside lib/db/schema so drizzle-kit never picks it up

let schema = readFileSync(`${SRC}/schema.ts`, 'utf8');
schema = schema
  .replace(/^\s*pgPolicy\(.*\),?\r?\n/gm, '')
  .replace(/\bpgPolicy,\s*/, '')
  .replace(/\.default\(sql`uuid_generate_v4\(\)`\)/g, '.defaultRandom()')
  .replace(/(timestamp\([^)]*?)mode: 'string'/g, "$1mode: 'date'")
  .replace(
    /(updated_at: timestamp\([^)]*\)\.defaultNow\(\))/g,
    '$1.$onUpdate(() => new Date())',
  )
  .replace(/^(import \{ sql \} from "drizzle-orm"\r?\n)/m, "$1import { users } from './auth';\n");
if (!schema.includes("from './auth'")) schema = `import { users } from './auth';\n${schema}`;
writeFileSync(`${OUT}/app.cleaned.ts`, schema);


console.log(`Wrote ${OUT}/app.cleaned.ts — diff it against lib/db/schema/app.ts, then delete it.`);
