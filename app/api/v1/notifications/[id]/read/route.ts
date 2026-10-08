import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { notifications } from '@/lib/db/schema';
import { requireApiUser } from '@/lib/auth/session';
import { handleRouteError } from '@/lib/api/http';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    // Only the recipient may mark it read
    const [data] = await db
      .update(notifications)
      .set({ is_read: true })
      .where(and(eq(notifications.id, id), eq(notifications.member_id, user.id)))
      .returning();

    if (!data) return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    return NextResponse.json(data);
  } catch (error) {
    return handleRouteError(error, 'Mark notification read error');
  }
}
