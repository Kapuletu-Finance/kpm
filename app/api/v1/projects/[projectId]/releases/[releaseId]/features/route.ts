import { NextRequest, NextResponse } from 'next/server';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { features, modules, releases, roadmaps } from '@/lib/db/schema';
import { requireApiUser } from '@/lib/auth/session';
import { getProjectAccess } from '@/lib/db/queries';
import { handleRouteError } from '@/lib/api/http';

const assignFeaturesSchema = z.object({
  featureIds: z.array(z.string().uuid()),
  action: z.enum(['assign', 'remove']),
});

type Params = { params: Promise<{ projectId: string, releaseId: string }> };

// ids of this project's features (features -> modules -> roadmaps)
const projectFeatureIds = (projectId: string) =>
  db
    .select({ id: features.id })
    .from(features)
    .innerJoin(modules, eq(modules.id, features.module_id))
    .innerJoin(roadmaps, eq(roadmaps.id, modules.roadmap_id))
    .where(eq(roadmaps.project_id, projectId));

// GET ?unassigned=1 : the project's features not yet in any release
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { projectId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    if (!(await getProjectAccess(user.id, projectId)).hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const data = await db
      .select({ id: features.id, title: features.title, status: features.status, priority: features.priority })
      .from(features)
      .where(and(inArray(features.id, projectFeatureIds(projectId)), isNull(features.release_id)));

    return NextResponse.json(data);
  } catch (error) {
    return handleRouteError(error, 'List unassigned features error');
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { projectId, releaseId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    if (!(await getProjectAccess(user.id, projectId)).hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const result = assignFeaturesSchema.safeParse(await req.json());
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0]?.message || 'Validation error' }, { status: 400 });
    }

    const { featureIds, action } = result.data;
    if (featureIds.length === 0) {
      return NextResponse.json({ success: true });
    }

    const [release] = await db
      .select({ id: releases.id })
      .from(releases)
      .where(and(eq(releases.id, releaseId), eq(releases.project_id, projectId)))
      .limit(1);

    if (!release) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 });
    }

    // Only this project's features can be (un)assigned
    await db
      .update(features)
      .set({ release_id: action === 'assign' ? releaseId : null })
      .where(and(inArray(features.id, featureIds), inArray(features.id, projectFeatureIds(projectId))));

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error, 'Assign release features error');
  }
}
