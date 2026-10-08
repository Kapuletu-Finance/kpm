import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { deliverables } from '@/lib/db/schema';
import { requireApiUser } from '@/lib/auth/session';
import { canManageProject, getFeatureProjectId, getProjectAccess } from '@/lib/db/queries';
import { handleRouteError } from '@/lib/api/http';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ projectId: string, featureId: string, deliverableId: string }> }
) {
  try {
    const { projectId, featureId, deliverableId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    const [access, featureProjectId, [existing]] = await Promise.all([
      getProjectAccess(user.id, projectId),
      getFeatureProjectId(featureId),
      db
        .select({ member_id: deliverables.member_id })
        .from(deliverables)
        .where(and(eq(deliverables.id, deliverableId), eq(deliverables.entity_id, featureId)))
        .limit(1),
    ]);

    if (!access.hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!existing || featureProjectId !== projectId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

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
