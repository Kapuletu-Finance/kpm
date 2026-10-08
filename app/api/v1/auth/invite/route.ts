import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiUser } from '@/lib/auth/session';
import { InviteError, inviteMember } from '@/lib/auth/invite.server';
import { getMemberWithOrgName } from '@/lib/db/queries';

const inviteSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['Project Manager', 'Member']),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
});

export async function POST(request: Request) {
  try {
    const { user, response } = await requireApiUser();
    if (response) return response;

    const callerMember = await getMemberWithOrgName(user.id);
    if (!callerMember || !callerMember.organization_id) {
      return NextResponse.json({ error: 'Caller organization not found' }, { status: 404 });
    }

    // Only Org Admins can invite
    if (callerMember.organization_role !== 'Organization Admin') {
      return NextResponse.json({ error: 'Insufficient permissions to invite members' }, { status: 403 });
    }

    const result = inviteSchema.safeParse(await request.json());
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { email, role, firstName, lastName } = result.data;

    const invitedUser = await inviteMember({
      email,
      organizationId: callerMember.organization_id,
      firstName,
      lastName,
      organizationRole: role,
      inviterName: `${callerMember.first_name} ${callerMember.last_name}`.trim(),
      organizationName: callerMember.organization_name || 'your organization',
    });

    return NextResponse.json({
      message: 'Invitation sent successfully',
      user: invitedUser,
    });
  } catch (err) {
    if (err instanceof InviteError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('Invite exception:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
