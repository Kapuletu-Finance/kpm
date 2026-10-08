import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { meeting_participants, members } from '@/lib/db/schema';
import { requireApiUser } from '@/lib/auth/session';
import { getProjectAccess, meetingInProject } from '@/lib/db/queries';
import { handleRouteError, isUniqueViolation } from '@/lib/api/http';

const participantSchema = z.object({
  member_id: z.string().uuid(),
});

type Params = { params: Promise<{ projectId: string, meetingId: string }> };

const participantColumns = {
  member_id: meeting_participants.member_id,
  joined_at: meeting_participants.joined_at,
  members: {
    id: members.id,
    first_name: members.first_name,
    last_name: members.last_name,
    avatar_url: members.avatar_url,
    email: members.email,
  },
};

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

    const data = await db
      .select(participantColumns)
      .from(meeting_participants)
      .leftJoin(members, eq(members.id, meeting_participants.member_id))
      .where(eq(meeting_participants.meeting_id, meetingId));

    return NextResponse.json(data);
  } catch (error) {
    return handleRouteError(error, 'List participants error');
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { projectId, meetingId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    const denied = await authorize(user.id, projectId, meetingId);
    if (denied) return denied;

    const result = participantSchema.safeParse(await request.json());
    if (!result.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

    try {
      await db.insert(meeting_participants).values({ meeting_id: meetingId, member_id: result.data.member_id });
    } catch (error) {
      if (isUniqueViolation(error)) return NextResponse.json({ error: 'Already a participant' }, { status: 400 });
      throw error;
    }

    const [data] = await db
      .select(participantColumns)
      .from(meeting_participants)
      .leftJoin(members, eq(members.id, meeting_participants.member_id))
      .where(and(eq(meeting_participants.meeting_id, meetingId), eq(meeting_participants.member_id, result.data.member_id)))
      .limit(1);

    return NextResponse.json(data);
  } catch (error) {
    return handleRouteError(error, 'Add participant error');
  }
}
