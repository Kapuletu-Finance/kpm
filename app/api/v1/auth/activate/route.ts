import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { members, users } from '@/lib/db/schema';
import { signIn } from '@/auth';
import { hashPassword } from '@/lib/auth/password';
import { consumeToken, peekToken } from '@/lib/auth/tokens';

const activateSchema = z.object({
  token: z.string().min(1, 'Invitation token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

// GET ?token=... : lets the accept-invite page show who the invite is for.
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token') ?? '';
  const email = await peekToken('invite', token);
  if (!email) return NextResponse.json({ error: 'Invitation link is invalid or has expired' }, { status: 400 });
  return NextResponse.json({ email });
}

// POST { token, password } : accepts an invitation, sets the password, activates
// the member and signs them in.
export async function POST(request: Request) {
  try {
    const result = activateSchema.safeParse(await request.json());
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { token, password } = result.data;
    const email = await consumeToken('invite', token);
    if (!email) {
      return NextResponse.json({ error: 'Invitation link is invalid or has expired' }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);
    const activated = await db.transaction(async (tx) => {
      const [user] = await tx
        .update(users)
        // Following the emailed link proves ownership of the address.
        .set({ passwordHash, emailVerified: new Date() })
        .where(eq(users.email, email))
        .returning({ id: users.id });
      if (!user) return false;

      await tx
        .update(members)
        .set({ status: 'Active' })
        .where(and(eq(members.id, user.id), eq(members.status, 'Invited')));
      return true;
    });

    if (!activated) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    await signIn('credentials', { email, password, redirect: false });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Activation error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
