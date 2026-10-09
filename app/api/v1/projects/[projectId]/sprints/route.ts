import { NextResponse } from 'next/server';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { features, sprints } from '@/lib/db/schema';
import { requireApiUser } from '@/lib/auth/session';
import { canManageProject, getProjectAccess } from '@/lib/db/queries';
import { handleRouteError } from '@/lib/api/http';
import { logActivity } from '@/lib/activity.server';

const createSprintSchema = z.object({
  name: z.string().min(1, "Sprint name is required"),
  goal: z.string().optional(),
  definition_of_success: z.string().optional(),
  risks: z.string().optional(),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  status: z.enum(['Planning', 'Active', 'Review', 'Completed']).optional().default('Planning'),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    const access = await getProjectAccess(user.id, projectId);
    if (!access.hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const rows = await db
      .select()
      .from(sprints)
      .where(eq(sprints.project_id, projectId))
      .orderBy(desc(sprints.created_at));

    const sprintFeatures = rows.length
      ? await db
          .select({ sprint_id: features.sprint_id, id: features.id, status: features.status, priority: features.priority })
          .from(features)
          .where(inArray(features.sprint_id, rows.map((s) => s.id)))
      : [];

    return NextResponse.json(
      rows.map((sprint) => ({
        ...sprint,
        features: sprintFeatures
          .filter((f) => f.sprint_id === sprint.id)
          .map((f) => ({ id: f.id, status: f.status, priority: f.priority })),
      })),
    );
  } catch (error) {
    return handleRouteError(error, 'Fetch sprints error');
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

    const access = await getProjectAccess(user.id, projectId);
    if (!access.hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!canManageProject(access)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const result = createSprintSchema.safeParse(await request.json());
    if (!result.success) return NextResponse.json({ error: 'Invalid payload', details: result.error.flatten() }, { status: 400 });

    const { start_date, end_date, status } = result.data;
    if (start_date && end_date && end_date < start_date) {
      return NextResponse.json({ error: 'The sprint must end on or after its start date' }, { status: 400 });
    }
    if (status === 'Active') {
      const [active] = await db
        .select({ name: sprints.name })
        .from(sprints)
        .where(and(eq(sprints.project_id, projectId), eq(sprints.status, 'Active')))
        .limit(1);
      if (active) {
        return NextResponse.json({ error: `"${active.name}" is already active. Complete it before starting another sprint.` }, { status: 409 });
      }
    }

    const [sprint] = await db
      .insert(sprints)
      .values({ project_id: projectId, ...result.data })
      .returning();

    await logActivity({
      projectId,
      memberId: user.id,
      action: 'Created',
      entityType: 'Sprint',
      entityId: sprint.id,
      description: `Created sprint: ${sprint.name}`,
    });

    return NextResponse.json(sprint);
  } catch (error) {
    return handleRouteError(error, 'Create sprint error');
  }
}
