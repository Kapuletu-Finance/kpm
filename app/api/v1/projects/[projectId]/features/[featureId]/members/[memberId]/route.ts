import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { feature_members } from '@/lib/db/schema';
import { requireApiUser } from '@/lib/auth/session';
import { canManageProject, getFeatureProjectId, getProjectAccess } from '@/lib/db/queries';
import { handleRouteError } from '@/lib/api/http';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ projectId: string; featureId: string; memberId: string }> }
) {
  try {
    const { projectId, featureId, memberId } = await params;
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

    // `memberId` is the member's id (feature_members.member_id)
    await db
      .delete(feature_members)
      .where(and(eq(feature_members.feature_id, featureId), eq(feature_members.member_id, memberId)));

    return NextResponse.json({ message: 'Member removed from feature successfully' });
  } catch (error) {
    return handleRouteError(error, 'Remove feature member error');
  }
}
