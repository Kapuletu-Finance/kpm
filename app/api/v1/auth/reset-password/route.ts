import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const resetPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
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

    const { password } = result.data;
    const supabase = await createClient();

    // updateUser will update the password of the currently authenticated user
    // (In the invite/recovery flow, clicking the email link authenticates them into a recovery session)
    const { data: updateData, error: updateError } = await supabase.auth.updateUser({
      password: password,
    });

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    // If this was an invite acceptance, we should update their status to 'Active'.
    // Since they are now authenticated, RLS will allow them to update their own member record,
    // assuming RLS policy allows members to update their status.
    // However, it's safer to just let a DB trigger or a service function do this,
    // or we can update it directly here.
    const { error: statusError } = await supabase
      .from('members')
      .update({ status: 'Active' })
      .eq('id', updateData.user.id)
      .eq('status', 'Invited'); // only update if they were in the Invited state

    if (statusError) {
      console.error('Failed to update member status to Active:', statusError);
      // We don't fail the password reset if status update fails, but we log it.
    }

    return NextResponse.json({
      message: 'Password updated successfully',
      user: updateData.user,
    });
  } catch (err: any) {
    console.error('Reset password exception:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
