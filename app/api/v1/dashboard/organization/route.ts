import { NextResponse } from 'next/server';
import { and, count, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { members, projects } from '@/lib/db/schema';
import { requireApiUser } from '@/lib/auth/session';
import { getMember } from '@/lib/db/queries';
import { handleRouteError } from '@/lib/api/http';

export async function GET() {
  try {
    const { user, response } = await requireApiUser();
    if (response) return response;

    const memberProfile = await getMember(user.id);
    if (!memberProfile || memberProfile.organization_role !== 'Organization Admin' || !memberProfile.organization_id) {
      return NextResponse.json({ error: 'Forbidden. Requires Organization Admin role.' }, { status: 403 });
    }

    const orgId = memberProfile.organization_id;

    const [projectsData, [{ membersCount }], [{ invitesCount }]] = await Promise.all([
      db
        .select({
          id: projects.id,
          name: projects.name,
          status: projects.status,
          priority: projects.priority,
          end_date: projects.end_date,
          pm_first_name: members.first_name,
          pm_last_name: members.last_name,
        })
        .from(projects)
        .leftJoin(members, eq(members.id, projects.project_manager_id))
        .where(eq(projects.organization_id, orgId)),
      db
        .select({ membersCount: count() })
        .from(members)
        .where(and(eq(members.organization_id, orgId), eq(members.status, 'Active'))),
      db
        .select({ invitesCount: count() })
        .from(members)
        .where(and(eq(members.organization_id, orgId), eq(members.status, 'Invited'))),
    ]);

    const projectList = projectsData.map(({ pm_first_name, pm_last_name, ...p }) => ({
      ...p,
      manager_name: pm_first_name !== null ? `${pm_first_name} ${pm_last_name}` : 'Unassigned',
    }));

    return NextResponse.json({
      stats: {
        totalProjects: projectsData.length,
        activeProjects: projectsData.filter((p) => p.status === 'Active').length,
        activeMembers: membersCount,
        pendingInvites: invitesCount,
      },
      projects: projectList,
    });
  } catch (error) {
    return handleRouteError(error, 'Organization dashboard error');
  }
}
