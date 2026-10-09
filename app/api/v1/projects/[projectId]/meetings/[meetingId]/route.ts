import { NextResponse } from 'next/server';
import { and, eq, getTableColumns } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { meeting_participants, meetings, members } from '@/lib/db/schema';
import { requireApiUser } from '@/lib/auth/session';
import { canManageProject, getProjectAccess, memberSummary, sprintInProject } from '@/lib/db/queries';
import { handleRouteError } from '@/lib/api/http';

const meetingUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  sprint_id: z.string().uuid().optional().nullable(),
  objective: z.string().optional(),
  agenda: z.string().optional(),
  type: z.enum(['Online', 'Physical']).optional(),
  meeting_link: z.string().url().optional().or(z.literal('')),
  location: z.string().optional(),
  start_time: z.string().datetime().optional(),
  end_time: z.string().datetime().optional(),
  minutes: z.string().optional(),
  decisions: z.string().optional(),
});

type Params = { params: Promise<{ projectId: string, meetingId: string }> };

const meetingInProject = (meetingId: string, projectId: string) =>
  and(eq(meetings.id, meetingId), eq(meetings.project_id, projectId));

async function loadMeeting(userId: string, projectId: string, meetingId: string) {
  const [access, [meeting]] = await Promise.all([
    getProjectAccess(userId, projectId),
    db
      .select({ created_by: meetings.created_by, start_time: meetings.start_time, end_time: meetings.end_time })
      .from(meetings)
      .where(meetingInProject(meetingId, projectId))
      .limit(1),
  ]);
  return { access, meeting };
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { projectId, meetingId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    const access = await getProjectAccess(user.id, projectId);
    if (!access.hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const [data] = await db
      .select({ ...getTableColumns(meetings), members: memberSummary })
      .from(meetings)
      .leftJoin(members, eq(members.id, meetings.created_by))
      .where(meetingInProject(meetingId, projectId))
      .limit(1);

    if (!data) return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    return NextResponse.json(data);
  } catch (error) {
    return handleRouteError(error, 'Fetch meeting error');
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { projectId, meetingId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    const { access, meeting } = await loadMeeting(user.id, projectId, meetingId);
    if (!access.hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!meeting) return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });

    const result = meetingUpdateSchema.safeParse(await request.json());
    if (!result.success) return NextResponse.json({ error: 'Invalid payload', details: result.error.flatten() }, { status: 400 });

    // Managers, the creator, or a participant may edit
    if (!canManageProject(access) && meeting.created_by !== user.id) {
      const [participant] = await db
        .select({ member_id: meeting_participants.member_id })
        .from(meeting_participants)
        .where(and(eq(meeting_participants.meeting_id, meetingId), eq(meeting_participants.member_id, user.id)))
        .limit(1);
      if (!participant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { start_time, end_time, ...rest } = result.data;

    if (rest.sprint_id && !(await sprintInProject(rest.sprint_id, projectId))) {
      return NextResponse.json({ error: 'Sprint not found in this project' }, { status: 404 });
    }
    const nextStart = start_time ? new Date(start_time) : meeting.start_time;
    const nextEnd = end_time ? new Date(end_time) : meeting.end_time;
    if (nextStart && nextEnd && nextEnd <= nextStart) {
      return NextResponse.json({ error: 'The meeting must end after it starts' }, { status: 400 });
    }

    const [data] = await db
      .update(meetings)
      .set({
        ...rest,
        ...(start_time !== undefined && { start_time: new Date(start_time) }),
        ...(end_time !== undefined && { end_time: new Date(end_time) }),
      })
      .where(eq(meetings.id, meetingId))
      .returning();

    return NextResponse.json(data);
  } catch (error) {
    return handleRouteError(error, 'Update meeting error');
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { projectId, meetingId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    const { access, meeting } = await loadMeeting(user.id, projectId, meetingId);
    if (!access.hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!meeting) return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });

    // Managers or the creator may delete
    if (!canManageProject(access) && meeting.created_by !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await db.delete(meetings).where(eq(meetings.id, meetingId));

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error, 'Delete meeting error');
  }
}
