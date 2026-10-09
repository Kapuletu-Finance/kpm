import { NextResponse } from 'next/server';
import { AuthError } from 'next-auth';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { signIn } from '@/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = loginSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { email, password } = result.data;

    try {
      // Runs the Credentials provider and sets the session cookie on this response.
      await signIn('credentials', { email, password, redirect: false });
    } catch (error) {
      if (error instanceof AuthError) {
        const code = (error as AuthError & { code?: string }).code;
        if (code === 'rate_limited') {
          return NextResponse.json(
            { error: 'Too many login attempts. Please wait 15 minutes and try again.' },
            { status: 429, headers: { 'Retry-After': '900' } }
          );
        }
        if (code === 'email_not_verified') {
          return NextResponse.json(
            { error: 'Email not confirmed', requireVerification: true },
            { status: 403 }
          );
        }
        return NextResponse.json({ error: 'Invalid login credentials' }, { status: 401 });
      }
      throw error;
    }

    // The new session cookie is on the response, not this request, so read the user directly.
    const [user] = await db
      .select({ id: users.id, email: users.email, name: users.name })
      .from(users)
      .where(eq(users.email, email.trim().toLowerCase()))
      .limit(1);

    return NextResponse.json({ message: 'Login successful', user });
  } catch (err) {
    console.error('Login exception:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
