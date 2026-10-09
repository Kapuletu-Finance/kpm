import { NextResponse } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { feature_checklists, feature_members, features, members } from '@/lib/db/schema';
import { requireApiUser } from '@/lib/auth/session';
import { canManageProject, getFeatureProjectId, getProjectAccess, sprintInProject } from '@/lib/db/queries';
import { handleRouteError } from '@/lib/api/http';
import { logActivity } from '@/lib/activity.server';

const updateFeatureSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  business_value: z.string().optional(),
  requirements: z.string().optional(),
  acceptance_criteria: z.string().optional(),
  user_stories: z.string().optional(),
  technical_notes: z.string().optional(),
  api_links: z.string().optional(),
  design_links: z.string().optional(),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']).optional(),
  status: z.enum(['Idea', 'Requirements', 'Design', 'Development', 'Integration', 'Testing', 'Approval', 'Released']).optional(),
  start_date: z.string().optional().nullable(),
  due_date: z.string().optional().nullable(),
  sprint_id: z.string().optional().nullable(),
});

type Params = { params: Promise<{ projectId: string; featureId: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const { projectId, featureId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    const [access, featureProjectId] = await Promise.all([
      getProjectAccess(user.id, projectId),
      getFeatureProjectId(featureId),
    ]);
    if (!access.hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (featureProjectId !== projectId) {
      return NextResponse.json({ error: 'Feature not found in this project' }, { status: 404 });
    }

    const [[feature], assignees, checklists] = await Promise.all([
      db.select().from(features).where(eq(features.id, featureId)).limit(1),
      db
        .select({
          id: feature_members.id,
          member_id: feature_members.member_id,
          responsibility: feature_members.responsibility,
          members: {
            first_name: members.first_name,
            last_name: members.last_name,
            email: members.email,
            avatar_url: members.avatar_url,
          },
        })
        .from(feature_members)
        .leftJoin(members, eq(members.id, feature_members.member_id))
        .where(eq(feature_members.feature_id, featureId)),
      db
        .select()
        .from(feature_checklists)
        .where(eq(feature_checklists.feature_id, featureId))
        .orderBy(asc(feature_checklists.order_index)),
    ]);

    if (!feature) return NextResponse.json({ error: 'Feature not found' }, { status: 404 });

    return NextResponse.json({ ...feature, feature_members: assignees, feature_checklists: checklists });
  } catch (error) {
    return handleRouteError(error, 'Fetch feature error');
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { projectId, featureId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    const access = await getProjectAccess(user.id, projectId);
    if (!access.hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    if ((await getFeatureProjectId(featureId)) !== projectId) {
      return NextResponse.json({ error: 'Feature not found in this project' }, { status: 404 });
    }

    const result = updateFeatureSchema.safeParse(await request.json());
    if (!result.success) return NextResponse.json({ error: 'Invalid payload', details: result.error.flatten() }, { status: 400 });

    const changedFields = Object.keys(result.data).filter((k) => result.data[k as keyof typeof result.data] !== undefined);

    if (!canManageProject(access)) {
      // Assignees move their own work along the board, but nothing else
      const [assignment] = await db
        .select({ id: feature_members.id })
        .from(feature_members)
        .where(and(eq(feature_members.feature_id, featureId), eq(feature_members.member_id, user.id)))
        .limit(1);
      const statusOnly = changedFields.length === 1 && changedFields[0] === 'status';
      if (!assignment || !statusOnly) {
        return NextResponse.json(
          { error: assignment ? 'Assignees can only change the status' : 'Only assignees and managers can update this feature' },
          { status: 403 },
        );
      }
      // Releasing is a management decision
      if (result.data.status === 'Released') {
        return NextResponse.json({ error: 'Only managers can mark a feature as Released' }, { status: 403 });
      }
    }

    if (result.data.sprint_id && !(await sprintInProject(result.data.sprint_id, projectId))) {
      return NextResponse.json({ error: 'Sprint not found in this project' }, { status: 404 });
    }

    const updates: Partial<typeof features.$inferInsert> = { ...result.data };
    // completed_at records when the feature shipped; it drives burndown and velocity
    if (result.data.status !== undefined) {
      const [current] = await db.select({ status: features.status }).from(features).where(eq(features.id, featureId)).limit(1);
      if (result.data.status === 'Released' && current?.status !== 'Released') updates.completed_at = new Date();
      if (result.data.status !== 'Released') updates.completed_at = null;
    }

    const [feature] = await db
      .update(features)
      .set(updates)
      .where(eq(features.id, featureId))
      .returning();

    await logActivity({
      projectId,
      memberId: user.id,
      action: 'Updated',
      entityType: 'Feature',
      entityId: featureId,
      description: changedFields.length === 1 && changedFields[0] === 'status'
        ? `Moved feature "${feature.title}" to ${feature.status}`
        : `Updated feature: ${feature.title}`
    });

    return NextResponse.json(feature);
  } catch (error) {
    return handleRouteError(error, 'Update feature error');
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { projectId, featureId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    const access = await getProjectAccess(user.id, projectId);
    if (!access.hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!canManageProject(access)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    if ((await getFeatureProjectId(featureId)) !== projectId) {
      return NextResponse.json({ error: 'Feature not found in this project' }, { status: 404 });
    }

    await db.delete(features).where(eq(features.id, featureId));

    await logActivity({
      projectId,
      memberId: user.id,
      action: 'Deleted',
      entityType: 'Feature',
      entityId: featureId,
      description: `Deleted a feature`
    });

    return NextResponse.json({ message: 'Feature deleted successfully' });
  } catch (error) {
    return handleRouteError(error, 'Delete feature error');
  }
}
