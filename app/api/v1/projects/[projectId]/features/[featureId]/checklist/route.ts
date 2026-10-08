import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { feature_checklists } from '@/lib/db/schema';
import { requireApiUser } from '@/lib/auth/session';
import { canManageProject, getFeatureProjectId, getProjectAccess } from '@/lib/db/queries';
import { handleRouteError } from '@/lib/api/http';

const createChecklistSchema = z.object({
  title: z.string().min(1, "Title is required"),
  order_index: z.number().optional().default(0),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string; featureId: string }> }
) {
  try {
    const { projectId, featureId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    const access = await getProjectAccess(user.id, projectId);
    if (!access.hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // PMs and Admins create checklist items
    if (!canManageProject(access)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    if ((await getFeatureProjectId(featureId)) !== projectId) {
      return NextResponse.json({ error: 'Feature not found in this project' }, { status: 404 });
    }

    const result = createChecklistSchema.safeParse(await request.json());
    if (!result.success) return NextResponse.json({ error: 'Invalid payload', details: result.error.flatten() }, { status: 400 });

    const [checklistItem] = await db
      .insert(feature_checklists)
      .values({
        feature_id: featureId,
        title: result.data.title,
        order_index: result.data.order_index,
      })
      .returning();

    return NextResponse.json(checklistItem);
  } catch (error) {
    return handleRouteError(error, 'Create checklist item error');
  }
}
