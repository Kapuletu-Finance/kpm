import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { modules, roadmaps } from '@/lib/db/schema';
import { requireApiUser } from '@/lib/auth/session';
import { canManageProject, getProjectAccess } from '@/lib/db/queries';
import { handleRouteError } from '@/lib/api/http';

const createModuleSchema = z.object({
  roadmap_id: z.string().uuid(),
  name: z.string().min(1, 'Module name is required'),
  description: z.string().optional(),
  objectives: z.string().optional(),
  status: z.enum(['Not Started', 'In Progress', 'Completed']).default('Not Started'),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']).default('Medium'),
  order_index: z.number().default(0),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    if (!canManageProject(await getProjectAccess(user.id, projectId))) {
      return NextResponse.json({ error: 'Insufficient permissions to create a module' }, { status: 403 });
    }

    const result = createModuleSchema.safeParse(await request.json());
    if (!result.success) {
      return NextResponse.json({ error: 'Invalid payload', details: result.error.flatten() }, { status: 400 });
    }

    // The phase must belong to this project
    const [phase] = await db
      .select({ id: roadmaps.id })
      .from(roadmaps)
      .where(and(eq(roadmaps.id, result.data.roadmap_id), eq(roadmaps.project_id, projectId)))
      .limit(1);
    if (!phase) {
      return NextResponse.json({ error: 'Roadmap phase not found in this project' }, { status: 404 });
    }

    const [newModule] = await db.insert(modules).values(result.data).returning();

    return NextResponse.json(newModule, { status: 201 });
  } catch (error) {
    return handleRouteError(error, 'Create module error');
  }
}
