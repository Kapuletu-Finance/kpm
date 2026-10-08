import { attachDatabasePool } from '@vercel/functions';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, type PoolConfig } from 'pg';
import * as schema from './schema';

export type Database = NodePgDatabase<typeof schema>;

const isProduction = process.env.NODE_ENV === 'production';
const isVercel = Boolean(process.env.VERCEL);

function poolConfig(): PoolConfig {
  const connectionString = process.env.DATABASE_URL;
  // `next build` imports route modules without querying; the pool connects lazily,
  // so only a missing URL at runtime is an error.
  if (!connectionString && process.env.NEXT_PHASE !== 'phase-production-build') {
    throw new Error('DATABASE_URL is not set');
  }

  if (isVercel) {
    // Each function instance gets its own pool, and PgBouncer does the real pooling.
    // Keep the per-instance pool tiny and release idle sockets quickly so instance
    // scale-out never exhausts PgBouncer's max_client_conn.
    return {
      connectionString,
      max: 5,
      idleTimeoutMillis: 5_000,
      connectionTimeoutMillis: 5_000,
      // PgBouncer requires TLS (client_tls_sslmode = require).
      ssl: { rejectUnauthorized: true },
    };
  }

  if (isProduction) {
    // `next start` on a long-lived server (no PgBouncer in front is fine here too).
    return {
      connectionString,
      max: 20,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    };
  }

  // Local Docker Postgres.
  return {
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 2_000,
  };
}

function createDb(): { db: Database; pool: Pool } {
  const pool = new Pool(poolConfig());

  // An idle client erroring (e.g. Postgres restart) must not crash the process.
  pool.on('error', (err) => console.error('[db] idle client error', err));

  // On Vercel Fluid compute, close idle clients before the instance suspends so
  // connections are not leaked to PgBouncer. No-op elsewhere.
  if (isVercel) attachDatabasePool(pool);

  return {
    pool,
    db: drizzle({ client: pool, schema, logger: !isProduction && process.env.DB_LOG === '1' }),
  };
}

// Reuse a single pool across Next.js dev hot reloads instead of leaking one per reload.
const globalForDb = globalThis as unknown as { __kpmDb?: { db: Database; pool: Pool } };
const instance = globalForDb.__kpmDb ?? createDb();
if (!isProduction) globalForDb.__kpmDb = instance;

export const db = instance.db;
export const pool = instance.pool;
export { schema };
