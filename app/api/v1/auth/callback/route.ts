import { NextResponse } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { consumeToken } from '@/lib/auth/tokens';
import { appUrl } from '@/lib/email.server';

// Target of the "confirm your email" link sent at signup.
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token') ?? '';
  const base = appUrl();

  try {
    const email = await consumeToken('verify', token);
    if (email) {
      await db
        .update(users)
        .set({ emailVerified: new Date() })
        .where(and(eq(users.email, email), isNull(users.emailVerified)));
      return NextResponse.redirect(`${base}/login?verified=1`);
    }
  } catch (err) {
    console.error('Email verification error:', err);
  }

  return NextResponse.redirect(`${base}/login?error=Invalid+or+expired+verification+link`);
}
