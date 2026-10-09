import { NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth/session';
import { getMember, getOverseenProjectIds } from '@/lib/db/queries';
import { getStandupDay } from '@/lib/standups.server';
import { handleRouteError } from '@/lib/api/http';
import { organizationTimezone, todayIn } from '@/lib/timezone';

/**
 * GET ?date=YYYY-MM-DD&projectId= : one day's standups across the projects the caller oversees,
 * with who submitted and who has not. "Expected" means active members of Active projects.
 */
export async function GET(request: Request) {
  try {
    const { user, response } = await requireApiUser();
    if (response) return response;

    const member = await getMember(user.id);
    if (!member?.organization_id) return NextResponse.json({ error: 'Member profile not found' }, { status: 404 });

    let projectIds = await getOverseenProjectIds(member);
    if (member.organization_role !== 'Organization Admin' && projectIds.length === 0) {
      return NextResponse.json({ error: 'Available to Organization Admins and Project Managers' }, { status: 403 });
    }

    const url = new URL(request.url);
    const tz = await organizationTimezone(member.organization_id);
    const date = url.searchParams.get('date') || todayIn(tz);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
      return NextResponse.json({ error: 'Date must be in YYYY-MM-DD format' }, { status: 400 });
    }

    const projectId = url.searchParams.get('projectId');
    if (projectId) {
      if (!projectIds.includes(projectId)) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      projectIds = [projectId];
    }

    return NextResponse.json(await getStandupDay(projectIds, date, tz));
  } catch (error) {
    return handleRouteError(error, 'Organization standups error');
  }
}
