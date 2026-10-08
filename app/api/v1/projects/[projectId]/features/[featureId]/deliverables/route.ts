import { NextResponse } from 'next/server';
import { and, desc, eq, getTableColumns } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { deliverables, members } from '@/lib/db/schema';
import { requireApiUser } from '@/lib/auth/session';
import { getFeatureProjectId, getProjectAccess, memberSummary } from '@/lib/db/queries';
import { handleRouteError } from '@/lib/api/http';
import { logActivity } from '@/lib/activity.server';

const deliverableSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  type: z.enum(['GitHub PR', 'Figma Link', 'API Doc', 'Document', 'Video', 'Screenshot', 'Demo', 'Commit', 'Deployment URL']),
  link: z.string().url('Must be a valid URL'),
  description: z.string().optional(),
});

type Params = { params: Promise<{ projectId: string, featureId: string }> };

async function authorize(userId: string, projectId: string, featureId: string) {
  const [access, featureProjectId] = await Promise.all([
    getProjectAccess(userId, projectId),
    getFeatureProjectId(featureId),
  ]);
  if (!access.hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (featureProjectId !== projectId) {
    return NextResponse.json({ error: 'Feature not found in this project' }, { status: 404 });
  }
  return null;
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { projectId, featureId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    const denied = await authorize(user.id, projectId, featureId);
    if (denied) return denied;

    const data = await db
      .select({ ...getTableColumns(deliverables), members: memberSummary })
      .from(deliverables)
      .leftJoin(members, eq(members.id, deliverables.member_id))
      .where(and(eq(deliverables.entity_type, 'Feature'), eq(deliverables.entity_id, featureId)))
      .orderBy(desc(deliverables.created_at));

    return NextResponse.json(data);
  } catch (error) {
    return handleRouteError(error, 'List deliverables error');
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { projectId, featureId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    const denied = await authorize(user.id, projectId, featureId);
    if (denied) return denied;

    const result = deliverableSchema.safeParse(await request.json());
    if (!result.success) return NextResponse.json({ error: 'Invalid payload', details: result.error.flatten() }, { status: 400 });

    const [data] = await db
      .insert(deliverables)
      .values({
        entity_type: 'Feature',
        entity_id: featureId,
        member_id: user.id,
        ...result.data,
      })
      .returning();

    await logActivity({
      projectId,
      memberId: user.id,
      action: 'Created',
      entityType: 'Deliverable',
      entityId: data.id,
      description: `Created a deliverable: ${data.title}`
    });

    return NextResponse.json(data);
  } catch (error) {
    return handleRouteError(error, 'Create deliverable error');
  }
}
