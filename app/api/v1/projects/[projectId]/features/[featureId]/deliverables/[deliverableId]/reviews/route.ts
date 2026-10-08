import { NextResponse } from 'next/server';
import { and, desc, eq, getTableColumns } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { deliverables, members, reviews } from '@/lib/db/schema';
import { requireApiUser } from '@/lib/auth/session';
import { canManageProject, getFeatureProjectId, getProjectAccess, memberSummary } from '@/lib/db/queries';
import { handleRouteError } from '@/lib/api/http';
import { createNotification } from '@/lib/notifications.server';
import { logActivity } from '@/lib/activity.server';

const reviewSchema = z.object({
  decision: z.enum(['Approved', 'Changes Requested', 'Rejected']),
  comments: z.string().optional(),
});

type Params = { params: Promise<{ projectId: string, featureId: string, deliverableId: string }> };

/** Loads access plus the deliverable, confirming it belongs to this feature and project. */
async function load(userId: string, projectId: string, featureId: string, deliverableId: string) {
  const [access, featureProjectId, [deliverable]] = await Promise.all([
    getProjectAccess(userId, projectId),
    getFeatureProjectId(featureId),
    db
      .select({ title: deliverables.title, member_id: deliverables.member_id })
      .from(deliverables)
      .where(and(eq(deliverables.id, deliverableId), eq(deliverables.entity_id, featureId)))
      .limit(1),
  ]);
  const found = !!deliverable && featureProjectId === projectId;
  return { access, deliverable: found ? deliverable : null };
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { projectId, featureId, deliverableId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    const { access, deliverable } = await load(user.id, projectId, featureId, deliverableId);
    if (!access.hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!deliverable) return NextResponse.json({ error: 'Deliverable not found' }, { status: 404 });

    const data = await db
      .select({ ...getTableColumns(reviews), members: memberSummary })
      .from(reviews)
      .leftJoin(members, eq(members.id, reviews.reviewer_id))
      .where(eq(reviews.deliverable_id, deliverableId))
      .orderBy(desc(reviews.created_at));

    return NextResponse.json(data);
  } catch (error) {
    return handleRouteError(error, 'List reviews error');
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { projectId, featureId, deliverableId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    const { access, deliverable } = await load(user.id, projectId, featureId, deliverableId);
    if (!access.hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!canManageProject(access)) {
      return NextResponse.json({ error: 'Only Project Managers and Admins can review deliverables' }, { status: 403 });
    }
    if (!deliverable) return NextResponse.json({ error: 'Deliverable not found' }, { status: 404 });

    const result = reviewSchema.safeParse(await request.json());
    if (!result.success) return NextResponse.json({ error: 'Invalid payload', details: result.error.flatten() }, { status: 400 });

    const { decision, comments } = result.data;

    // The review and the deliverable's new status are saved together
    const review = await db.transaction(async (tx) => {
      const [review] = await tx
        .insert(reviews)
        .values({
          deliverable_id: deliverableId,
          reviewer_id: user.id,
          decision,
          comments,
          reviewed_at: new Date(),
        })
        .returning();

      await tx.update(deliverables).set({ status: decision }).where(eq(deliverables.id, deliverableId));
      return review;
    });

    await Promise.all([
      deliverable.member_id &&
        createNotification({
          member_id: deliverable.member_id,
          title: `Deliverable ${decision}`,
          message: `Your deliverable "${deliverable.title}" was reviewed and marked as ${decision}.`,
          type: 'Review',
          entity_type: 'Deliverable',
          entity_id: deliverableId
        }),
      logActivity({
        projectId,
        memberId: user.id,
        action: 'Reviewed',
        entityType: 'Deliverable',
        entityId: deliverableId,
        description: `Submitted a review (${decision}) for deliverable: ${deliverable.title}`
      }),
    ]);

    return NextResponse.json(review);
  } catch (error) {
    return handleRouteError(error, 'Create review error');
  }
}
