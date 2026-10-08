import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { features, releases } from '@/lib/db/schema';
import { requireApiUser } from '@/lib/auth/session';
import { getProjectAccess } from '@/lib/db/queries';
import { handleRouteError } from '@/lib/api/http';

const releaseUpdateSchema = z.object({
  title: z.string().optional(),
  release_notes: z.string().optional(),
  deployment_checklist: z.array(z.any()).optional(),
  rollback_plan: z.string().optional(),
  release_date: z.string().optional().nullable(),
  status: z.enum(['Planned', 'Staging', 'Released', 'Rolled Back']).optional(),
});

type Params = { params: Promise<{ projectId: string, releaseId: string }> };

const releaseInProject = (releaseId: string, projectId: string) =>
  and(eq(releases.id, releaseId), eq(releases.project_id, projectId));

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { projectId, releaseId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    const [access, [release], releaseFeatures] = await Promise.all([
      getProjectAccess(user.id, projectId),
      db.select().from(releases).where(releaseInProject(releaseId, projectId)).limit(1),
      db
        .select({ id: features.id, title: features.title, status: features.status, priority: features.priority })
        .from(features)
        .where(eq(features.release_id, releaseId)),
    ]);

    if (!access.hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!release) return NextResponse.json({ error: 'Release not found' }, { status: 404 });

    return NextResponse.json({ ...release, features: releaseFeatures });
  } catch (error) {
    return handleRouteError(error, 'Fetch release error');
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { projectId, releaseId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    if (!(await getProjectAccess(user.id, projectId)).hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const result = releaseUpdateSchema.safeParse(await req.json());
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0]?.message || 'Validation error' }, { status: 400 });
    }

    const [release] = await db
      .update(releases)
      .set(result.data)
      .where(releaseInProject(releaseId, projectId))
      .returning();

    if (!release) return NextResponse.json({ error: 'Release not found' }, { status: 404 });
    return NextResponse.json(release);
  } catch (error) {
    return handleRouteError(error, 'Update release error');
  }
}
