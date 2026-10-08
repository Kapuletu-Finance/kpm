import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { members } from '@/lib/db/schema';
import { requireApiUser } from '@/lib/auth/session';
import { sendInvite } from '@/lib/auth/invite.server';
import { getMember, getMemberWithOrgName } from '@/lib/db/queries';

const resendSchema = z.object({
  memberId: z.string().uuid('Invalid member ID'),
});

export async function POST(request: Request) {
  try {
    const { user, response } = await requireApiUser();
    if (response) return response;

    const callerMember = await getMemberWithOrgName(user.id);
    if (!callerMember) {
      return NextResponse.json({ error: 'Caller organization not found' }, { status: 404 });
    }

    // Only Org Admins can resend invites
    if (callerMember.organization_role !== 'Organization Admin') {
      return NextResponse.json({ error: 'Insufficient permissions to resend invites' }, { status: 403 });
    }

    const result = resendSchema.safeParse(await request.json());
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { memberId } = result.data;

    // Target must belong to the caller's organization and still be pending
    const targetMember = await getMember(memberId);
    if (!targetMember) {
      return NextResponse.json({ error: 'Target member not found' }, { status: 404 });
    }

    if (targetMember.organization_id !== callerMember.organization_id) {
      return NextResponse.json({ error: 'Target member not in your organization' }, { status: 403 });
    }

    if (targetMember.status !== 'Invited') {
      return NextResponse.json({ error: 'Can only resend invitations to pending members' }, { status: 400 });
    }

    await sendInvite(targetMember.email, {
      inviterName: `${callerMember.first_name} ${callerMember.last_name}`.trim(),
      organizationName: callerMember.organization_name || 'your organization',
      organizationRole: (targetMember.organization_role ?? 'Member') as 'Member',
    });

    await db.update(members).set({ invited_at: new Date() }).where(eq(members.id, memberId));

    return NextResponse.json({
      message: 'Invitation resent successfully',
    });
  } catch (err) {
    console.error('Resend Invite exception:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
