import { NextResponse } from 'next/server';
import { desc, eq, getTableColumns } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { daily_updates, members, sprints } from '@/lib/db/schema';
import { requireApiUser } from '@/lib/auth/session';
import { getProjectAccess, memberSummary } from '@/lib/db/queries';
import { handleRouteError } from '@/lib/api/http';

const standupSchema = z.object({
  yesterday: z.string().min(1, 'Please enter what you did yesterday'),
  today: z.string().min(1, 'Please enter what you plan to do today'),
  blockers: z.string().optional(),
  risks: z.string().optional(),
  help_needed: z.string().optional(),
  sprint_id: z.string().optional().nullable(),
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

    // Standups with member details and sprint names
    const standups = await db
      .select({
        ...getTableColumns(daily_updates),
        members: memberSummary,
        sprints: { id: sprints.id, name: sprints.name },
      })
      .from(daily_updates)
      .leftJoin(members, eq(members.id, daily_updates.member_id))
      .leftJoin(sprints, eq(sprints.id, daily_updates.sprint_id))
      .where(eq(daily_updates.project_id, projectId))
      .orderBy(desc(daily_updates.submitted_at));

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

    const [standup] = await db
      .insert(daily_updates)
      .values({
        project_id: projectId,
        member_id: user.id,
        ...result.data,
        sprint_id: result.data.sprint_id || null,
        submitted_at: new Date(),
      })
      .returning();

    return NextResponse.json(standup);
  } catch (error) {
    return handleRouteError(error, 'Submit standup error');
  }
}
