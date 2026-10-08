import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { members, organizations } from '@/lib/db/schema';
import { getSessionUser } from '@/lib/auth/session';
import { handleRouteError } from '@/lib/api/http';

// The signed-in user and their member profile (with organization), for AuthContext.
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ user: null, memberProfile: null }, { status: 401 });

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
