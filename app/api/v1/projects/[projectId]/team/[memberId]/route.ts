import { NextResponse } from 'next/server';
import { and, count, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { project_members } from '@/lib/db/schema';
import { requireApiUser } from '@/lib/auth/session';
import { canManageProject, getProjectAccess, getProjectMembership } from '@/lib/db/queries';
import { handleRouteError } from '@/lib/api/http';
import { logActivity } from '@/lib/activity.server';
import { reassignProjectLead } from '@/lib/members.server';

const updateMemberSchema = z.object({
  project_role: z.enum(['Project Manager', 'Member']).optional(),
  functional_role: z.string().optional(),
  role_responsibilities: z.array(z.string()).optional(),
  review_authority: z.boolean().optional(),
});

const teamRow = (projectId: string, memberId: string) =>
  and(eq(project_members.project_id, projectId), eq(project_members.member_id, memberId));

async function countProjectManagers(projectId: string) {
  const [{ value }] = await db
    .select({ value: count() })
    .from(project_members)
    .where(and(eq(project_members.project_id, projectId), eq(project_members.project_role, 'Project Manager')));
  return value;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string; memberId: string }> }
) {
  try {
    const { projectId, memberId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    const access = await getProjectAccess(user.id, projectId);
    if (!canManageProject(access)) {
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

    const target = await getProjectMembership(projectId, memberId);
    if (!target) {
      return NextResponse.json({ error: 'Team member not found' }, { status: 404 });
    }

    const roleChanging = updates.project_role !== undefined && updates.project_role !== target.project_role;
    if (roleChanging) {
      // Granting or revoking the Project Manager role is an Org Admin decision
      if (access.role !== 'Organization Admin') {
        return NextResponse.json({ error: 'Only Organization Admins can change Project Manager roles' }, { status: 403 });
      }
      if (target.project_role === 'Project Manager' && (await countProjectManagers(projectId)) <= 1) {
        return NextResponse.json({ error: 'Cannot demote the last Project Manager' }, { status: 400 });
      }
    }

    const [updatedMember] = await db
      .update(project_members)
      .set(updates)
      .where(teamRow(projectId, memberId))
      .returning();

    if (roleChanging && updates.project_role !== 'Project Manager') {
      await reassignProjectLead(projectId, memberId);
    }

    await logActivity({
      projectId,
      memberId: user.id,
      action: 'Updated',
      entityType: 'TeamMember',
      entityId: memberId,
      description: roleChanging
        ? `Changed a team member's role to ${updates.project_role}`
        : `Updated a team member's details`,
    });

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

    const access = await getProjectAccess(user.id, projectId);
    if (!canManageProject(access)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const targetMember = await getProjectMembership(projectId, memberId);
    if (!targetMember) {
      return NextResponse.json({ error: 'Team member not found' }, { status: 404 });
    }

    if (targetMember.project_role === 'Project Manager') {
      // PMs cannot remove other PMs
      if (access.role !== 'Organization Admin' && memberId !== user.id) {
        return NextResponse.json({ error: 'Only Organization Admins can remove Project Managers' }, { status: 403 });
      }
      // Never remove the last Project Manager
      if ((await countProjectManagers(projectId)) <= 1) {
        return NextResponse.json({ error: 'Cannot remove the last Project Manager' }, { status: 400 });
      }
    }

    await db.delete(project_members).where(teamRow(projectId, memberId));
    await reassignProjectLead(projectId, memberId);

    await logActivity({
      projectId,
      memberId: user.id,
      action: 'Removed',
      entityType: 'TeamMember',
      entityId: memberId,
      description: 'Removed a member from the project team',
    });

    return NextResponse.json({ message: 'Team member removed successfully' });
  } catch (error) {
    return handleRouteError(error, 'Delete project team member error');
  }
}
