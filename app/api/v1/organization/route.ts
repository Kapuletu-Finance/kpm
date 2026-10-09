import { NextResponse } from 'next/server';
import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { members, organizations, users } from '@/lib/db/schema';
import { signOut } from '@/auth';
import { requireApiUser } from '@/lib/auth/session';
import { getMember } from '@/lib/db/queries';
import { handleRouteError } from '@/lib/api/http';
import { logActivity } from '@/lib/activity.server';
import { isValidTimezone } from '@/lib/timezone';

const updateOrgSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  industry: z.string().optional(),
  website: z.string().url().optional().or(z.literal('')),
  country: z.string().optional(),
  timezone: z
    .string()
    .refine((tz) => tz === '' || isValidTimezone(tz), 'Use a timezone name such as Africa/Nairobi or Europe/London')
    .optional(),
  logo_url: z.string().url().optional().or(z.literal('')),
});

export async function GET() {
  try {
    const { user, response } = await requireApiUser();
    if (response) return response;

    const member = await getMember(user.id);
    if (!member || !member.organization_id) {
      return NextResponse.json({ error: 'Member profile not found' }, { status: 404 });
    }

    const [org] = await db.select().from(organizations).where(eq(organizations.id, member.organization_id)).limit(1);
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    return NextResponse.json(org);
  } catch (err) {
    return handleRouteError(err, 'Organization GET exception');
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

    const result = updateOrgSchema.safeParse(await request.json());
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0]?.message || 'Invalid payload', details: result.error.issues }, { status: 400 });
    }

    const [updatedOrg] = await db
      .update(organizations)
      .set(result.data)
      .where(eq(organizations.id, member.organization_id))
      .returning();

    await logActivity({
      organizationId: member.organization_id,
      memberId: user.id,
      action: 'Updated',
      entityType: 'Organization',
      entityId: member.organization_id,
      description: `Updated organization settings (${Object.keys(result.data).join(', ')})`,
    });

    return NextResponse.json(updatedOrg);
  } catch (err) {
    return handleRouteError(err, 'Organization PATCH exception');
  }
}

export async function DELETE() {
  try {
    const { user, response } = await requireApiUser();
    if (response) return response;

    const member = await getMember(user.id);
    if (!member || member.organization_role !== 'Organization Admin' || !member.organization_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const organizationId = member.organization_id;

    // Deleting the organization cascades to members, projects, features, etc.
    // The members' login accounts are removed too, so no orphaned logins remain.
    await db.transaction(async (tx) => {
      const orgMembers = await tx
        .select({ id: members.id })
        .from(members)
        .where(eq(members.organization_id, organizationId));

      await tx.delete(organizations).where(eq(organizations.id, organizationId));
      if (orgMembers.length) {
        await tx.delete(users).where(inArray(users.id, orgMembers.map((m) => m.id)));
      }
    });

    await signOut({ redirect: false });

    return NextResponse.json({ message: 'Organization deleted' });
  } catch (err) {
    return handleRouteError(err, 'Organization DELETE exception');
  }
}
