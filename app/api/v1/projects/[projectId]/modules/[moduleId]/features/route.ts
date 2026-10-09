import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { features } from '@/lib/db/schema';
import { requireApiUser } from '@/lib/auth/session';
import { canManageProject, getModuleProjectId, getProjectAccess } from '@/lib/db/queries';
import { withFeatureRelations } from '@/lib/db/features';
import { handleRouteError } from '@/lib/api/http';
import { logActivity } from '@/lib/activity.server';

const createFeatureSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']).optional(),
  status: z.enum(['Idea', 'Requirements', 'Design', 'Development', 'Integration', 'Testing', 'Approval', 'Released']).optional(),
  start_date: z.string().optional().nullable(),
  due_date: z.string().optional().nullable(),
});

type Params = { params: Promise<{ projectId: string; moduleId: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const { projectId, moduleId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    const [access, moduleProjectId] = await Promise.all([
      getProjectAccess(user.id, projectId),
      getModuleProjectId(moduleId),
    ]);
    if (!access.hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (moduleProjectId !== projectId) return NextResponse.json({ error: 'Module not found in this project' }, { status: 404 });

    const rows = await db
      .select()
      .from(features)
      .where(eq(features.module_id, moduleId))
      .orderBy(desc(features.created_at));

    return NextResponse.json(await withFeatureRelations(rows));
  } catch (error) {
    return handleRouteError(error, 'Fetch features error');
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { projectId, moduleId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    const [access, moduleProjectId] = await Promise.all([
      getProjectAccess(user.id, projectId),
      getModuleProjectId(moduleId),
    ]);
    if (!access.hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!canManageProject(access)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    if (moduleProjectId !== projectId) return NextResponse.json({ error: 'Module not found in this project' }, { status: 404 });

    const result = createFeatureSchema.safeParse(await request.json());
    if (!result.success) return NextResponse.json({ error: 'Invalid payload', details: result.error.flatten() }, { status: 400 });

    const [feature] = await db
      .insert(features)
      .values({
        module_id: moduleId,
        title: result.data.title,
        description: result.data.description,
        priority: result.data.priority || 'Medium',
        status: result.data.status || 'Idea',
        completed_at: result.data.status === 'Released' ? new Date() : null,
        start_date: result.data.start_date || null,
        due_date: result.data.due_date || null,
      })
      .returning();

    await logActivity({
      projectId,
      memberId: user.id,
      action: 'Created',
      entityType: 'Feature',
      entityId: feature.id,
      description: `Created a new feature: ${feature.title}`
    });

    return NextResponse.json(feature);
  } catch (error) {
    return handleRouteError(error, 'Create feature error');
  }
}
