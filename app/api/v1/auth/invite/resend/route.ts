import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { z } from 'zod';

const resendSchema = z.object({
  memberId: z.string().uuid('Invalid member ID'),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    // 1. Verify caller is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Fetch the caller's organization context
    const { data: callerMember, error: callerError } = await supabase
      .from('members')
      .select('organization_id, organization_role')
      .eq('id', user.id)
      .single();

    if (callerError || !callerMember) {
      return NextResponse.json({ error: 'Caller organization not found' }, { status: 404 });
    }

    // Ensure caller has permission to invite (Org Admin only)
    if (callerMember.organization_role !== 'Organization Admin') {
      return NextResponse.json({ error: 'Insufficient permissions to resend invites' }, { status: 403 });
    }

    const body = await request.json();
    const result = resendSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { memberId } = result.data;
    const adminSupabase = createAdminClient(); // Bypasses RLS

    // 3. Verify target member belongs to the caller's organization and is in 'Invited' status
    const { data: targetMember, error: targetError } = await adminSupabase
      .from('members')
      .select('email, status, organization_id')
      .eq('id', memberId)
      .single();

    if (targetError || !targetMember) {
      return NextResponse.json({ error: 'Target member not found' }, { status: 404 });
    }

    if (targetMember.organization_id !== callerMember.organization_id) {
      return NextResponse.json({ error: 'Target member not in your organization' }, { status: 403 });
    }

    if (targetMember.status !== 'Invited') {
      return NextResponse.json({ error: 'Can only resend invitations to pending members' }, { status: 400 });
    }

    // 4. Resend the invite via Supabase Admin API
    const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL}/accept-invite`;
    const { error: inviteError } = await adminSupabase.auth.admin.inviteUserByEmail(targetMember.email, {
      redirectTo
    });

    if (inviteError) {
      return NextResponse.json({ error: inviteError.message }, { status: 400 });
    }

    // 5. Update the invited_at timestamp
    const { error: updateError } = await adminSupabase
      .from('members')
      .update({ invited_at: new Date().toISOString() })
      .eq('id', memberId);

    if (updateError) {
      console.error('Failed to update invited_at timestamp:', updateError);
      // We don't fail the request here, as the invite was already sent successfully
    }

    return NextResponse.json({
      message: 'Invitation resent successfully',
    });
  } catch (err: any) {
    console.error('Resend Invite exception:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
