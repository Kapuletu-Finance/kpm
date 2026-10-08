import { after, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { feature_members, features, members, projects } from '@/lib/db/schema';
import { requireApiUser } from '@/lib/auth/session';
import {
  canManageProject,
  getFeatureProjectId,
  getProjectAccess,
  getProjectMembership,
} from '@/lib/db/queries';
import { handleRouteError } from '@/lib/api/http';
import { createNotification } from '@/lib/notifications.server';
import { logActivity } from '@/lib/activity.server';
import { sendFeatureAssignmentEmail } from '@/lib/email.server';

const assignMemberSchema = z.object({
  member_id: z.string().uuid("Invalid member ID"),
  responsibility: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string; featureId: string }> }
) {
  try {
    const { projectId, featureId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    const access = await getProjectAccess(user.id, projectId);
    if (!access.hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!canManageProject(access)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    if ((await getFeatureProjectId(featureId)) !== projectId) {
      return NextResponse.json({ error: 'Feature not found in this project' }, { status: 404 });
    }

    const result = assignMemberSchema.safeParse(await request.json());
    if (!result.success) return NextResponse.json({ error: 'Invalid payload', details: result.error.flatten() }, { status: 400 });

    const { member_id, responsibility } = result.data;

    // The assignee must be on the project and not already assigned
    const [isProjectMember, [existing]] = await Promise.all([
      getProjectMembership(projectId, member_id),
      db
        .select({ id: feature_members.id })
        .from(feature_members)
        .where(and(eq(feature_members.feature_id, featureId), eq(feature_members.member_id, member_id)))
        .limit(1),
    ]);

    if (!isProjectMember) return NextResponse.json({ error: 'User is not a member of this project' }, { status: 400 });
    if (existing) return NextResponse.json({ error: 'Member is already assigned to this feature' }, { status: 400 });

    const [created] = await db
      .insert(feature_members)
      .values({ feature_id: featureId, member_id, responsibility })
      .returning({ id: feature_members.id, member_id: feature_members.member_id, responsibility: feature_members.responsibility });

    const [[assignee], [feature], [project]] = await Promise.all([
      db
        .select({ first_name: members.first_name, last_name: members.last_name, email: members.email, avatar_url: members.avatar_url })
        .from(members)
        .where(eq(members.id, member_id))
        .limit(1),
      db.select({ title: features.title }).from(features).where(eq(features.id, featureId)).limit(1),
      db.select({ name: projects.name }).from(projects).where(eq(projects.id, projectId)).limit(1),
    ]);

    const featureTitle = feature?.title || 'Unknown';

    await Promise.all([
      createNotification({
        member_id,
        title: `You have been assigned to a feature`,
        message: `You were assigned as ${responsibility || 'a member'} to feature: ${featureTitle}`,
        type: 'Assignment',
        entity_type: 'Feature',
        entity_id: featureId
      }),
      logActivity({
        projectId,
        memberId: user.id,
        action: 'Assigned',
        entityType: 'Feature',
        entityId: featureId,
        description: `Assigned a member to feature: ${featureTitle}`
      }),
    ]);

    if (assignee?.email) {
      const caller = access.member;
      after(() =>
        sendFeatureAssignmentEmail({
          toEmail: assignee.email,
          assigneeName: assignee.first_name || 'Team Member',
          projectName: project?.name || 'Your Project',
          featureName: feature?.title || 'Unknown Feature',
          assignerName: `${caller.first_name} ${caller.last_name}`.trim() || 'Project Manager',
          responsibility,
          projectId,
          featureId
        })
      );
    }

    return NextResponse.json({ ...created, members: assignee ?? null }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, 'Assign feature member error');
  }
}
