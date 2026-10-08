import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { meeting_participants } from '@/lib/db/schema';
import { requireApiUser } from '@/lib/auth/session';
import { getProjectAccess, meetingInProject } from '@/lib/db/queries';
import { handleRouteError } from '@/lib/api/http';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ projectId: string, meetingId: string, participantId: string }> }
) {
  try {
    const { projectId, meetingId, participantId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    const [access, inProject] = await Promise.all([
      getProjectAccess(user.id, projectId),
      meetingInProject(meetingId, projectId),
    ]);
    if (!access.hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!inProject) return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });

    await db
      .delete(meeting_participants)
      .where(and(eq(meeting_participants.meeting_id, meetingId), eq(meeting_participants.member_id, participantId)));

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error, 'Remove participant error');
  }
}
