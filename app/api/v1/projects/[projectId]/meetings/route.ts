import { NextResponse } from 'next/server';
import { asc, eq, getTableColumns } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { meeting_participants, meetings, members } from '@/lib/db/schema';
import { requireApiUser } from '@/lib/auth/session';
import { canManageProject, getProjectAccess, memberSummary, sprintInProject } from '@/lib/db/queries';
import { handleRouteError } from '@/lib/api/http';
import { logActivity } from '@/lib/activity.server';

const meetingSchema = z.object({
  title: z.string().min(1),
  sprint_id: z.string().uuid().optional().nullable(),
  objective: z.string().optional(),
  agenda: z.string().optional(),
  type: z.enum(['Online', 'Physical']).default('Online'),
  meeting_link: z.string().url().optional().or(z.literal('')),
  location: z.string().optional(),
  start_time: z.string().datetime(),
  end_time: z.string().datetime(),
});

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

    const data = await db
      .select({ ...getTableColumns(meetings), members: memberSummary })
      .from(meetings)
      .leftJoin(members, eq(members.id, meetings.created_by))
      .where(eq(meetings.project_id, projectId))
      .orderBy(asc(meetings.start_time));

    return NextResponse.json(data);
  } catch (error) {
    return handleRouteError(error, 'List meetings error');
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    const access = await getProjectAccess(user.id, projectId);
    if (!access.hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!canManageProject(access)) {
      return NextResponse.json({ error: 'Only Project Managers and Admins can schedule meetings' }, { status: 403 });
    }

    const result = meetingSchema.safeParse(await request.json());
    if (!result.success) return NextResponse.json({ error: 'Invalid payload', details: result.error.flatten() }, { status: 400 });

    const data = result.data;

    if (new Date(data.end_time) <= new Date(data.start_time)) {
      return NextResponse.json({ error: 'The meeting must end after it starts' }, { status: 400 });
    }
    if (data.sprint_id && !(await sprintInProject(data.sprint_id, projectId))) {
      return NextResponse.json({ error: 'Sprint not found in this project' }, { status: 404 });
    }

    // The creator is added as the first participant
    const meeting = await db.transaction(async (tx) => {
      const [meeting] = await tx
        .insert(meetings)
        .values({
          project_id: projectId,
          sprint_id: data.sprint_id || null,
          title: data.title,
          objective: data.objective,
          agenda: data.agenda,
          type: data.type,
          meeting_link: data.type === 'Online' ? data.meeting_link || null : null,
          location: data.type === 'Physical' ? data.location || null : null,
          start_time: new Date(data.start_time),
          end_time: new Date(data.end_time),
          created_by: user.id
        })
        .returning();

      await tx.insert(meeting_participants).values({ meeting_id: meeting.id, member_id: user.id });
      return meeting;
    });

    await logActivity({
      projectId,
      memberId: user.id,
      action: 'Scheduled',
      entityType: 'Meeting',
      entityId: meeting.id,
      description: `Scheduled meeting: ${meeting.title}`,
    });

    return NextResponse.json(meeting);
  } catch (error) {
    return handleRouteError(error, 'Create meeting error');
  }
}
