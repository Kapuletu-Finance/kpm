import { NextResponse } from 'next/server';
import { desc, eq, getTableColumns } from 'drizzle-orm';
import { db } from '@/lib/db';
import { members, users } from '@/lib/db/schema';
import { requireApiUser } from '@/lib/auth/session';
import { getMember } from '@/lib/db/queries';
import { handleRouteError } from '@/lib/api/http';

export async function GET() {
  try {
    const { user, response } = await requireApiUser();
    if (response) return response;

    const member = await getMember(user.id);
    if (!member || !member.organization_id) {
      return NextResponse.json({ error: 'Member profile not found' }, { status: 404 });
    }

    // Members plus their last sign-in time
    const orgMembers = await db
      .select({ ...getTableColumns(members), last_sign_in_at: users.lastSignInAt })
      .from(members)
      .leftJoin(users, eq(users.id, members.id))
      .where(eq(members.organization_id, member.organization_id))
      .orderBy(desc(members.created_at));

    return NextResponse.json(orgMembers);
  } catch (err) {
    return handleRouteError(err, 'Members GET exception');
  }
}

export async function DELETE(request: Request) {
  try {
    const memberId = new URL(request.url).searchParams.get('id');
    if (!memberId) {
      return NextResponse.json({ error: 'Member ID is required' }, { status: 400 });
    }

    const { user, response } = await requireApiUser();
    if (response) return response;

    const caller = await getMember(user.id);
    if (!caller || caller.organization_role !== 'Organization Admin') {
      return NextResponse.json({ error: 'Forbidden. Only Organization Admins can remove members.' }, { status: 403 });
    }

    const targetMember = await getMember(memberId);
    if (!targetMember || targetMember.organization_id !== caller.organization_id) {
      return NextResponse.json({ error: 'Member not found in your organization' }, { status: 404 });
    }

    if (memberId === user.id) {
      return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 400 });
    }

    // Deleting the login account cascades to the member row and their memberships,
    // fully revoking access.
    await db.delete(users).where(eq(users.id, memberId));

    return NextResponse.json({ message: 'Member removed successfully' });
  } catch (err) {
    return handleRouteError(err, 'Members DELETE exception');
  }
}
