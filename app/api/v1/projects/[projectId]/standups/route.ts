import { NextResponse } from 'next/server';
import { and, desc, eq, getTableColumns, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { daily_updates, members, sprints } from '@/lib/db/schema';
import { requireApiUser } from '@/lib/auth/session';
import { getProjectAccess, memberSummary, sprintInProject } from '@/lib/db/queries';
import { handleRouteError } from '@/lib/api/http';
import { logActivity } from '@/lib/activity.server';
import { projectTimezone } from '@/lib/timezone';

const standupSchema = z.object({
  yesterday: z.string().min(1, 'Please enter what you did yesterday'),
  today: z.string().min(1, 'Please enter what you plan to do today'),
  blockers: z.string().optional(),
  risks: z.string().optional(),
  help_needed: z.string().optional(),
  sprint_id: z.string().uuid().optional().nullable(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    if (!(await getProjectAccess(user.id, projectId)).hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const url = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '100') || 100, 1), 500);
    const memberId = url.searchParams.get('memberId');

    const where = memberId
      ? and(eq(daily_updates.project_id, projectId), eq(daily_updates.member_id, memberId))
      : eq(daily_updates.project_id, projectId);

    // Standups with member details and sprint names, newest first
    const standups = await db
      .select({
        ...getTableColumns(daily_updates),
        members: memberSummary,
        sprints: { id: sprints.id, name: sprints.name },
      })
      .from(daily_updates)
      .leftJoin(members, eq(members.id, daily_updates.member_id))
      .leftJoin(sprints, eq(sprints.id, daily_updates.sprint_id))
      .where(where)
      .orderBy(desc(daily_updates.submitted_at))
      .limit(limit);

    return NextResponse.json(standups);
  } catch (error) {
    return handleRouteError(error, 'Fetch standups error');
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    if (!(await getProjectAccess(user.id, projectId)).hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const result = standupSchema.safeParse(await request.json());
    if (!result.success) return NextResponse.json({ error: 'Invalid payload', details: result.error.flatten() }, { status: 400 });

    // One standup per member, per project, per day (in the organization's timezone)
    const tz = await projectTimezone(projectId);
    const [existing] = await db
      .select({ id: daily_updates.id })
      .from(daily_updates)
      .where(
        and(
          eq(daily_updates.project_id, projectId),
          eq(daily_updates.member_id, user.id),
          sql`(${daily_updates.submitted_at} at time zone ${tz})::date = (now() at time zone ${tz})::date`,
        ),
      )
      .limit(1);
    if (existing) {
      return NextResponse.json({ error: 'You have already submitted a standup today. Edit it instead.' }, { status: 409 });
    }

    // Link to the given sprint, or to the project's active sprint
    let sprintId = result.data.sprint_id || null;
    if (sprintId && !(await sprintInProject(sprintId, projectId))) {
      return NextResponse.json({ error: 'Sprint not found in this project' }, { status: 404 });
    }
    if (!sprintId) {
      const [active] = await db
        .select({ id: sprints.id })
        .from(sprints)
        .where(and(eq(sprints.project_id, projectId), eq(sprints.status, 'Active')))
        .orderBy(desc(sprints.start_date))
        .limit(1);
      sprintId = active?.id ?? null;
    }

    const [standup] = await db
      .insert(daily_updates)
      .values({
        project_id: projectId,
        member_id: user.id,
        ...result.data,
        sprint_id: sprintId,
        submitted_at: new Date(),
      })
      .returning();

    await logActivity({
      projectId,
      memberId: user.id,
      action: 'Submitted',
      entityType: 'Standup',
      entityId: standup.id,
      description: result.data.blockers ? 'Submitted a daily standup (with blockers)' : 'Submitted a daily standup',
    });

    return NextResponse.json(standup);
  } catch (error) {
    return handleRouteError(error, 'Submit standup error');
  }
}
