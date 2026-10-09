import { NextResponse } from 'next/server';
import { and, asc, count, eq, inArray, isNotNull, lt, ne, or } from 'drizzle-orm';
import { db } from '@/lib/db';
import { deliverables, features, modules, project_members, projects, roadmaps } from '@/lib/db/schema';
import { requireApiUser } from '@/lib/auth/session';
import { getMember } from '@/lib/db/queries';
import { handleRouteError } from '@/lib/api/http';

export async function GET() {
  try {
    const { user, response } = await requireApiUser();
    if (response) return response;

    const memberProfile = await getMember(user.id);
    if (!memberProfile || !['Organization Admin', 'Project Manager'].includes(memberProfile.organization_role ?? '')) {
      return NextResponse.json({ error: 'Forbidden. Requires Manager role.' }, { status: 403 });
    }

    // Projects where the caller is one of the Project Managers (not only the listed lead)
    const managedProjectIds = db
      .select({ id: project_members.project_id })
      .from(project_members)
      .where(and(eq(project_members.member_id, user.id), eq(project_members.project_role, 'Project Manager')));

    const today = new Date().toISOString().slice(0, 10);

    // Features that need a manager: waiting for approval, or past their due date and not shipped
    const needsAction = and(
      inArray(roadmaps.project_id, managedProjectIds),
      or(
        eq(features.status, 'Approval'),
        and(isNotNull(features.due_date), lt(features.due_date, today), ne(features.status, 'Released')),
      ),
    );

    const [managedProjects, actionNeededFeatures, [{ pendingReviews }]] = await Promise.all([
      db
        .select({ id: projects.id, name: projects.name, status: projects.status, priority: projects.priority, end_date: projects.end_date })
        .from(projects)
        .where(inArray(projects.id, managedProjectIds)),
      db
        .select({
          id: features.id,
          title: features.title,
          status: features.status,
          priority: features.priority,
          due_date: features.due_date,
          project_id: roadmaps.project_id,
          project_name: projects.name,
        })
        .from(features)
        .innerJoin(modules, eq(modules.id, features.module_id))
        .innerJoin(roadmaps, eq(roadmaps.id, modules.roadmap_id))
        .innerJoin(projects, eq(projects.id, roadmaps.project_id))
        .where(needsAction)
        .orderBy(asc(features.due_date))
        .limit(10),
      // Deliverables on managed projects' features awaiting a decision
      db
        .select({ pendingReviews: count() })
        .from(deliverables)
        .innerJoin(features, eq(features.id, deliverables.entity_id))
        .innerJoin(modules, eq(modules.id, features.module_id))
        .innerJoin(roadmaps, eq(roadmaps.id, modules.roadmap_id))
        .where(
          and(
            eq(deliverables.entity_type, 'Feature'),
            inArray(deliverables.status, ['Pending', 'Submitted']),
            inArray(roadmaps.project_id, managedProjectIds),
          ),
        ),
    ]);

    return NextResponse.json({
      stats: {
        managedProjects: managedProjects.length,
        actionNeededFeatures: actionNeededFeatures.length,
        pendingReviews,
      },
      managedProjects,
      actionNeededFeatures,
    });
  } catch (error) {
    return handleRouteError(error, 'Manager dashboard error');
  }
}
