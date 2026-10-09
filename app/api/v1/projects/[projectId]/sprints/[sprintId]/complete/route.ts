import { NextResponse } from 'next/server';
import { and, eq, ne } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { features, sprints } from '@/lib/db/schema';
import { requireApiUser } from '@/lib/auth/session';
import { canManageProject, getProjectAccess } from '@/lib/db/queries';
import { handleRouteError } from '@/lib/api/http';
import { logActivity } from '@/lib/activity.server';

// Unfinished work goes back to the backlog, or into another (not completed) sprint.
const completeSchema = z.object({
  carry_over_to: z.union([z.literal('backlog'), z.string().uuid()]).default('backlog'),
});

type Params = { params: Promise<{ projectId: string; sprintId: string }> };

// POST: closes a sprint and moves every feature that has not been released out of it.
export async function POST(request: Request, { params }: Params) {
  try {
    const { projectId, sprintId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    if (!canManageProject(await getProjectAccess(user.id, projectId))) {
      return NextResponse.json({ error: 'Only Project Managers and Admins can complete sprints' }, { status: 403 });
    }

    const result = completeSchema.safeParse(await request.json().catch(() => ({})));
    if (!result.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    const target = result.data.carry_over_to;

    const [sprint] = await db
      .select({ name: sprints.name, status: sprints.status })
      .from(sprints)
      .where(and(eq(sprints.id, sprintId), eq(sprints.project_id, projectId)))
      .limit(1);
    if (!sprint) return NextResponse.json({ error: 'Sprint not found in this project' }, { status: 404 });
    if (sprint.status === 'Completed') return NextResponse.json({ error: 'This sprint is already completed' }, { status: 400 });

    let targetName = 'the backlog';
    if (target !== 'backlog') {
      if (target === sprintId) return NextResponse.json({ error: 'Choose a different sprint' }, { status: 400 });
      const [next] = await db
        .select({ name: sprints.name, status: sprints.status })
        .from(sprints)
        .where(and(eq(sprints.id, target), eq(sprints.project_id, projectId)))
        .limit(1);
      if (!next) return NextResponse.json({ error: 'Target sprint not found in this project' }, { status: 404 });
      if (next.status === 'Completed') return NextResponse.json({ error: 'Cannot carry work into a completed sprint' }, { status: 400 });
      targetName = next.name;
    }

    const moved = await db.transaction(async (tx) => {
      await tx.update(sprints).set({ status: 'Completed' }).where(eq(sprints.id, sprintId));
      return tx
        .update(features)
        .set({ sprint_id: target === 'backlog' ? null : target })
        .where(and(eq(features.sprint_id, sprintId), ne(features.status, 'Released')))
        .returning({ id: features.id });
    });

    await logActivity({
      projectId,
      memberId: user.id,
      action: 'Completed',
      entityType: 'Sprint',
      entityId: sprintId,
      description: moved.length
        ? `Completed ${sprint.name}; carried ${moved.length} unfinished feature(s) to ${targetName}`
        : `Completed ${sprint.name}`,
    });

    return NextResponse.json({ success: true, carried_over: moved.length });
  } catch (error) {
    return handleRouteError(error, 'Complete sprint error');
  }
}
