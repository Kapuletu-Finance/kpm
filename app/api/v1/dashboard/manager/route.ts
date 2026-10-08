import { NextResponse } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { features, modules, projects, roadmaps } from '@/lib/db/schema';
import { requireApiUser } from '@/lib/auth/session';
import { getMember } from '@/lib/db/queries';
import { handleRouteError } from '@/lib/api/http';

// Feature statuses that need a manager's attention
const ACTION_NEEDED_STATUSES = ['In Review', 'Blocked'];

export async function GET() {
  try {
    const { user, response } = await requireApiUser();
    if (response) return response;

    const memberProfile = await getMember(user.id);
    if (!memberProfile || !['Organization Admin', 'Project Manager'].includes(memberProfile.organization_role ?? '')) {
      return NextResponse.json({ error: 'Forbidden. Requires Manager role.' }, { status: 403 });
    }

    const [managedProjects, actionNeededFeatures] = await Promise.all([
      db
        .select({ id: projects.id, name: projects.name, status: projects.status, priority: projects.priority, end_date: projects.end_date })
        .from(projects)
        .where(eq(projects.project_manager_id, user.id)),
      db
        .select({
          id: features.id,
          title: features.title,
          status: features.status,
          priority: features.priority,
          project_id: roadmaps.project_id,
          project_name: projects.name,
        })
        .from(features)
        .innerJoin(modules, eq(modules.id, features.module_id))
        .innerJoin(roadmaps, eq(roadmaps.id, modules.roadmap_id))
        .innerJoin(projects, eq(projects.id, roadmaps.project_id))
        .where(and(eq(projects.project_manager_id, user.id), inArray(features.status, ACTION_NEEDED_STATUSES)))
        .limit(10),
    ]);

    return NextResponse.json({
      stats: {
        managedProjects: managedProjects.length,
        actionNeededFeatures: actionNeededFeatures.length,
        pendingReviews: 0,
      },
      managedProjects,
      actionNeededFeatures,
    });
  } catch (error) {
    return handleRouteError(error, 'Manager dashboard error');
  }
}
