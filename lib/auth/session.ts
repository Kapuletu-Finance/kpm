import { NextResponse } from 'next/server';
import { auth } from '@/auth';

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

/** For Route Handlers: the user, or a ready-to-return 401 response. */
export async function requireApiUser(): Promise<
  { user: SessionUser; response?: never } | { user?: never; response: NextResponse }
> {
  const user = await getSessionUser();
  if (!user) return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  return { user };
}
