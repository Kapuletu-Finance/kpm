import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { milestones, project_members, roadmaps } from '@/lib/db/schema';
import { requireApiUser } from '@/lib/auth/session';
import { canManageProject, getProjectAccess } from '@/lib/db/queries';
import { handleRouteError } from '@/lib/api/http';
import { logActivity } from '@/lib/activity.server';
import { createNotification } from '@/lib/notifications.server';

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  due_date: z.string().optional().nullable(),
  status: z.enum(['Planned', 'In Progress', 'Achieved', 'Missed']).optional(),
  roadmap_id: z.string().uuid().optional().nullable(),
});

type Params = { params: Promise<{ projectId: string; milestoneId: string }> };

const inProject = (milestoneId: string, projectId: string) =>
  and(eq(milestones.id, milestoneId), eq(milestones.project_id, projectId));

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { projectId, milestoneId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    if (!canManageProject(await getProjectAccess(user.id, projectId))) {
      return NextResponse.json({ error: 'Only Project Managers and Admins can update milestones' }, { status: 403 });
    }

    const result = updateSchema.safeParse(await request.json());
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0]?.message || 'Invalid payload' }, { status: 400 });
    }

    const [current] = await db
      .select({ status: milestones.status })
      .from(milestones)
      .where(inProject(milestoneId, projectId))
      .limit(1);
    if (!current) return NextResponse.json({ error: 'Milestone not found' }, { status: 404 });

    if (result.data.roadmap_id) {
      const [phase] = await db
        .select({ id: roadmaps.id })
        .from(roadmaps)
        .where(and(eq(roadmaps.id, result.data.roadmap_id), eq(roadmaps.project_id, projectId)))
        .limit(1);
      if (!phase) return NextResponse.json({ error: 'Roadmap phase not found in this project' }, { status: 404 });
    }

    const achieving = result.data.status === 'Achieved' && current.status !== 'Achieved';
    const updates: Partial<typeof milestones.$inferInsert> = { ...result.data };
    if (achieving) updates.achieved_at = new Date();
    if (result.data.status && result.data.status !== 'Achieved') updates.achieved_at = null;

    const [milestone] = await db
      .update(milestones)
      .set(updates)
      .where(inProject(milestoneId, projectId))
      .returning();

    if (result.data.status && result.data.status !== current.status) {
      await logActivity({
        projectId,
        memberId: user.id,
        action: achieving ? 'Achieved' : 'Updated',
        entityType: 'Milestone',
        entityId: milestoneId,
        description: achieving
          ? `Achieved milestone: ${milestone.title}`
          : `Moved milestone "${milestone.title}" to ${milestone.status}`,
      });
    }

    // Celebrate with the team
    if (achieving) {
      const team = await db
        .select({ member_id: project_members.member_id })
        .from(project_members)
        .where(eq(project_members.project_id, projectId));
      await Promise.all(
        team
          .filter((t) => t.member_id && t.member_id !== user.id)
          .map((t) =>
            createNotification({
              member_id: t.member_id!,
              title: 'Milestone achieved',
              message: milestone.title,
              type: 'System',
              entity_type: 'Project',
              entity_id: projectId,
            }),
          ),
      );
    }

    return NextResponse.json(milestone);
  } catch (error) {
    return handleRouteError(error, 'Update milestone error');
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { projectId, milestoneId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    if (!canManageProject(await getProjectAccess(user.id, projectId))) {
      return NextResponse.json({ error: 'Only Project Managers and Admins can delete milestones' }, { status: 403 });
    }

    const [deleted] = await db
      .delete(milestones)
      .where(inProject(milestoneId, projectId))
      .returning({ id: milestones.id, title: milestones.title });
    if (!deleted) return NextResponse.json({ error: 'Milestone not found' }, { status: 404 });

    await logActivity({
      projectId,
      memberId: user.id,
      action: 'Deleted',
      entityType: 'Milestone',
      entityId: milestoneId,
      description: `Deleted milestone: ${deleted.title}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error, 'Delete milestone error');
  }
}
