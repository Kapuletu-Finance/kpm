import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { members, users } from '@/lib/db/schema';

export type AccountState = { deactivated: boolean; sessionsValidAfter: Date | null };

/** Deactivation and session-revocation state for a user. One primary-key probe. */
export async function getAccountState(userId: string): Promise<AccountState> {
  const [row] = await db
    .select({ status: members.status, sessionsValidAfter: users.sessionsValidAfter })
    .from(users)
    .leftJoin(members, eq(members.id, users.id))
    .where(eq(users.id, userId))
    .limit(1);
  return { deactivated: row?.status === 'Inactive', sessionsValidAfter: row?.sessionsValidAfter ?? null };
}

/** Whether a session issued at `issuedAt` (epoch seconds) has been revoked. */
export function isSessionRevoked(state: AccountState, issuedAt: number | undefined): boolean {
  if (!state.sessionsValidAfter) return false;
  // Tokens without an issue time predate revocation support; treat them as revoked.
  if (!issuedAt) return true;
  return issuedAt * 1000 < state.sessionsValidAfter.getTime();
}

/**
 * Revokes every existing session for a user. Stored at whole-second precision, matching
 * the token's `iat`, so a session issued right after (e.g. re-signing in) stays valid.
 */
export async function revokeSessions(userId: string) {
  const now = new Date(Math.floor(Date.now() / 1000) * 1000);
  await db.update(users).set({ sessionsValidAfter: now }).where(eq(users.id, userId));
}
