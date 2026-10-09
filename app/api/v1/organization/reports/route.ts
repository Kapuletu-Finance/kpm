import { NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth/session';
import { getMember, getOverseenProjectIds } from '@/lib/db/queries';
import { handleRouteError } from '@/lib/api/http';
import { organizationTimezone } from '@/lib/timezone';
import { buildReport, csvResponse, parseRange, reportToCsv } from '@/lib/reports.server';

/**
 * GET ?from&to&projectId&format=csv&section=projects|members|achievements
 * Org Admins report on the whole organization; Project Managers on the projects they manage.
 */
export async function GET(request: Request) {
  try {
    const { user, response } = await requireApiUser();
    if (response) return response;

    const member = await getMember(user.id);
    if (!member?.organization_id) return NextResponse.json({ error: 'Member profile not found' }, { status: 404 });

    const overseen = await getOverseenProjectIds(member);
    if (member.organization_role !== 'Organization Admin' && overseen.length === 0) {
      return NextResponse.json({ error: 'Reports are available to Organization Admins and Project Managers' }, { status: 403 });
    }

    const url = new URL(request.url);
    const tz = await organizationTimezone(member.organization_id);
    const range = parseRange(url, tz);
    if ('error' in range) return NextResponse.json({ error: range.error }, { status: 400 });

    const projectId = url.searchParams.get('projectId');
    if (projectId && !overseen.includes(projectId)) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const report = await buildReport({
      organizationId: member.organization_id,
      projectIds: projectId ? [projectId] : overseen,
      ...range,
      timezone: tz,
    });

    if (url.searchParams.get('format') === 'csv') {
      const section = url.searchParams.get('section');
      const which = section === 'members' || section === 'achievements' ? section : 'projects';
      return csvResponse(reportToCsv(report, which), `kpm-${which}-${range.from}-to-${range.to}.csv`);
    }

    return NextResponse.json({ ...report, scope: member.organization_role === 'Organization Admin' ? 'organization' : 'managed' });
  } catch (error) {
    return handleRouteError(error, 'Organization report error');
  }
}
