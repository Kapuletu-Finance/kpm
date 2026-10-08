import { NextResponse } from 'next/server';
import { and, count, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { project_members } from '@/lib/db/schema';
import { requireApiUser } from '@/lib/auth/session';
import { canManageProject, getProjectAccess, getProjectMembership } from '@/lib/db/queries';
import { handleRouteError } from '@/lib/api/http';

const updateMemberSchema = z.object({
  project_role: z.enum(['Project Manager', 'Member']).optional(),
  functional_role: z.string().optional(),
  role_responsibilities: z.array(z.string()).optional(),
  review_authority: z.boolean().optional(),
});

/** Org Admins (of this project's organization) and the project's Project Managers manage the team. */
async function verifyAccess(userId: string, projectId: string) {
  return canManageProject(await getProjectAccess(userId, projectId));
}

const teamRow = (projectId: string, memberId: string) =>
  and(eq(project_members.project_id, projectId), eq(project_members.member_id, memberId));

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string; memberId: string }> }
) {
  try {
    const { projectId, memberId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    if (!(await verifyAccess(user.id, projectId))) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const result = updateMemberSchema.safeParse(await request.json());
    if (!result.success) {
      return NextResponse.json({ error: 'Invalid payload', details: result.error.flatten() }, { status: 400 });
    }

    const updates = Object.fromEntries(
      Object.entries(result.data).filter(([, value]) => value !== undefined),
    ) as Partial<typeof project_members.$inferInsert>;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No changes provided' }, { status: 400 });
    }

    const [updatedMember] = await db
      .update(project_members)
      .set(updates)
      .where(teamRow(projectId, memberId))
      .returning();

    if (!updatedMember) {
      return NextResponse.json({ error: 'Team member not found' }, { status: 404 });
    }

    return NextResponse.json({
      message: 'Team member updated successfully',
      data: updatedMember
    });
  } catch (error) {
    return handleRouteError(error, 'Update project team member error');
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ projectId: string; memberId: string }> }
) {
  try {
    const { projectId, memberId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    if (!(await verifyAccess(user.id, projectId))) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Never remove the last Project Manager
    const targetMember = await getProjectMembership(projectId, memberId);
    if (targetMember?.project_role === 'Project Manager') {
      const [{ value: pmCount }] = await db
        .select({ value: count() })
        .from(project_members)
        .where(and(eq(project_members.project_id, projectId), eq(project_members.project_role, 'Project Manager')));

      if (pmCount <= 1) {
        return NextResponse.json({ error: 'Cannot remove the last Project Manager' }, { status: 400 });
      }
    }

    await db.delete(project_members).where(teamRow(projectId, memberId));

    return NextResponse.json({ message: 'Team member removed successfully' });
  } catch (error) {
    return handleRouteError(error, 'Delete project team member error');
  }
}
