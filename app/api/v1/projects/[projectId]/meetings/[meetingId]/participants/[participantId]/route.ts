import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { meeting_participants, meetings } from '@/lib/db/schema';
import { requireApiUser } from '@/lib/auth/session';
import { canManageProject, getProjectAccess } from '@/lib/db/queries';
import { handleRouteError } from '@/lib/api/http';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ projectId: string, meetingId: string, participantId: string }> }
) {
  try {
    const { projectId, meetingId, participantId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    const [access, [meeting]] = await Promise.all([
      getProjectAccess(user.id, projectId),
      db
        .select({ created_by: meetings.created_by })
        .from(meetings)
        .where(and(eq(meetings.id, meetingId), eq(meetings.project_id, projectId)))
        .limit(1),
    ]);
    if (!access.hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!meeting) return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });

    // Managers and the organizer manage the list; anyone may remove themselves
    if (!canManageProject(access) && meeting.created_by !== user.id && participantId !== user.id) {
      return NextResponse.json({ error: 'Only the organizer or a project manager can remove participants' }, { status: 403 });
    }

    await db
      .delete(meeting_participants)
      .where(and(eq(meeting_participants.meeting_id, meetingId), eq(meeting_participants.member_id, participantId)));

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error, 'Remove participant error');
  }
}
