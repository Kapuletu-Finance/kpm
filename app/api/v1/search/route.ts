import { NextRequest, NextResponse } from 'next/server';
import { and, eq, ilike, inArray, or } from 'drizzle-orm';
import { db } from '@/lib/db';
import { features, meetings, members, modules, project_members, projects, roadmaps } from '@/lib/db/schema';
import { requireApiUser } from '@/lib/auth/session';
import { getMember } from '@/lib/db/queries';
import { handleRouteError } from '@/lib/api/http';

// Treat user input literally inside ILIKE patterns.
const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

export async function GET(req: NextRequest) {
  try {
    const { user, response } = await requireApiUser();
    if (response) return response;

    const query = new URL(req.url).searchParams.get('q');
    if (!query || query.length < 2) {
      return NextResponse.json([]);
    }

    const pattern = `%${escapeLike(query)}%`;

    const callerMember = await getMember(user.id);

    // Searchable projects: an Org Admin sees the whole organization (as in the project list),
    // everyone else only the projects they are on.
    const myProjectIds =
      callerMember?.organization_role === 'Organization Admin' && callerMember.organization_id
        ? db.select({ id: projects.id }).from(projects).where(eq(projects.organization_id, callerMember.organization_id))
        : db
            .select({ id: project_members.project_id })
            .from(project_members)
            .where(eq(project_members.member_id, user.id));

    const [projectRows, featureRows, meetingRows, memberRows] = await Promise.all([
      db
        .select({ id: projects.id, name: projects.name, description: projects.description })
        .from(projects)
        .where(and(inArray(projects.id, myProjectIds), or(ilike(projects.name, pattern), ilike(projects.description, pattern))))
        .limit(5),
      db
        .select({ id: features.id, title: features.title, description: features.description, project_id: roadmaps.project_id })
        .from(features)
        .innerJoin(modules, eq(modules.id, features.module_id))
        .innerJoin(roadmaps, eq(roadmaps.id, modules.roadmap_id))
        .where(and(inArray(roadmaps.project_id, myProjectIds), or(ilike(features.title, pattern), ilike(features.description, pattern))))
        .limit(5),
      db
        .select({ id: meetings.id, title: meetings.title, project_id: meetings.project_id })
        .from(meetings)
        .where(and(inArray(meetings.project_id, myProjectIds), ilike(meetings.title, pattern)))
        .limit(5),
      callerMember?.organization_id
        ? db
            .select({ id: members.id, first_name: members.first_name, last_name: members.last_name, email: members.email, avatar_url: members.avatar_url })
            .from(members)
            .where(
              and(
                eq(members.organization_id, callerMember.organization_id),
                or(ilike(members.first_name, pattern), ilike(members.last_name, pattern), ilike(members.email, pattern)),
              ),
            )
            .limit(5)
        : Promise.resolve([]),
    ]);

    const results = [
      ...projectRows.map(p => ({
        type: 'Project',
        id: p.id,
        title: p.name,
        subtitle: p.description,
        url: `/workspace/projects/${p.id}`
      })),
      ...featureRows.map(f => ({
        type: 'Feature',
        id: f.id,
        title: f.title,
        subtitle: f.description,
        url: `/workspace/projects/${f.project_id}/features/${f.id}`
      })),
      ...meetingRows.map(m => ({
        type: 'Meeting',
        id: m.id,
        title: m.title,
        subtitle: `Project Meeting`,
        url: `/workspace/projects/${m.project_id}/meetings`
      })),
      ...memberRows.map(m => ({
        type: 'Member',
        id: m.id,
        title: `${m.first_name} ${m.last_name}`,
        subtitle: m.email,
        avatar_url: m.avatar_url,
        url: `/workspace/organization`
      }))
    ];

    return NextResponse.json(results);
  } catch (error) {
    return handleRouteError(error, 'Search error');
  }
}
