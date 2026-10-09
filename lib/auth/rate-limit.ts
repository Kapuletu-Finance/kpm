import { lt, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { rateLimits } from '@/lib/db/schema';

export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

/**
 * Counts one attempt against `key` in a fixed window and reports whether it is allowed.
 * One atomic upsert, so concurrent requests cannot race past the limit.
 */
export async function hitRateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const windowEnd = sql`now() + make_interval(secs => ${windowSeconds})`;
  const [row] = await db
    .insert(rateLimits)
    .values({ key, count: 1, resetAt: windowEnd })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${rateLimits.resetAt} <= now() then 1 else ${rateLimits.count} + 1 end`,
        resetAt: sql`case when ${rateLimits.resetAt} <= now() then excluded.reset_at else ${rateLimits.resetAt} end`,
      },
    })
    .returning({ count: rateLimits.count, resetAt: rateLimits.resetAt });

  // Occasionally clear expired windows so the table stays small.
  if (Math.random() < 0.01) {
    db.delete(rateLimits).where(lt(rateLimits.resetAt, sql`now() - interval '1 day'`)).catch(() => {});
  }

  return {
    allowed: row.count <= limit,
    retryAfterSeconds: Math.max(1, Math.ceil((row.resetAt.getTime() - Date.now()) / 1000)),
  };
}

/** Checks several limits; all are counted, and the request is allowed only if every one allows it. */
export async function hitRateLimits(
  checks: { key: string; limit: number; windowSeconds: number }[],
): Promise<RateLimitResult> {
  const results = await Promise.all(checks.map((c) => hitRateLimit(c.key, c.limit, c.windowSeconds)));
  const blocked = results.filter((r) => !r.allowed);
  return blocked.length
    ? { allowed: false, retryAfterSeconds: Math.max(...blocked.map((r) => r.retryAfterSeconds)) }
    : { allowed: true, retryAfterSeconds: 0 };
}

/**
 * The client IP. Caddy and Vercel both overwrite X-Forwarded-For with the real client
 * address, so the first entry is trustworthy behind either.
 */
export function clientIp(headers: Headers): string {
  return headers.get('x-forwarded-for')?.split(',')[0]?.trim() || headers.get('x-real-ip') || 'unknown';
}

export function tooManyRequests(retryAfterSeconds: number) {
  return Response.json(
    { error: 'Too many attempts. Please try again later.' },
    { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } },
  );
}
