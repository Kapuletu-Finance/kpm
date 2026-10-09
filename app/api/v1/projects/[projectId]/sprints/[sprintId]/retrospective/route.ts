import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { sprint_retrospectives, sprints } from '@/lib/db/schema';
import { requireApiUser } from '@/lib/auth/session';
import { getProjectAccess } from '@/lib/db/queries';
import { handleRouteError } from '@/lib/api/http';
import { logActivity } from '@/lib/activity.server';

const retroSchema = z.object({
  what_went_well: z.string().optional(),
  what_didnt_go_well: z.string().optional(),
  lessons_learned: z.string().optional(),
  process_improvements: z.string().optional(),
});

type Params = { params: Promise<{ projectId: string; sprintId: string }> };

async function authorize(userId: string, projectId: string, sprintId: string) {
  const [access, [sprint]] = await Promise.all([
    getProjectAccess(userId, projectId),
    db
      .select({ id: sprints.id, name: sprints.name })
      .from(sprints)
      .where(and(eq(sprints.id, sprintId), eq(sprints.project_id, projectId)))
      .limit(1),
  ]);
  if (!access.hasAccess) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  if (!sprint) return { error: NextResponse.json({ error: 'Sprint not found in this project' }, { status: 404 }) };
  return { sprint };
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { projectId, sprintId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    const { error } = await authorize(user.id, projectId, sprintId);
    if (error) return error;

    const [retro] = await db
      .select()
      .from(sprint_retrospectives)
      .where(eq(sprint_retrospectives.sprint_id, sprintId))
      .limit(1);

    return NextResponse.json(retro ?? null);
  } catch (error) {
    return handleRouteError(error, 'Fetch retrospective error');
  }
}

// PUT: the whole team writes the retrospective together; one record per sprint.
export async function PUT(request: Request, { params }: Params) {
  try {
    const { projectId, sprintId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    const { error, sprint } = await authorize(user.id, projectId, sprintId);
    if (error) return error;

    const result = retroSchema.safeParse(await request.json());
    if (!result.success) return NextResponse.json({ error: 'Invalid payload', details: result.error.flatten() }, { status: 400 });

    const [retro] = await db
      .insert(sprint_retrospectives)
      .values({ sprint_id: sprintId, ...result.data })
      .onConflictDoUpdate({ target: sprint_retrospectives.sprint_id, set: result.data })
      .returning();

    await logActivity({
      projectId,
      memberId: user.id,
      action: 'Updated',
      entityType: 'Retrospective',
      entityId: retro.id,
      description: `Updated the retrospective for ${sprint!.name}`,
    });

    return NextResponse.json(retro);
  } catch (error) {
    return handleRouteError(error, 'Save retrospective error');
  }
}
