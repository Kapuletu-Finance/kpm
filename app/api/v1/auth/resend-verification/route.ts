import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { issueToken } from '@/lib/auth/tokens';
import { clientIp, hitRateLimits, tooManyRequests } from '@/lib/auth/rate-limit';
import { sendVerificationEmail } from '@/lib/email.server';

const schema = z.object({
  email: z.string().email('Invalid email address'),
});

// POST { email } : re-sends the signup confirmation link to an unverified account.
export async function POST(request: Request) {
  try {
    const result = schema.safeParse(await request.json());
    if (!result.success) {
      return NextResponse.json({ error: 'Invalid payload', details: result.error.flatten() }, { status: 400 });
    }
    const email = result.data.email.trim().toLowerCase();

    const limit = await hitRateLimits([
      { key: `verify-resend:email:${email}`, limit: 3, windowSeconds: 60 * 60 },
      { key: `verify-resend:ip:${clientIp(request.headers)}`, limit: 20, windowSeconds: 60 * 60 },
    ]);
    if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

    const [user] = await db
      .select({ name: users.name, emailVerified: users.emailVerified, passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    // Only self-registered, still-unverified accounts get a link (invitees use their invite).
    // The response is identical either way so it cannot be used to probe for accounts.
    if (user && !user.emailVerified && user.passwordHash) {
      const token = await issueToken('verify', email);
      await sendVerificationEmail({ toEmail: email, fullName: user.name || email, token });
    }

    return NextResponse.json({ message: 'If that account needs verifying, a new link is on its way.' });
  } catch (err) {
    console.error('Resend verification exception:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
