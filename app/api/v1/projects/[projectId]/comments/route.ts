import { NextResponse } from 'next/server';
import { and, asc, eq, getTableColumns, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { comments, members } from '@/lib/db/schema';
import { requireApiUser } from '@/lib/auth/session';
import { getProjectAccess, memberSummary } from '@/lib/db/queries';
import { handleRouteError } from '@/lib/api/http';

const commentSchema = z.object({
  entity_type: z.enum(['Feature', 'Deliverable', 'Meeting', 'Project', 'Module']),
  entity_id: z.string().uuid(),
  comment: z.string().min(1),
  parent_comment_id: z.string().uuid().optional().nullable(),
});

type Params = { params: Promise<{ projectId: string }> };

const selectComments = (where: SQL | undefined) =>
  db
    .select({ ...getTableColumns(comments), members: memberSummary })
    .from(comments)
    .leftJoin(members, eq(members.id, comments.member_id))
    .where(where);

export async function GET(request: Request, { params }: Params) {
  try {
    const { projectId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    if (!(await getProjectAccess(user.id, projectId)).hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entityType');
    const entityId = searchParams.get('entityId');

    if (!entityType || !entityId) {
      return NextResponse.json({ error: 'Missing entityType or entityId' }, { status: 400 });
    }

    // Oldest first for threads
    const data = await selectComments(
      and(eq(comments.entity_type, entityType), eq(comments.entity_id, entityId)),
    ).orderBy(asc(comments.created_at));

    return NextResponse.json(data);
  } catch (error) {
    return handleRouteError(error, 'List comments error');
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { projectId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    if (!(await getProjectAccess(user.id, projectId)).hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const result = commentSchema.safeParse(await request.json());
    if (!result.success) return NextResponse.json({ error: 'Invalid payload', details: result.error.flatten() }, { status: 400 });

    const [created] = await db
      .insert(comments)
      .values({
        entity_type: result.data.entity_type,
        entity_id: result.data.entity_id,
        member_id: user.id,
        comment: result.data.comment,
        parent_comment_id: result.data.parent_comment_id || null
      })
      .returning({ id: comments.id });

    const [comment] = await selectComments(eq(comments.id, created.id));
    return NextResponse.json(comment);
  } catch (error) {
    return handleRouteError(error, 'Create comment error');
  }
}
