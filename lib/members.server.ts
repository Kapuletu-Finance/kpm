import { NextResponse } from 'next/server';
import { and, asc, count, eq, ne } from 'drizzle-orm';
import { db } from '@/lib/db';
import { members, project_members, projects, users } from '@/lib/db/schema';
import { getMember } from '@/lib/db/queries';
import { logActivity } from '@/lib/activity.server';

/**
 * Keeps projects.project_manager_id pointing at someone who is still a Project Manager
 * on the team, after `leavingMemberId` stops being one (demoted, removed or deactivated).
 */
export async function reassignProjectLead(projectId: string, leavingMemberId: string) {
  const [project] = await db
    .select({ project_manager_id: projects.project_manager_id })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (project?.project_manager_id !== leavingMemberId) return;

  const [nextPm] = await db
    .select({ member_id: project_members.member_id })
    .from(project_members)
    .where(
      and(
        eq(project_members.project_id, projectId),
        eq(project_members.project_role, 'Project Manager'),
        ne(project_members.member_id, leavingMemberId),
      ),
    )
    .orderBy(asc(project_members.joined_at))
    .limit(1);

  await db
    .update(projects)
    .set({ project_manager_id: nextPm?.member_id ?? null })
    .where(eq(projects.id, projectId));
}

/** Number of active Organization Admins in an organization. */
export async function countActiveAdmins(organizationId: string) {
  const [{ value }] = await db
    .select({ value: count() })
    .from(members)
    .where(
      and(
        eq(members.organization_id, organizationId),
        eq(members.organization_role, 'Organization Admin'),
        eq(members.status, 'Active'),
      ),
    );
  return value;
}

/**
 * Deactivates a member: they can no longer sign in or call the API, and they leave
 * every project team. Their standups, comments, deliverables and activity stay as history.
 * Returns the projects they left.
 */
export async function deactivateMember(memberId: string) {
  const left = await db.transaction(async (tx) => {
    await tx.update(members).set({ status: 'Inactive' }).where(eq(members.id, memberId));
    return tx
      .delete(project_members)
      .where(eq(project_members.member_id, memberId))
      .returning({ project_id: project_members.project_id });
  });

  for (const { project_id } of left) {
    if (project_id) await reassignProjectLead(project_id, memberId);
  }
  return left;
}

/**
 * Removes a member from the caller's organization, as an Org Admin.
 * - A pending invitee (never signed in) is deleted outright; there is no history to keep.
 * - Anyone else is deactivated, so their past work stays attributable.
 */
export async function removeOrganizationMember(callerId: string, memberId: string): Promise<NextResponse> {
  const [caller, target] = await Promise.all([getMember(callerId), getMember(memberId)]);

  if (!caller || caller.organization_role !== 'Organization Admin' || !caller.organization_id) {
    return NextResponse.json({ error: 'Forbidden. Only Organization Admins can remove members.' }, { status: 403 });
  }
  if (!target || target.organization_id !== caller.organization_id) {
    return NextResponse.json({ error: 'Member not found in your organization' }, { status: 404 });
  }
  if (memberId === callerId) {
    return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 400 });
  }

  if (target.status === 'Invited') {
    // Deleting the login account cascades to the member row and any team memberships.
    await db.delete(users).where(eq(users.id, memberId));
    await logActivity({
      organizationId: caller.organization_id,
      memberId: callerId,
      action: 'Revoked',
      entityType: 'Invitation',
      entityId: memberId,
      description: `Revoked the invitation for ${target.email}`,
    });
    return NextResponse.json({ message: 'Invitation revoked' });
  }

  await deactivateMember(memberId);
  await logActivity({
    organizationId: caller.organization_id,
    memberId: callerId,
    action: 'Deactivated',
    entityType: 'Member',
    entityId: memberId,
    description: `Deactivated ${target.first_name} ${target.last_name}`,
  });
  return NextResponse.json({ message: 'Member deactivated' });
}
