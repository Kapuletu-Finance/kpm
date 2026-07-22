import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

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
    const supabase = await createClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      if (error.message.includes('Email not confirmed')) {
        return NextResponse.json(
          { error: 'Email not confirmed', requireVerification: true },
          { status: 403 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json({
      message: 'Login successful',
      user: data.user,
      session: data.session,
    });
  } catch (err: any) {
    console.error('Login exception:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
