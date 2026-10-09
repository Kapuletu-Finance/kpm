import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { members, organizations } from '@/lib/db/schema';
import { getVerifiedSession } from '@/lib/auth/session';
import { handleRouteError } from '@/lib/api/http';

// The signed-in user and their member profile (with organization), for AuthContext.
export async function GET() {
  try {
    // A revoked or deactivated session reads as signed out, so the client sends the user to log in
    const { user, reason } = await getVerifiedSession();
    if (!user) return NextResponse.json({ user: null, memberProfile: null, reason }, { status: 401 });

    const [row] = await db
      .select({ member: members, organization: organizations })
      .from(members)
      .leftJoin(organizations, eq(organizations.id, members.organization_id))
      .where(eq(members.id, user.id))
      .limit(1);

    return NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name },
      memberProfile: row ? { ...row.member, organization: row.organization } : null,
    });
  } catch (err) {
    return handleRouteError(err, 'Get current user error');
  }
}
