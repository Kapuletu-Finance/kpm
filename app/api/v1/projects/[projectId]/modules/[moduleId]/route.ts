import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { modules, roadmaps } from '@/lib/db/schema';
import { requireApiUser } from '@/lib/auth/session';
import { canManageProject, getModuleProjectId, getProjectAccess } from '@/lib/db/queries';
import { handleRouteError } from '@/lib/api/http';

const updateModuleSchema = z.object({
  roadmap_id: z.string().uuid().optional(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  objectives: z.string().optional(),
  status: z.enum(['Not Started', 'In Progress', 'Completed']).optional(),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']).optional(),
  order_index: z.number().optional(),
});

type Params = { params: Promise<{ projectId: string; moduleId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { projectId, moduleId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    if (!canManageProject(await getProjectAccess(user.id, projectId))) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const result = updateModuleSchema.safeParse(await request.json());
    if (!result.success) {
      return NextResponse.json({ error: 'Invalid payload', details: result.error.flatten() }, { status: 400 });
    }

    if ((await getModuleProjectId(moduleId)) !== projectId) {
      return NextResponse.json({ error: 'Module not found in this project' }, { status: 404 });
    }

    // Moving to another phase: it must be in the same project
    if (result.data.roadmap_id) {
      const [phase] = await db
        .select({ id: roadmaps.id })
        .from(roadmaps)
        .where(and(eq(roadmaps.id, result.data.roadmap_id), eq(roadmaps.project_id, projectId)))
        .limit(1);
      if (!phase) {
        return NextResponse.json({ error: 'Roadmap phase not found in this project' }, { status: 404 });
      }
    }

    const [updatedModule] = await db
      .update(modules)
      .set(result.data)
      .where(eq(modules.id, moduleId))
      .returning();

    return NextResponse.json(updatedModule);
  } catch (error) {
    return handleRouteError(error, 'Update module error');
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { projectId, moduleId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    if (!canManageProject(await getProjectAccess(user.id, projectId))) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    if ((await getModuleProjectId(moduleId)) !== projectId) {
      return NextResponse.json({ error: 'Module not found in this project' }, { status: 404 });
    }

    await db.delete(modules).where(eq(modules.id, moduleId));

    return NextResponse.json({ message: 'Module deleted successfully' });
  } catch (error) {
    return handleRouteError(error, 'Delete module error');
  }
}
