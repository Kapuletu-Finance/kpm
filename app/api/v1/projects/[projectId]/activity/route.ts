import { NextRequest, NextResponse } from 'next/server';
import { count, desc, eq, getTableColumns } from 'drizzle-orm';
import { db } from '@/lib/db';
import { activity_logs, members } from '@/lib/db/schema';
import { requireApiUser } from '@/lib/auth/session';
import { getProjectAccess } from '@/lib/db/queries';
import { handleRouteError } from '@/lib/api/http';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    if (!(await getProjectAccess(user.id, projectId)).hasAccess) {
      return NextResponse.json({ error: 'Not authorized for this project' }, { status: 403 });
    }

    const url = new URL(req.url);
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50') || 50, 1), 200);
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0') || 0, 0);

    const where = eq(activity_logs.project_id, projectId);
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
        })
        .from(activity_logs)
        .leftJoin(members, eq(members.id, activity_logs.member_id))
        .where(where)
        .orderBy(desc(activity_logs.created_at))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(activity_logs).where(where),
    ]);

    return NextResponse.json({ data: logs, count: total, offset, limit });
  } catch (error) {
    return handleRouteError(error, 'Fetch project activity error');
  }
}
