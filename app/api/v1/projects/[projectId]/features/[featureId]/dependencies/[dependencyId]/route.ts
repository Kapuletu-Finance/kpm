import { NextResponse } from 'next/server';
import { and, eq, or } from 'drizzle-orm';
import { db } from '@/lib/db';
import { feature_dependencies } from '@/lib/db/schema';
import { requireApiUser } from '@/lib/auth/session';
import { canManageProject, getFeatureProjectId, getProjectAccess } from '@/lib/db/queries';
import { handleRouteError } from '@/lib/api/http';

type Params = { params: Promise<{ projectId: string; featureId: string; dependencyId: string }> };

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { projectId, featureId, dependencyId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    const [access, featureProjectId] = await Promise.all([getProjectAccess(user.id, projectId), getFeatureProjectId(featureId)]);
    if (!canManageProject(access)) {
      return NextResponse.json({ error: 'Only Project Managers and Admins can unlink features' }, { status: 403 });
    }
    if (featureProjectId !== projectId) return NextResponse.json({ error: 'Feature not found in this project' }, { status: 404 });

    // The link must involve this feature (which is in this project)
    const [deleted] = await db
      .delete(feature_dependencies)
      .where(
        and(
          eq(feature_dependencies.id, dependencyId),
          or(eq(feature_dependencies.feature_id, featureId), eq(feature_dependencies.depends_on_feature_id, featureId)),
        ),
      )
      .returning({ id: feature_dependencies.id });
    if (!deleted) return NextResponse.json({ error: 'Dependency not found' }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error, 'Delete dependency error');
  }
}
