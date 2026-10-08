import { NextResponse } from 'next/server';
import { asc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { modules, roadmaps } from '@/lib/db/schema';
import { requireApiUser } from '@/lib/auth/session';
import { canManageProject, getProjectAccess } from '@/lib/db/queries';
import { handleRouteError } from '@/lib/api/http';

const createRoadmapSchema = z.object({
  name: z.string().min(1, 'Phase name is required'),
  description: z.string().optional(),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  order_index: z.number().default(0),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    const access = await getProjectAccess(user.id, projectId);
    if (!access.hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Phases in order, each with its modules in order
    const phases = await db
      .select()
      .from(roadmaps)
      .where(eq(roadmaps.project_id, projectId))
      .orderBy(asc(roadmaps.order_index));

    const phaseModules = phases.length
      ? await db
          .select()
          .from(modules)
          .where(inArray(modules.roadmap_id, phases.map((p) => p.id)))
          .orderBy(asc(modules.order_index))
      : [];

    return NextResponse.json(
      phases.map((phase) => ({ ...phase, modules: phaseModules.filter((m) => m.roadmap_id === phase.id) })),
    );
  } catch (error) {
    return handleRouteError(error, 'Fetch roadmap error');
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    // Admins and the project's PMs create phases
    const access = await getProjectAccess(user.id, projectId);
    if (!canManageProject(access)) {
      return NextResponse.json({ error: 'Insufficient permissions to create a roadmap phase' }, { status: 403 });
    }

    const result = createRoadmapSchema.safeParse(await request.json());
    if (!result.success) {
      return NextResponse.json({ error: 'Invalid payload', details: result.error.flatten() }, { status: 400 });
    }

    const [newRoadmap] = await db
      .insert(roadmaps)
      .values({
        project_id: projectId,
        name: result.data.name,
        description: result.data.description,
        start_date: result.data.start_date || null,
        end_date: result.data.end_date || null,
        order_index: result.data.order_index
      })
      .returning();

    return NextResponse.json({ ...newRoadmap, modules: [] }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, 'Create roadmap error');
  }
}
