import { NextResponse } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { feature_members, features, members, sprints } from '@/lib/db/schema';
import { requireApiUser } from '@/lib/auth/session';
import { canManageProject, getProjectAccess } from '@/lib/db/queries';
import { handleRouteError } from '@/lib/api/http';

const updateSprintSchema = z.object({
  name: z.string().min(1).optional(),
  goal: z.string().optional(),
  definition_of_success: z.string().optional(),
  risks: z.string().optional(),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  status: z.enum(['Planning', 'Active', 'Review', 'Completed']).optional(),
});

type Params = { params: Promise<{ projectId: string; sprintId: string }> };

const sprintInProject = (sprintId: string, projectId: string) =>
  and(eq(sprints.id, sprintId), eq(sprints.project_id, projectId));

export async function GET(request: Request, { params }: Params) {
  try {
    const { projectId, sprintId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    const [access, [sprint]] = await Promise.all([
      getProjectAccess(user.id, projectId),
      db.select().from(sprints).where(sprintInProject(sprintId, projectId)).limit(1),
    ]);
    if (!access.hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!sprint) return NextResponse.json({ error: 'Sprint not found in this project' }, { status: 404 });

    const sprintFeatures = await db
      .select({
        id: features.id,
        module_id: features.module_id,
        title: features.title,
        description: features.description,
        priority: features.priority,
        status: features.status,
      })
      .from(features)
      .where(eq(features.sprint_id, sprintId));

    const assignees = sprintFeatures.length
      ? await db
          .select({
            feature_id: feature_members.feature_id,
            id: feature_members.id,
            member_id: feature_members.member_id,
            members: { first_name: members.first_name, last_name: members.last_name, avatar_url: members.avatar_url },
          })
          .from(feature_members)
          .leftJoin(members, eq(members.id, feature_members.member_id))
          .where(inArray(feature_members.feature_id, sprintFeatures.map((f) => f.id)))
      : [];

    return NextResponse.json({
      ...sprint,
      features: sprintFeatures.map((feature) => ({
        ...feature,
        feature_members: assignees
          .filter((a) => a.feature_id === feature.id)
          .map((a) => ({ id: a.id, member_id: a.member_id, members: a.members })),
      })),
    });
  } catch (error) {
    return handleRouteError(error, 'Fetch sprint error');
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { projectId, sprintId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    const access = await getProjectAccess(user.id, projectId);
    if (!access.hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!canManageProject(access)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const result = updateSprintSchema.safeParse(await request.json());
    if (!result.success) return NextResponse.json({ error: 'Invalid payload', details: result.error.flatten() }, { status: 400 });

    const [sprint] = await db
      .update(sprints)
      .set(result.data)
      .where(sprintInProject(sprintId, projectId))
      .returning();

    if (!sprint) return NextResponse.json({ error: 'Sprint not found in this project' }, { status: 404 });

    return NextResponse.json(sprint);
  } catch (error) {
    return handleRouteError(error, 'Update sprint error');
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { projectId, sprintId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    const access = await getProjectAccess(user.id, projectId);
    if (!access.hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!canManageProject(access)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const [deleted] = await db
      .delete(sprints)
      .where(sprintInProject(sprintId, projectId))
      .returning({ id: sprints.id });

    if (!deleted) return NextResponse.json({ error: 'Sprint not found in this project' }, { status: 404 });

    return NextResponse.json({ message: 'Sprint deleted successfully' });
  } catch (error) {
    return handleRouteError(error, 'Delete sprint error');
  }
}
