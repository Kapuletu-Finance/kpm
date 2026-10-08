import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { daily_updates } from '@/lib/db/schema';
import { requireApiUser } from '@/lib/auth/session';
import { canManageProject, getProjectAccess } from '@/lib/db/queries';
import { handleRouteError } from '@/lib/api/http';

const updateStandupSchema = z.object({
  manager_comments: z.string().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string; standupId: string }> }
) {
  try {
    const { projectId, standupId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    const access = await getProjectAccess(user.id, projectId);
    if (!access.hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!canManageProject(access)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const result = updateStandupSchema.safeParse(await request.json());
    if (!result.success) return NextResponse.json({ error: 'Invalid payload', details: result.error.flatten() }, { status: 400 });

    const [standup] = await db
      .update(daily_updates)
      .set(result.data)
      .where(and(eq(daily_updates.id, standupId), eq(daily_updates.project_id, projectId)))
      .returning();

    if (!standup) return NextResponse.json({ error: 'Standup not found' }, { status: 404 });
    return NextResponse.json(standup);
  } catch (error) {
    return handleRouteError(error, 'Update standup error');
  }
}
