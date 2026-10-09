import { NextResponse } from 'next/server';
import { and, asc, eq, ne, or } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { db } from '@/lib/db';
import { feature_dependencies, features, modules, roadmaps } from '@/lib/db/schema';
import { requireApiUser } from '@/lib/auth/session';
import { canManageProject, getFeatureProjectId, getProjectAccess } from '@/lib/db/queries';
import { handleRouteError } from '@/lib/api/http';
import { logActivity } from '@/lib/activity.server';

// A row reads "feature <dependency_type> depends_on_feature", e.g. "Login is Blocked By Signup".
const dependencySchema = z.object({
  depends_on_feature_id: z.string().uuid(),
  dependency_type: z.enum(['Blocks', 'Blocked By', 'Relates To']).default('Blocked By'),
  notes: z.string().optional(),
});

// Seen from the other feature, a relation reads the opposite way
const INVERSE: Record<string, string> = { Blocks: 'Blocked By', 'Blocked By': 'Blocks', 'Relates To': 'Relates To' };

type Params = { params: Promise<{ projectId: string; featureId: string }> };

async function authorize(userId: string, projectId: string, featureId: string) {
  const [access, featureProjectId] = await Promise.all([getProjectAccess(userId, projectId), getFeatureProjectId(featureId)]);
  if (!access.hasAccess) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  if (featureProjectId !== projectId) return { error: NextResponse.json({ error: 'Feature not found in this project' }, { status: 404 }) };
  return { access };
}

/** Both directions, each phrased from this feature's point of view. */
async function listDependencies(featureId: string) {
  const other = alias(features, 'other');
  const rows = await db
    .select({
      id: feature_dependencies.id,
      feature_id: feature_dependencies.feature_id,
      depends_on_feature_id: feature_dependencies.depends_on_feature_id,
      dependency_type: feature_dependencies.dependency_type,
      notes: feature_dependencies.notes,
      created_at: feature_dependencies.created_at,
      other_id: other.id,
      other_title: other.title,
      other_status: other.status,
    })
    .from(feature_dependencies)
    .innerJoin(
      other,
      or(
        and(eq(feature_dependencies.feature_id, featureId), eq(other.id, feature_dependencies.depends_on_feature_id)),
        and(eq(feature_dependencies.depends_on_feature_id, featureId), eq(other.id, feature_dependencies.feature_id)),
      ),
    )
    .where(or(eq(feature_dependencies.feature_id, featureId), eq(feature_dependencies.depends_on_feature_id, featureId)));

  return rows.map((r) => {
    const outgoing = r.feature_id === featureId;
    const relation = outgoing ? r.dependency_type ?? 'Relates To' : INVERSE[r.dependency_type ?? 'Relates To'];
    return {
      id: r.id,
      relation,
      notes: r.notes,
      created_at: r.created_at,
      feature: { id: r.other_id, title: r.other_title, status: r.other_status },
      // This feature cannot finish until the other one ships
      blocking: relation === 'Blocked By' && r.other_status !== 'Released',
    };
  });
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { projectId, featureId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    const { error } = await authorize(user.id, projectId, featureId);
    if (error) return error;

    // ?candidates=1 : the other features in this project, for the "link a feature" picker
    if (new URL(request.url).searchParams.get('candidates')) {
      const candidates = await db
        .select({ id: features.id, title: features.title, status: features.status, module_name: modules.name })
        .from(features)
        .innerJoin(modules, eq(modules.id, features.module_id))
        .innerJoin(roadmaps, eq(roadmaps.id, modules.roadmap_id))
        .where(and(eq(roadmaps.project_id, projectId), ne(features.id, featureId)))
        .orderBy(asc(features.title));
      return NextResponse.json(candidates);
    }

    return NextResponse.json(await listDependencies(featureId));
  } catch (error) {
    return handleRouteError(error, 'List dependencies error');
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { projectId, featureId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    const { error, access } = await authorize(user.id, projectId, featureId);
    if (error) return error;
    if (!canManageProject(access!)) {
      return NextResponse.json({ error: 'Only Project Managers and Admins can link features' }, { status: 403 });
    }

    const result = dependencySchema.safeParse(await request.json());
    if (!result.success) return NextResponse.json({ error: 'Invalid payload', details: result.error.flatten() }, { status: 400 });
    const { depends_on_feature_id: otherId, dependency_type, notes } = result.data;

    if (otherId === featureId) return NextResponse.json({ error: 'A feature cannot depend on itself' }, { status: 400 });
    if ((await getFeatureProjectId(otherId)) !== projectId) {
      return NextResponse.json({ error: 'The other feature must be in this project' }, { status: 404 });
    }

    // One relation per pair, in either direction
    const [existing] = await db
      .select({ id: feature_dependencies.id })
      .from(feature_dependencies)
      .where(
        or(
          and(eq(feature_dependencies.feature_id, featureId), eq(feature_dependencies.depends_on_feature_id, otherId)),
          and(eq(feature_dependencies.feature_id, otherId), eq(feature_dependencies.depends_on_feature_id, featureId)),
        ),
      )
      .limit(1);
    if (existing) return NextResponse.json({ error: 'These features are already linked' }, { status: 400 });

    const [row] = await db
      .insert(feature_dependencies)
      .values({ feature_id: featureId, depends_on_feature_id: otherId, dependency_type, notes })
      .returning({ id: feature_dependencies.id });

    await logActivity({
      projectId,
      memberId: user.id,
      action: 'Linked',
      entityType: 'Feature',
      entityId: featureId,
      description: `Added a "${dependency_type}" dependency between features`,
    });

    return NextResponse.json({ id: row.id }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, 'Create dependency error');
  }
}
