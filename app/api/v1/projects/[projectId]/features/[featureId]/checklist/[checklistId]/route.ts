import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { feature_checklists } from '@/lib/db/schema';
import { requireApiUser } from '@/lib/auth/session';
import { canManageProject, getFeatureProjectId, getProjectAccess } from '@/lib/db/queries';
import { handleRouteError } from '@/lib/api/http';

const updateChecklistSchema = z.object({
  title: z.string().min(1).optional(),
  is_completed: z.boolean().optional(),
  order_index: z.number().optional(),
});

type Params = { params: Promise<{ projectId: string; featureId: string; checklistId: string }> };

// Checklist belongs to the feature, and the feature to this project
async function checklistInProject(checklistId: string, featureId: string, projectId: string) {
  const [[item], featureProjectId] = await Promise.all([
    db
      .select({ id: feature_checklists.id })
      .from(feature_checklists)
      .where(and(eq(feature_checklists.id, checklistId), eq(feature_checklists.feature_id, featureId)))
      .limit(1),
    getFeatureProjectId(featureId),
  ]);
  return !!item && featureProjectId === projectId;
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { projectId, featureId, checklistId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    // Any project member can check off an item
    const access = await getProjectAccess(user.id, projectId);
    if (!access.hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    if (!(await checklistInProject(checklistId, featureId, projectId))) {
      return NextResponse.json({ error: 'Checklist not found in this feature/project' }, { status: 404 });
    }

    const result = updateChecklistSchema.safeParse(await request.json());
    if (!result.success) return NextResponse.json({ error: 'Invalid payload', details: result.error.flatten() }, { status: 400 });

    const updates: Partial<typeof feature_checklists.$inferInsert> = { ...result.data };
    if (result.data.is_completed !== undefined) {
      updates.completed_by = result.data.is_completed ? user.id : null;
      updates.completed_at = result.data.is_completed ? new Date() : null;
    }

    const [checklistItem] = await db
      .update(feature_checklists)
      .set(updates)
      .where(eq(feature_checklists.id, checklistId))
      .returning();

    return NextResponse.json(checklistItem);
  } catch (error) {
    return handleRouteError(error, 'Update checklist item error');
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { projectId, featureId, checklistId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    const access = await getProjectAccess(user.id, projectId);
    if (!access.hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!canManageProject(access)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    if (!(await checklistInProject(checklistId, featureId, projectId))) {
      return NextResponse.json({ error: 'Checklist not found in this feature/project' }, { status: 404 });
    }

    await db.delete(feature_checklists).where(eq(feature_checklists.id, checklistId));

    return NextResponse.json({ message: 'Checklist item deleted successfully' });
  } catch (error) {
    return handleRouteError(error, 'Delete checklist item error');
  }
}
