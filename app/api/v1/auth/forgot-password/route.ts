import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { issueToken } from '@/lib/auth/tokens';
import { sendPasswordResetEmail } from '@/lib/email.server';

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = forgotPasswordSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: result.error.flatten() },
        { status: 400 }
      );
    }

    const email = result.data.email.trim().toLowerCase();
    const [user] = await db
      .select({ id: users.id, passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    // Only accounts with a password can reset it (invitees use their invite link).
    // The response is identical either way so it cannot be used to probe for accounts.
    if (user?.passwordHash) {
      const token = await issueToken('reset', email);
      await sendPasswordResetEmail({ toEmail: email, token });
    }

    return NextResponse.json({ message: 'Password reset email sent' });
  } catch (err) {
    console.error('Forgot password exception:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
