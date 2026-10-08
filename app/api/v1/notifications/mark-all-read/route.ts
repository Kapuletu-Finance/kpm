import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { notifications } from '@/lib/db/schema';
import { requireApiUser } from '@/lib/auth/session';
import { handleRouteError } from '@/lib/api/http';

export async function POST() {
  try {
    const { user, response } = await requireApiUser();
    if (response) return response;

    await db
      .update(notifications)
      .set({ is_read: true })
      .where(and(eq(notifications.member_id, user.id), eq(notifications.is_read, false)));

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error, 'Mark all notifications read error');
  }
}
