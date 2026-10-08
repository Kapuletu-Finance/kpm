import { NextResponse } from 'next/server';
import { and, desc, eq, isNull, ne } from 'drizzle-orm';
import { db } from '@/lib/db';
import { features, modules, roadmaps } from '@/lib/db/schema';
import { requireApiUser } from '@/lib/auth/session';
import { getProjectAccess } from '@/lib/db/queries';
import { handleRouteError } from '@/lib/api/http';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    const access = await getProjectAccess(user.id, projectId);
    if (!access.hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Project features not in a sprint and not yet released
    const backlog = await db
      .select({
        id: features.id,
        module_id: features.module_id,
        title: features.title,
        description: features.description,
        priority: features.priority,
        status: features.status,
        module_name: modules.name,
      })
      .from(features)
      .innerJoin(modules, eq(modules.id, features.module_id))
      .innerJoin(roadmaps, eq(roadmaps.id, modules.roadmap_id))
      .where(and(eq(roadmaps.project_id, projectId), isNull(features.sprint_id), ne(features.status, 'Released')))
      .orderBy(desc(features.created_at));

    // Keep the nested `modules.roadmaps` shape the UI reads
    return NextResponse.json(
      backlog.map(({ module_name, ...feature }) => ({
        ...feature,
        modules: { name: module_name, roadmaps: { project_id: projectId } },
      })),
    );
  } catch (error) {
    return handleRouteError(error, 'Fetch backlog features error');
  }
}
