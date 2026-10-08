import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { meeting_action_items } from '@/lib/db/schema';
import { requireApiUser } from '@/lib/auth/session';
import { getProjectAccess, meetingInProject, selectActionItems } from '@/lib/db/queries';
import { handleRouteError } from '@/lib/api/http';

const actionItemUpdateSchema = z.object({
  description: z.string().min(1).optional(),
  assigned_to: z.string().uuid().optional().nullable(),
  status: z.enum(['Pending', 'In Progress', 'Completed']).optional(),
  due_date: z.string().optional().nullable(),
});

type Params = { params: Promise<{ projectId: string, meetingId: string, actionItemId: string }> };

const itemInMeeting = (actionItemId: string, meetingId: string) =>
  and(eq(meeting_action_items.id, actionItemId), eq(meeting_action_items.meeting_id, meetingId));

async function authorize(userId: string, projectId: string, meetingId: string) {
  const [access, inProject] = await Promise.all([
    getProjectAccess(userId, projectId),
    meetingInProject(meetingId, projectId),
  ]);
  if (!access.hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!inProject) return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
  return null;
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { projectId, meetingId, actionItemId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    const denied = await authorize(user.id, projectId, meetingId);
    if (denied) return denied;

    const result = actionItemUpdateSchema.safeParse(await request.json());
    if (!result.success) return NextResponse.json({ error: 'Invalid payload', details: result.error.flatten() }, { status: 400 });

    const [updated] = await db
      .update(meeting_action_items)
      .set(result.data)
      .where(itemInMeeting(actionItemId, meetingId))
      .returning({ id: meeting_action_items.id });
    if (!updated) return NextResponse.json({ error: 'Action item not found' }, { status: 404 });

    const [data] = await selectActionItems(eq(meeting_action_items.id, actionItemId));
    return NextResponse.json(data);
  } catch (error) {
    return handleRouteError(error, 'Update action item error');
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { projectId, meetingId, actionItemId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    const denied = await authorize(user.id, projectId, meetingId);
    if (denied) return denied;

    await db.delete(meeting_action_items).where(itemInMeeting(actionItemId, meetingId));

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error, 'Delete action item error');
  }
}
