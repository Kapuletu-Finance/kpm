import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { members } from '@/lib/db/schema';
import { requireApiUser } from '@/lib/auth/session';
import { getMember } from '@/lib/db/queries';
import { handleRouteError } from '@/lib/api/http';
import { countActiveAdmins, deactivateMember, removeOrganizationMember } from '@/lib/members.server';
import { logActivity } from '@/lib/activity.server';
import { getMemberOverview } from '@/lib/member-overview.server';
import { organizationTimezone } from '@/lib/timezone';
import { parseRange } from '@/lib/reports.server';

const updateMemberSchema = z
  .object({
    organization_role: z.enum(['Organization Admin', 'Project Manager', 'Member']).optional(),
    status: z.enum(['Active', 'Inactive']).optional(),
    job_title: z.string().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: 'No changes provided' });

type Params = { params: Promise<{ memberId: string }> };

// GET ?from&to : a member's work overview. Admins and the member see everything in the
// organization; Project Managers see what happens on the projects they manage.
export async function GET(request: Request, { params }: Params) {
  try {
    const { memberId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    const viewer = await getMember(user.id);
    if (!viewer?.organization_id) return NextResponse.json({ error: 'Member profile not found' }, { status: 404 });

    const range = parseRange(new URL(request.url), await organizationTimezone(viewer.organization_id));
    if ('error' in range) return NextResponse.json({ error: range.error }, { status: 400 });

    const overview = await getMemberOverview(user.id, memberId, range);
    if (!overview) return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    return NextResponse.json(overview);
  } catch (err) {
    return handleRouteError(err, 'Member overview exception');
  }
}

// PATCH: an Org Admin changes a member's organization role, title, or active status.
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { memberId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    const [caller, target] = await Promise.all([getMember(user.id), getMember(memberId)]);
    if (!caller || caller.organization_role !== 'Organization Admin' || !caller.organization_id) {
      return NextResponse.json({ error: 'Only Organization Admins can manage members' }, { status: 403 });
    }
    if (!target || target.organization_id !== caller.organization_id) {
      return NextResponse.json({ error: 'Member not found in your organization' }, { status: 404 });
    }

    const result = updateMemberSchema.safeParse(await request.json());
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0]?.message || 'Invalid payload' }, { status: 400 });
    }
    const { organization_role, status, job_title } = result.data;

    // Admins cannot demote or deactivate themselves; another admin must do it.
    // This, plus the check below, guarantees the organization always keeps an active admin.
    if (memberId === user.id && ((organization_role && organization_role !== 'Organization Admin') || status === 'Inactive')) {
      return NextResponse.json({ error: 'You cannot demote or deactivate yourself' }, { status: 400 });
    }

    const losesAdmin =
      target.organization_role === 'Organization Admin' &&
      target.status === 'Active' &&
      ((organization_role && organization_role !== 'Organization Admin') || status === 'Inactive');
    if (losesAdmin && (await countActiveAdmins(caller.organization_id)) <= 1) {
      return NextResponse.json({ error: 'The organization must keep at least one active admin' }, { status: 400 });
    }

    if (status === 'Active' && target.status === 'Invited') {
      return NextResponse.json({ error: 'This member has not accepted their invitation yet' }, { status: 400 });
    }

    const updates: Partial<typeof members.$inferInsert> = {};
    if (organization_role) updates.organization_role = organization_role;
    if (job_title !== undefined) updates.job_title = job_title;
    if (status === 'Active') updates.status = 'Active';

    if (Object.keys(updates).length > 0) {
      await db.update(members).set(updates).where(eq(members.id, memberId));
    }
    // Deactivation also takes them off every project team
    if (status === 'Inactive' && target.status !== 'Inactive') {
      await deactivateMember(memberId);
    }

    const name = `${target.first_name} ${target.last_name}`;
    const changes: string[] = [];
    if (organization_role && organization_role !== target.organization_role) changes.push(`changed ${name}'s role to ${organization_role}`);
    if (status === 'Inactive' && target.status !== 'Inactive') changes.push(`deactivated ${name}`);
    if (status === 'Active' && target.status === 'Inactive') changes.push(`reactivated ${name}`);
    if (changes.length) {
      const text = changes.join(', ');
      await logActivity({
        organizationId: caller.organization_id,
        memberId: user.id,
        action: 'Updated',
        entityType: 'Member',
        entityId: memberId,
        description: text.charAt(0).toUpperCase() + text.slice(1),
      });
    }

    const updated = await getMember(memberId);
    return NextResponse.json(updated);
  } catch (err) {
    return handleRouteError(err, 'Member PATCH exception');
  }
}

// DELETE: revoke a pending invitation, or deactivate an existing member.
export async function DELETE(request: Request, { params }: Params) {
  try {
    const { memberId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    return removeOrganizationMember(user.id, memberId);
  } catch (err) {
    return handleRouteError(err, 'Member DELETE exception');
  }
}
