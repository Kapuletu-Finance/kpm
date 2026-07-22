import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

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

    const { email } = result.data;
    const supabase = await createClient();

    const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`;
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ message: 'Password reset email sent' });
  } catch (err: any) {
    console.error('Forgot password exception:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
