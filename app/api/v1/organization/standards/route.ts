import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { organization_standards } from '@/lib/db/schema';
import { requireApiUser } from '@/lib/auth/session';
import { getMember } from '@/lib/db/queries';
import { handleRouteError } from '@/lib/api/http';
import { logActivity } from '@/lib/activity.server';

const updateStandardsSchema = z.object({
  engineering_standards: z.array(z.string()).optional(),
  coding_standards: z.array(z.string()).optional(),
  review_standards: z.array(z.string()).optional(),
  qa_standards: z.array(z.string()).optional(),
  meeting_templates: z.array(z.string()).optional(),
  project_templates: z.array(z.string()).optional(),
  role_templates: z.array(z.string()).optional(),
  branch_naming_rules: z.string().optional(),
  definition_of_done: z.array(z.string()).optional(),
  working_principles: z.array(z.string()).optional(),
});

const JSON_FIELDS = [
  'engineering_standards', 'coding_standards', 'review_standards', 'qa_standards',
  'meeting_templates', 'project_templates', 'role_templates', 'definition_of_done', 'working_principles',
] as const;

type Standards = typeof organization_standards.$inferSelect;

// Lists are stored as jsonb arrays. Rows written under Supabase hold them as
// JSON-encoded strings, so decode those on the way out.
function normalize(standards: Standards) {
  const parsed: Record<string, unknown> = { ...standards };
  for (const field of JSON_FIELDS) {
    let value = parsed[field];
    if (typeof value === 'string') {
      try {
        value = JSON.parse(value);
      } catch {
        value = [];
      }
    }
    // Column default is {} (from the original schema); the UI works with lists
    parsed[field] = Array.isArray(value) ? value : [];
  }
  return parsed;
}

export async function GET() {
  try {
    const { user, response } = await requireApiUser();
    if (response) return response;

    const member = await getMember(user.id);
    if (!member || !member.organization_id) {
      return NextResponse.json({ error: 'Member profile not found' }, { status: 404 });
    }

    let [standards] = await db
      .select()
      .from(organization_standards)
      .where(eq(organization_standards.organization_id, member.organization_id))
      .limit(1);

    // First visit: create an empty standards record
    if (!standards) {
      [standards] = await db
        .insert(organization_standards)
        .values({ organization_id: member.organization_id })
        .returning();
    }

    return NextResponse.json(normalize(standards));
  } catch (err) {
    return handleRouteError(err, 'Organization Standards GET exception');
  }
}

export async function PATCH(request: Request) {
  try {
    const { user, response } = await requireApiUser();
    if (response) return response;

    const member = await getMember(user.id);
    if (!member || member.organization_role !== 'Organization Admin' || !member.organization_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const result = updateStandardsSchema.safeParse(await request.json());
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0]?.message || 'Invalid payload', details: result.error.issues }, { status: 400 });
    }

    const payload = Object.fromEntries(
      Object.entries(result.data).filter(([, value]) => value !== undefined),
    ) as Partial<typeof organization_standards.$inferInsert>;

    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ error: 'No changes provided' }, { status: 400 });
    }

    let [updatedStandards] = await db
      .update(organization_standards)
      .set(payload)
      .where(eq(organization_standards.organization_id, member.organization_id))
      .returning();

    // Not created yet (standards page never opened): create it with these values
    if (!updatedStandards) {
      [updatedStandards] = await db
        .insert(organization_standards)
        .values({ organization_id: member.organization_id, ...payload })
        .returning();
    }

    await logActivity({
      organizationId: member.organization_id,
      memberId: user.id,
      action: 'Updated',
      entityType: 'Standards',
      entityId: updatedStandards.id,
      description: `Updated organization standards (${Object.keys(payload).join(', ')})`,
    });

    return NextResponse.json(normalize(updatedStandards));
  } catch (err) {
    return handleRouteError(err, 'Organization Standards PATCH exception');
  }
}
