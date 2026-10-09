import { NextRequest, NextResponse } from 'next/server';
import { and, count, desc, eq, getTableColumns } from 'drizzle-orm';
import { db } from '@/lib/db';
import { activity_logs, members, projects } from '@/lib/db/schema';
import { requireApiUser } from '@/lib/auth/session';
import { getMember } from '@/lib/db/queries';
import { handleRouteError } from '@/lib/api/http';

// GET ?limit&offset&memberId : the organization's audit trail, newest first.
export async function GET(req: NextRequest) {
  try {
    const { user, response } = await requireApiUser();
    if (response) return response;

    const member = await getMember(user.id);
    if (!member || member.organization_role !== 'Organization Admin' || !member.organization_id) {
      return NextResponse.json({ error: 'Not authorized for organization logs' }, { status: 403 });
    }

    const url = new URL(req.url);
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50') || 50, 1), 200);
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0') || 0, 0);
    const memberId = url.searchParams.get('memberId');

    // Includes organization-level events that have no project
    const where = and(
      eq(activity_logs.organization_id, member.organization_id),
      memberId ? eq(activity_logs.member_id, memberId) : undefined,
    );

    const [logs, [{ total }]] = await Promise.all([
      db
        .select({
          ...getTableColumns(activity_logs),
          member: {
            id: members.id,
            first_name: members.first_name,
            last_name: members.last_name,
            avatar_url: members.avatar_url,
            role: members.organization_role,
          },
          project: { id: projects.id, name: projects.name },
        })
        .from(activity_logs)
        .leftJoin(projects, eq(projects.id, activity_logs.project_id))
        .leftJoin(members, eq(members.id, activity_logs.member_id))
        .where(where)
        .orderBy(desc(activity_logs.created_at))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(activity_logs).where(where),
    ]);

    return NextResponse.json({ data: logs, count: total, offset, limit });
  } catch (error) {
    return handleRouteError(error, 'Organization activity error');
  }
}
