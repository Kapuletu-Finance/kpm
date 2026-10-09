import { NextRequest, NextResponse } from 'next/server';
import { and, eq, ne } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { features, releases } from '@/lib/db/schema';
import { requireApiUser } from '@/lib/auth/session';
import { canManageProject, getProjectAccess } from '@/lib/db/queries';
import { handleRouteError } from '@/lib/api/http';
import { logActivity } from '@/lib/activity.server';

const releaseUpdateSchema = z.object({
  version: z.string().min(1).optional(),
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

    if (!canManageProject(await getProjectAccess(user.id, projectId))) {
      return NextResponse.json({ error: 'Only Project Managers and Admins can update releases' }, { status: 403 });
    }

    const result = releaseUpdateSchema.safeParse(await req.json());
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0]?.message || 'Validation error' }, { status: 400 });
    }

    const [previous] = await db
      .select({ status: releases.status })
      .from(releases)
      .where(releaseInProject(releaseId, projectId))
      .limit(1);
    if (!previous) return NextResponse.json({ error: 'Release not found' }, { status: 404 });

    const shipping = result.data.status === 'Released' && previous.status !== 'Released';

    const release = await db.transaction(async (tx) => {
      const [release] = await tx
        .update(releases)
        .set({
          ...result.data,
          // Default the release date to the day it shipped
          ...(shipping && !result.data.release_date && { release_date: new Date().toISOString().slice(0, 10) }),
        })
        .where(releaseInProject(releaseId, projectId))
        .returning();

      // Shipping a release ships the features in it
      if (shipping) {
        await tx
          .update(features)
          .set({ status: 'Released', completed_at: new Date() })
          .where(and(eq(features.release_id, releaseId), ne(features.status, 'Released')));
      }
      return release;
    });

    if (result.data.status && result.data.status !== previous.status) {
      await logActivity({
        projectId,
        memberId: user.id,
        action: 'Updated',
        entityType: 'Release',
        entityId: releaseId,
        description: `Moved release ${release.version} to ${release.status}`,
      });
    }

    return NextResponse.json(release);
  } catch (error) {
    return handleRouteError(error, 'Update release error');
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { projectId, releaseId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    if (!canManageProject(await getProjectAccess(user.id, projectId))) {
      return NextResponse.json({ error: 'Only Project Managers and Admins can delete releases' }, { status: 403 });
    }

    // Features keep existing; their release_id is cleared by the foreign key (on delete set null)
    const [deleted] = await db
      .delete(releases)
      .where(releaseInProject(releaseId, projectId))
      .returning({ id: releases.id, version: releases.version });
    if (!deleted) return NextResponse.json({ error: 'Release not found' }, { status: 404 });

    await logActivity({
      projectId,
      memberId: user.id,
      action: 'Deleted',
      entityType: 'Release',
      entityId: releaseId,
      description: `Deleted release ${deleted.version}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error, 'Delete release error');
  }
}
