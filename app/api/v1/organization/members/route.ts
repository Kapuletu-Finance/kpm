import { NextResponse } from 'next/server';
import { desc, eq, getTableColumns } from 'drizzle-orm';
import { db } from '@/lib/db';
import { members, users } from '@/lib/db/schema';
import { requireApiUser } from '@/lib/auth/session';
import { getMember } from '@/lib/db/queries';
import { handleRouteError } from '@/lib/api/http';
import { removeOrganizationMember } from '@/lib/members.server';

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

// DELETE ?id=... : kept for existing clients; same as DELETE /organization/members/{id}.
export async function DELETE(request: Request) {
  try {
    const memberId = new URL(request.url).searchParams.get('id');
    if (!memberId) {
      return NextResponse.json({ error: 'Member ID is required' }, { status: 400 });
    }

    const { user, response } = await requireApiUser();
    if (response) return response;

    return removeOrganizationMember(user.id, memberId);
  } catch (err) {
    return handleRouteError(err, 'Members DELETE exception');
  }
}
