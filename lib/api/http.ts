import { NextResponse } from 'next/server';

type PgError = { code?: string; message?: string; detail?: string };

function pgErrorOf(err: unknown): PgError | null {
  if (!err || typeof err !== 'object') return null;
  // Drizzle wraps driver errors in DrizzleQueryError with the pg error as `cause`.
  const candidate = ((err as { cause?: unknown }).cause ?? err) as PgError;
  return typeof candidate.code === 'string' && /^[0-9A-Z]{5}$/.test(candidate.code) ? candidate : null;
}

/**
 * Converts an exception from a route handler into a JSON response.
 * Client-caused database errors (bad uuid, constraint violations) become 400s with
 * the database message, as they did under Supabase; everything else is a logged 500.
 */
export function handleRouteError(err: unknown, label: string): NextResponse {
  const pg = pgErrorOf(err);
  // Class 22 = data exception (e.g. invalid uuid), class 23 = integrity constraint violation.
  if (pg && (pg.code!.startsWith('22') || pg.code!.startsWith('23'))) {
    return NextResponse.json({ error: pg.detail || pg.message || 'Invalid request' }, { status: 400 });
  }
  console.error(`${label}:`, err);
  return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
}

export const isUniqueViolation = (err: unknown) => pgErrorOf(err)?.code === '23505';
