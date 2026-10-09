import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { daily_updates } from '@/lib/db/schema';
import { requireApiUser } from '@/lib/auth/session';
import { canManageProject, getProjectAccess } from '@/lib/db/queries';
import { handleRouteError } from '@/lib/api/http';
import { createNotification } from '@/lib/notifications.server';

// The author edits their own update; managers add feedback.
const authorFields = z.object({
  yesterday: z.string().min(1).optional(),
  today: z.string().min(1).optional(),
  blockers: z.string().optional(),
  risks: z.string().optional(),
  help_needed: z.string().optional(),
});
const updateStandupSchema = authorFields.extend({
  manager_comments: z.string().optional(),
});

type Params = { params: Promise<{ projectId: string; standupId: string }> };

const standupInProject = (standupId: string, projectId: string) =>
  and(eq(daily_updates.id, standupId), eq(daily_updates.project_id, projectId));

async function load(userId: string, projectId: string, standupId: string) {
  const [access, [standup]] = await Promise.all([
    getProjectAccess(userId, projectId),
    db
      .select({ member_id: daily_updates.member_id })
      .from(daily_updates)
      .where(standupInProject(standupId, projectId))
      .limit(1),
  ]);
  return { access, standup };
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { projectId, standupId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    const { access, standup } = await load(user.id, projectId, standupId);
    if (!access.hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!standup) return NextResponse.json({ error: 'Standup not found' }, { status: 404 });

    const result = updateStandupSchema.safeParse(await request.json());
    if (!result.success) return NextResponse.json({ error: 'Invalid payload', details: result.error.flatten() }, { status: 400 });

    const { manager_comments, ...authorChanges } = result.data;
    const editsContent = Object.values(authorChanges).some((v) => v !== undefined);
    const isAuthor = standup.member_id === user.id;
    const isManager = canManageProject(access);

    if (editsContent && !isAuthor) {
      return NextResponse.json({ error: 'Only the author can edit a standup' }, { status: 403 });
    }
    if (manager_comments !== undefined && !isManager) {
      return NextResponse.json({ error: 'Only managers can leave feedback' }, { status: 403 });
    }

    const [updated] = await db
      .update(daily_updates)
      .set(result.data)
      .where(standupInProject(standupId, projectId))
      .returning();

    // Let the author know a manager responded
    if (manager_comments && standup.member_id && standup.member_id !== user.id) {
      await createNotification({
        member_id: standup.member_id,
        title: 'Feedback on your standup',
        message: manager_comments.slice(0, 200),
        type: 'Review',
        entity_type: 'Project',
        entity_id: projectId,
      });
    }

    return NextResponse.json(updated);
  } catch (error) {
    return handleRouteError(error, 'Update standup error');
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { projectId, standupId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    const { access, standup } = await load(user.id, projectId, standupId);
    if (!access.hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!standup) return NextResponse.json({ error: 'Standup not found' }, { status: 404 });

    if (standup.member_id !== user.id && !canManageProject(access)) {
      return NextResponse.json({ error: 'Only the author or a manager can delete a standup' }, { status: 403 });
    }

    await db.delete(daily_updates).where(standupInProject(standupId, projectId));
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error, 'Delete standup error');
  }
}
