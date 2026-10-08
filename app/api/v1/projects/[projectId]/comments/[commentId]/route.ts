import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { comments } from '@/lib/db/schema';
import { requireApiUser } from '@/lib/auth/session';
import { canManageProject, getProjectAccess } from '@/lib/db/queries';
import { handleRouteError } from '@/lib/api/http';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ projectId: string, commentId: string }> }
) {
  try {
    const { projectId, commentId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    const [access, [existingComment]] = await Promise.all([
      getProjectAccess(user.id, projectId),
      db.select({ member_id: comments.member_id }).from(comments).where(eq(comments.id, commentId)).limit(1),
    ]);

    if (!access.hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!existingComment) return NextResponse.json({ error: 'Comment not found' }, { status: 404 });

    // Managers, or the author, may delete
    if (!canManageProject(access) && existingComment.member_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await db.delete(comments).where(eq(comments.id, commentId));

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error, 'Delete comment error');
  }
}
