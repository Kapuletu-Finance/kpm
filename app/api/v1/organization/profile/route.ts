import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { members } from '@/lib/db/schema';
import { requireApiUser } from '@/lib/auth/session';
import { handleRouteError } from '@/lib/api/http';

const updateProfileSchema = z.object({
  first_name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
  job_title: z.string().optional(),
  avatar_url: z.string().url().optional().or(z.literal('')),
});

export async function PATCH(request: Request) {
  try {
    const { user, response } = await requireApiUser();
    if (response) return response;

    const result = updateProfileSchema.safeParse(await request.json());
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0]?.message || 'Invalid payload', details: result.error.issues }, { status: 400 });
    }

    const [updatedProfile] = await db
      .update(members)
      .set(result.data)
      .where(eq(members.id, user.id))
      .returning();

    if (!updatedProfile) {
      return NextResponse.json({ error: 'Member profile not found' }, { status: 404 });
    }

    return NextResponse.json(updatedProfile);
  } catch (err) {
    return handleRouteError(err, 'Profile PATCH exception');
  }
}
