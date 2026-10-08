import { NextRequest, NextResponse } from 'next/server';
import { desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { features, releases } from '@/lib/db/schema';
import { requireApiUser } from '@/lib/auth/session';
import { getProjectAccess } from '@/lib/db/queries';
import { handleRouteError } from '@/lib/api/http';
import { logActivity } from '@/lib/activity.server';

const releaseSchema = z.object({
  version: z.string().min(1, 'Version is required'),
  title: z.string().optional(),
  release_notes: z.string().optional(),
  deployment_checklist: z.array(z.any()).optional().default([]),
  rollback_plan: z.string().optional(),
  release_date: z.string().optional().nullable(),
  status: z.enum(['Planned', 'Staging', 'Released', 'Rolled Back']).default('Planned'),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    if (!(await getProjectAccess(user.id, projectId)).hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const rows = await db
      .select()
      .from(releases)
      .where(eq(releases.project_id, projectId))
      .orderBy(desc(releases.created_at));

    const releaseFeatures = rows.length
      ? await db
          .select({ release_id: features.release_id, id: features.id, title: features.title, status: features.status })
          .from(features)
          .where(inArray(features.release_id, rows.map((r) => r.id)))
      : [];

    return NextResponse.json(
      rows.map((release) => ({
        ...release,
        features: releaseFeatures
          .filter((f) => f.release_id === release.id)
          .map((f) => ({ id: f.id, title: f.title, status: f.status })),
      })),
    );
  } catch (error) {
    return handleRouteError(error, 'List releases error');
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    if (!(await getProjectAccess(user.id, projectId)).hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const result = releaseSchema.safeParse(await req.json());
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0]?.message || 'Validation error' }, { status: 400 });
    }

    const [release] = await db
      .insert(releases)
      .values({
        project_id: projectId,
        version: result.data.version,
        title: result.data.title || null,
        release_notes: result.data.release_notes || null,
        deployment_checklist: result.data.deployment_checklist,
        rollback_plan: result.data.rollback_plan || null,
        release_date: result.data.release_date || null,
        status: result.data.status,
      })
      .returning();

    await logActivity({
      projectId,
      memberId: user.id,
      action: 'Created',
      entityType: 'Release',
      entityId: release.id,
      description: `Drafted a new release: ${release.version} ${release.title ? `- ${release.title}` : ''}`
    });

    return NextResponse.json(release, { status: 201 });
  } catch (error) {
    return handleRouteError(error, 'Create release error');
  }
}
