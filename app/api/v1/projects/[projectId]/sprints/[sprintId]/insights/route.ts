import { NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth/session';
import { getProjectAccess } from '@/lib/db/queries';
import { handleRouteError } from '@/lib/api/http';
import { getSprintInsights } from '@/lib/sprint-insights.server';

type Params = { params: Promise<{ projectId: string; sprintId: string }> };

// GET: burndown for this sprint and velocity across the project's recent sprints.
export async function GET(request: Request, { params }: Params) {
  try {
    const { projectId, sprintId } = await params;
    const { user, response } = await requireApiUser();
    if (response) return response;

    const [access, insights] = await Promise.all([getProjectAccess(user.id, projectId), getSprintInsights(projectId, sprintId)]);
    if (!access.hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!insights) return NextResponse.json({ error: 'Sprint not found in this project' }, { status: 404 });

    const { sprint: _sprint, ...data } = insights;
    return NextResponse.json(data);
  } catch (error) {
    return handleRouteError(error, 'Sprint insights error');
  }
}
