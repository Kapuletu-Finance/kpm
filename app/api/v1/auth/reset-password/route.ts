import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { members, users } from '@/lib/db/schema';
import { hashPassword } from '@/lib/auth/password';
import { consumeToken } from '@/lib/auth/tokens';
import { clientIp, hitRateLimits, tooManyRequests } from '@/lib/auth/rate-limit';
import { getSessionUser } from '@/lib/auth/session';

const resetPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  // From the emailed reset link. Omit to change the signed-in user's password.
  token: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = resetPasswordSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { password, token } = result.data;

    const limit = await hitRateLimits([
      { key: `reset:ip:${clientIp(request.headers)}`, limit: 20, windowSeconds: 15 * 60 },
    ]);
    if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

    let where;
    if (token) {
      const email = await consumeToken('reset', token);
      if (!email) {
        return NextResponse.json({ error: 'Reset link is invalid or has expired' }, { status: 400 });
      }
      where = eq(users.email, email);
    } else {
      const sessionUser = await getSessionUser();
      if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      where = eq(users.id, sessionUser.id);
    }

    const passwordHash = await hashPassword(password);
    const [user] = await db
      .update(users)
      .set({ passwordHash, emailVerified: new Date() })
      .where(where)
      .returning({ id: users.id, email: users.email });

    if (!user) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

    // An invitee who resets instead of accepting is activated the same way.
    await db
      .update(members)
      .set({ status: 'Active' })
      .where(and(eq(members.id, user.id), eq(members.status, 'Invited')));

    return NextResponse.json({ message: 'Password updated successfully', user });
  } catch (err) {
    console.error('Reset password exception:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
