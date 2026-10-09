import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { deliverables } from '@/lib/db/schema';
import { requireApiUser } from '@/lib/auth/session';
import { canManageProject, getFeatureProjectId, getProjectAccess, getProjectReviewerIds } from '@/lib/db/queries';
import { handleRouteError } from '@/lib/api/http';
import { createNotification } from '@/lib/notifications.server';
import { logActivity } from '@/lib/activity.server';

const resubmitSchema = z.object({
  title: z.string().min(1).optional(),
  type: z.enum(['GitHub PR', 'Figma Link', 'API Doc', 'Document', 'Video', 'Screenshot', 'Demo', 'Commit', 'Deployment URL']).optional(),
  link: z.string().url('Must be a valid URL').optional(),
  description: z.string().optional(),
});

type Params = { params: Promise<{ projectId: string, featureId: string, deliverableId: string }> };

async function load(userId: string, projectId: string, featureId: string, deliverableId: string) {
  const [access, featureProjectId, [existing]] = await Promise.all([
    getProjectAccess(userId, projectId),
    getFeatureProjectId(featureId),
    db
      .select({ member_id: deliverables.member_id, title: deliverables.title, status: deliverables.status })
      .from(deliverables)
      .where(
        and(
          eq(deliverables.id, deliverableId),
          eq(deliverables.entity_type, 'Feature'),
          eq(deliverables.entity_id, featureId),
        ),
      )
      .limit(1),
  ]);
  return { access, existing: existing && featureProjectId === projectId ? existing : null };
}

// PATCH: the submitter revises their deliverable, which sends it back for review.
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { projectId, featureId, deliverableId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    const { access, existing } = await load(user.id, projectId, featureId, deliverableId);
    if (!access.hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (existing.member_id !== user.id) {
      return NextResponse.json({ error: 'Only the submitter can revise a deliverable' }, { status: 403 });
    }
    if (existing.status === 'Approved') {
      return NextResponse.json({ error: 'Approved deliverables cannot be changed' }, { status: 400 });
    }

    const result = resubmitSchema.safeParse(await request.json());
    if (!result.success) return NextResponse.json({ error: 'Invalid payload', details: result.error.flatten() }, { status: 400 });

    const [updated] = await db
      .update(deliverables)
      .set({ ...result.data, status: 'Submitted', submitted_at: new Date() })
      .where(eq(deliverables.id, deliverableId))
      .returning();

    const reviewers = (await getProjectReviewerIds(projectId)).filter((id) => id !== user.id);
    await Promise.all([
      ...reviewers.map((member_id) =>
        createNotification({
          member_id,
          title: 'Deliverable resubmitted',
          message: `"${updated.title}" was revised and is ready for review again.`,
          type: 'Review',
          entity_type: 'Deliverable',
          entity_id: deliverableId,
        }),
      ),
      logActivity({
        projectId,
        memberId: user.id,
        action: 'Resubmitted',
        entityType: 'Deliverable',
        entityId: deliverableId,
        description: `Resubmitted deliverable: ${updated.title}`,
      }),
    ]);

    return NextResponse.json(updated);
  } catch (error) {
    return handleRouteError(error, 'Resubmit deliverable error');
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { projectId, featureId, deliverableId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    const { access, existing } = await load(user.id, projectId, featureId, deliverableId);
    if (!access.hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // The submitter, or an admin/manager, may delete
    if (existing.member_id !== user.id && !canManageProject(access)) {
      return NextResponse.json({ error: 'Insufficient permissions to delete this deliverable' }, { status: 403 });
    }

    await db.delete(deliverables).where(eq(deliverables.id, deliverableId));

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error, 'Delete deliverable error');
  }
}
