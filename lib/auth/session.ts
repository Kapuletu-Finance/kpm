import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getAccountState, isSessionRevoked } from '@/lib/auth/status';

export type SessionUser = { id: string; email?: string | null; name?: string | null };

export class UnauthorizedError extends Error {
  constructor() {
    super('Unauthorized');
  }
}

/** The signed-in user, or null. Reads the JWT cookie only; no database query. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  return session?.user?.id ? session.user : null;
}

/** For Server Actions and server code: throws when no one is signed in. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

/**
 * The signed-in user after checking the account is still allowed in, or why not.
 * JWT sessions cannot be revoked on their own, so deactivation and "sign out everywhere"
 * (password change) are enforced here with one database probe.
 */
export async function getVerifiedSession(): Promise<
  { user: SessionUser; reason?: never } | { user?: never; reason: 'signed_out' | 'revoked' | 'deactivated' }
> {
  const session = await auth();
  const user = session?.user?.id ? session.user : null;
  if (!user) return { reason: 'signed_out' };

  const state = await getAccountState(user.id);
  if (state.deactivated) return { reason: 'deactivated' };
  if (isSessionRevoked(state, session?.issuedAt)) return { reason: 'revoked' };
  return { user };
}

/** For Route Handlers: the user, or a ready-to-return 401/403 response. */
export async function requireApiUser(): Promise<
  { user: SessionUser; response?: never } | { user?: never; response: NextResponse }
> {
  const result = await getVerifiedSession();
  if (result.user) return { user: result.user };
  if (result.reason === 'deactivated') {
    return { response: NextResponse.json({ error: 'Your account has been deactivated' }, { status: 403 }) };
  }
  const error = result.reason === 'revoked' ? 'Your session has ended. Please sign in again.' : 'Unauthorized';
  return { response: NextResponse.json({ error }, { status: 401 }) };
}
