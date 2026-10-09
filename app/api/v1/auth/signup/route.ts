import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { members, organizations, users } from '@/lib/db/schema';
import { hashPassword } from '@/lib/auth/password';
import { issueToken } from '@/lib/auth/tokens';
import { clientIp, hitRateLimits, tooManyRequests } from '@/lib/auth/rate-limit';
import { sendVerificationEmail } from '@/lib/email.server';

const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(2, 'Full name is required'),
  organizationName: z.string().min(2, 'Organization name is required'),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = signupSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { password, fullName, organizationName } = result.data;
    const email = result.data.email.trim().toLowerCase();

    const limit = await hitRateLimits([
      { key: `signup:ip:${clientIp(request.headers)}`, limit: 10, windowSeconds: 60 * 60 },
    ]);
    if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing) {
      return NextResponse.json({ error: 'User already registered' }, { status: 400 });
    }

    const slug =
      organizationName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '') +
      '-' +
      Math.random().toString(36).substring(2, 6);

    const nameParts = fullName.trim().split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || ' ';
    const passwordHash = await hashPassword(password);

    // User, organization and admin membership are created atomically.
    const { user, organizationId } = await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({ email, name: fullName.trim(), passwordHash })
        .returning({ id: users.id, email: users.email });

      const [org] = await tx
        .insert(organizations)
        .values({ name: organizationName, slug })
        .returning({ id: organizations.id });

      await tx.insert(members).values({
        id: user.id,
        organization_id: org.id,
        first_name: firstName,
        last_name: lastName,
        email,
        organization_role: 'Organization Admin',
        status: 'Active',
      });

      return { user, organizationId: org.id };
    });

    const token = await issueToken('verify', email);
    await sendVerificationEmail({ toEmail: email, fullName: fullName.trim(), token });

    return NextResponse.json({
      message: 'Signup successful',
      user,
      organizationId,
      session: null,
    });
  } catch (err) {
    console.error('Signup exception:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
