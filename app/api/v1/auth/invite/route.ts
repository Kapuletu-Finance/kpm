import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { z } from 'zod';

const inviteSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['Project Manager', 'Member']),
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
      .select('organization_id, organization_role, first_name, last_name, organizations(name)')
      .eq('id', user.id)
      .single();

    if (callerError || !callerMember) {
      return NextResponse.json({ error: 'Caller organization not found' }, { status: 404 });
    }

    // Ensure caller has permission to invite (Org Admin only)
    if (callerMember.organization_role !== 'Organization Admin') {
      return NextResponse.json({ error: 'Insufficient permissions to invite members' }, { status: 403 });
    }

    const body = await request.json();
    const result = inviteSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { email, role } = result.data;
    const adminSupabase = createAdminClient(); // Bypasses RLS

    // 3. Invite the user via Supabase Admin API
    // Note: redirectTo can be configured in Supabase dashboard or passed here.
    const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL}/accept-invite`;
    
    // We pass custom data to the invite email template so we can personalize the email.
    // In Supabase email templates, this can be accessed via {{ .Data.organization_name }}
    const inviteOptions = {
      redirectTo,
      data: {
        invited_role: role,
        inviter_name: `${callerMember.first_name} ${callerMember.last_name}`.trim(),
        organization_name: (Array.isArray(callerMember.organizations) ? callerMember.organizations[0]?.name : (callerMember.organizations as any)?.name) || 'your organization',
      }
    };
    
    console.log('Sending invite with options:', JSON.stringify(inviteOptions, null, 2));

    const { data: inviteData, error: inviteError } = await adminSupabase.auth.admin.inviteUserByEmail(email, inviteOptions);

    if (inviteError) {
      return NextResponse.json({ error: inviteError.message }, { status: 400 });
    }

    const invitedUser = inviteData.user;
    if (!invitedUser) {
      return NextResponse.json({ error: 'Failed to generate invite' }, { status: 500 });
    }

    // 4. Create the member record in the 'Invited' state
    const { error: memberError } = await adminSupabase
      .from('members')
      .insert({
        id: invitedUser.id,
        organization_id: callerMember.organization_id,
        first_name: 'Pending',
        last_name: 'User',
        email: email,
        organization_role: role,
        status: 'Invited',
        invited_at: new Date().toISOString(),
      });

    if (memberError) {
      console.error('Member insert error:', memberError);
      return NextResponse.json({ error: 'Failed to create member record' }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Invitation sent successfully',
      user: invitedUser,
    });
  } catch (err: any) {
    console.error('Invite exception:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
