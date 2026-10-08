import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, type SQL } from 'drizzle-orm';
import { db } from '@/lib/db';
import { notifications } from '@/lib/db/schema';
import { requireApiUser } from '@/lib/auth/session';
import { handleRouteError } from '@/lib/api/http';

export async function GET(req: NextRequest) {
  try {
    const { user, response } = await requireApiUser();
    if (response) return response;

    const url = new URL(req.url);
    const filter = url.searchParams.get('filter'); // 'all', 'unread'
    const type = url.searchParams.get('type'); // 'Assignment', 'Review', 'Mention', etc.

    // members.id === users.id, so the session user id is the member id
    const conditions: SQL[] = [eq(notifications.member_id, user.id)];
    if (filter === 'unread') conditions.push(eq(notifications.is_read, false));
    if (type && type !== 'All') conditions.push(eq(notifications.type, type));

    const inbox = await db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.created_at))
      .limit(200);

    return NextResponse.json(inbox);
  } catch (error) {
    return handleRouteError(error, 'List notifications error');
  }
}
