import { NextResponse } from 'next/server';
import { and, asc, eq, getTableColumns, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { milestones, roadmaps } from '@/lib/db/schema';
import { requireApiUser } from '@/lib/auth/session';
import { canManageProject, getProjectAccess } from '@/lib/db/queries';
import { handleRouteError } from '@/lib/api/http';
import { logActivity } from '@/lib/activity.server';

const milestoneSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  due_date: z.string().optional().nullable(),
  status: z.enum(['Planned', 'In Progress', 'Achieved', 'Missed']).default('Planned'),
  roadmap_id: z.string().uuid().optional().nullable(),
});

type Params = { params: Promise<{ projectId: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const { projectId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    if (!(await getProjectAccess(user.id, projectId)).hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const rows = await db
      .select({ ...getTableColumns(milestones), phase: { id: roadmaps.id, name: roadmaps.name } })
      .from(milestones)
      .leftJoin(roadmaps, eq(roadmaps.id, milestones.roadmap_id))
      .where(eq(milestones.project_id, projectId))
      // Undated milestones last
      .orderBy(sql`${milestones.due_date} asc nulls last`, asc(milestones.created_at));

    return NextResponse.json(rows);
  } catch (error) {
    return handleRouteError(error, 'List milestones error');
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { projectId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    if (!canManageProject(await getProjectAccess(user.id, projectId))) {
      return NextResponse.json({ error: 'Only Project Managers and Admins can create milestones' }, { status: 403 });
    }

    const result = milestoneSchema.safeParse(await request.json());
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0]?.message || 'Invalid payload' }, { status: 400 });
    }
    const data = result.data;

    if (data.roadmap_id) {
      const [phase] = await db
        .select({ id: roadmaps.id })
        .from(roadmaps)
        .where(and(eq(roadmaps.id, data.roadmap_id), eq(roadmaps.project_id, projectId)))
        .limit(1);
      if (!phase) return NextResponse.json({ error: 'Roadmap phase not found in this project' }, { status: 404 });
    }

    const [milestone] = await db
      .insert(milestones)
      .values({
        project_id: projectId,
        title: data.title,
        description: data.description,
        due_date: data.due_date || null,
        status: data.status,
        roadmap_id: data.roadmap_id || null,
        achieved_at: data.status === 'Achieved' ? new Date() : null,
        created_by: user.id,
      })
      .returning();

    await logActivity({
      projectId,
      memberId: user.id,
      action: 'Created',
      entityType: 'Milestone',
      entityId: milestone.id,
      description: `Added milestone: ${milestone.title}`,
    });

    return NextResponse.json(milestone, { status: 201 });
  } catch (error) {
    return handleRouteError(error, 'Create milestone error');
  }
}
