import { NextResponse } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { modules, roadmaps } from '@/lib/db/schema';
import { requireApiUser } from '@/lib/auth/session';
import { canManageProject, getProjectAccess } from '@/lib/db/queries';
import { handleRouteError } from '@/lib/api/http';

const updateRoadmapSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  order_index: z.number().optional(),
});

type Params = { params: Promise<{ projectId: string; roadmapId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { projectId, roadmapId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    if (!canManageProject(await getProjectAccess(user.id, projectId))) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const result = updateRoadmapSchema.safeParse(await request.json());
    if (!result.success) {
      return NextResponse.json({ error: 'Invalid payload', details: result.error.flatten() }, { status: 400 });
    }

    const [updatedRoadmap] = await db
      .update(roadmaps)
      .set(result.data)
      .where(and(eq(roadmaps.id, roadmapId), eq(roadmaps.project_id, projectId)))
      .returning();

    if (!updatedRoadmap) {
      return NextResponse.json({ error: 'Roadmap not found' }, { status: 404 });
    }

    const phaseModules = await db
      .select()
      .from(modules)
      .where(eq(modules.roadmap_id, roadmapId))
      .orderBy(asc(modules.order_index));

    return NextResponse.json({ ...updatedRoadmap, modules: phaseModules });
  } catch (error) {
    return handleRouteError(error, 'Update roadmap error');
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { projectId, roadmapId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    if (!canManageProject(await getProjectAccess(user.id, projectId))) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    await db.delete(roadmaps).where(and(eq(roadmaps.id, roadmapId), eq(roadmaps.project_id, projectId)));

    return NextResponse.json({ message: 'Roadmap deleted successfully' });
  } catch (error) {
    return handleRouteError(error, 'Delete roadmap error');
  }
}
