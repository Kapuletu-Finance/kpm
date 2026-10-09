import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { meeting_action_items } from '@/lib/db/schema';
import { requireApiUser } from '@/lib/auth/session';
import { getProjectAccess, meetingInProject, memberInProjectOrg, selectActionItems } from '@/lib/db/queries';
import { createNotification } from '@/lib/notifications.server';
import { handleRouteError } from '@/lib/api/http';

const actionItemSchema = z.object({
  description: z.string().min(1),
  assigned_to: z.string().uuid().optional().nullable(),
  status: z.enum(['Pending', 'In Progress', 'Completed']).default('Pending'),
  due_date: z.string().optional().nullable(),
});

type Params = { params: Promise<{ projectId: string, meetingId: string }> };

async function authorize(userId: string, projectId: string, meetingId: string) {
  const [access, inProject] = await Promise.all([
    getProjectAccess(userId, projectId),
    meetingInProject(meetingId, projectId),
  ]);
  if (!access.hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!inProject) return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
  return null;
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { projectId, meetingId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    const denied = await authorize(user.id, projectId, meetingId);
    if (denied) return denied;

    const data = await selectActionItems(eq(meeting_action_items.meeting_id, meetingId))
      .orderBy(asc(meeting_action_items.created_at));

    return NextResponse.json(data);
  } catch (error) {
    return handleRouteError(error, 'List action items error');
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { projectId, meetingId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    const denied = await authorize(user.id, projectId, meetingId);
    if (denied) return denied;

    const result = actionItemSchema.safeParse(await request.json());
    if (!result.success) return NextResponse.json({ error: 'Invalid payload', details: result.error.flatten() }, { status: 400 });

    const assignee = result.data.assigned_to;
    if (assignee && !(await memberInProjectOrg(assignee, projectId))) {
      return NextResponse.json({ error: 'Assignee not found in your organization' }, { status: 404 });
    }

    const [created] = await db
      .insert(meeting_action_items)
      .values({
        meeting_id: meetingId,
        description: result.data.description,
        assigned_to: result.data.assigned_to || null,
        status: result.data.status,
        due_date: result.data.due_date || null
      })
      .returning({ id: meeting_action_items.id });

    if (assignee && assignee !== user.id) {
      await createNotification({
        member_id: assignee,
        title: 'New action item assigned to you',
        message: result.data.description,
        type: 'Assignment',
        entity_type: 'Meeting',
        entity_id: meetingId,
      });
    }

    const [data] = await selectActionItems(eq(meeting_action_items.id, created.id));
    return NextResponse.json(data);
  } catch (error) {
    return handleRouteError(error, 'Create action item error');
  }
}
