import { NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth/session';
import { canManageProject, getProjectAccess } from '@/lib/db/queries';
import { handleRouteError } from '@/lib/api/http';
import { projectTimezone } from '@/lib/timezone';
import { buildReport, csvResponse, parseRange, reportToCsv } from '@/lib/reports.server';

// GET ?from&to&format=csv&section=... : the report for one project, for its managers.
export async function GET(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    const access = await getProjectAccess(user.id, projectId);
    if (!canManageProject(access)) {
      return NextResponse.json({ error: 'Only Project Managers and Admins can view project reports' }, { status: 403 });
    }

    const url = new URL(request.url);
    const tz = await projectTimezone(projectId);
    const range = parseRange(url, tz);
    if ('error' in range) return NextResponse.json({ error: range.error }, { status: 400 });

    const report = await buildReport({
      organizationId: access.member!.organization_id!,
      projectIds: [projectId],
      ...range,
      timezone: tz,
    });

    if (url.searchParams.get('format') === 'csv') {
      const section = url.searchParams.get('section');
      const which = section === 'members' || section === 'achievements' ? section : 'projects';
      const name = report.projects[0]?.name ?? 'project';
      return csvResponse(reportToCsv(report, which), `${name}-${which}-${range.from}-to-${range.to}.csv`);
    }

    return NextResponse.json(report);
  } catch (error) {
    return handleRouteError(error, 'Project report error');
  }
}
