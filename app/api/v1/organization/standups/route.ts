import { NextResponse } from 'next/server';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { daily_updates, members, project_members, projects } from '@/lib/db/schema';
import { requireApiUser } from '@/lib/auth/session';
import { getMember, getOverseenProjectIds, memberSummary } from '@/lib/db/queries';
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

    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    const base = { date, timezone: tz, is_weekend: weekday === 0 || weekday === 6 };
    if (projectIds.length === 0) {
      return NextResponse.json({ ...base, summary: { expected: 0, submitted: 0, missing: 0, blockers: 0 }, projects: [] });
    }

    const onDay = sql`(${daily_updates.submitted_at} at time zone ${tz})::date = ${date}::date`;

    const [projectRows, team, standups] = await Promise.all([
      db
        .select({ id: projects.id, name: projects.name, status: projects.status })
        .from(projects)
        .where(inArray(projects.id, projectIds)),
      db
        .select({ project_id: project_members.project_id, ...memberSummary, project_role: project_members.project_role })
        .from(project_members)
        .innerJoin(members, eq(members.id, project_members.member_id))
        .where(and(inArray(project_members.project_id, projectIds), eq(members.status, 'Active'))),
      db
        .select({
          id: daily_updates.id,
          project_id: daily_updates.project_id,
          member_id: daily_updates.member_id,
          yesterday: daily_updates.yesterday,
          today: daily_updates.today,
          blockers: daily_updates.blockers,
          risks: daily_updates.risks,
          help_needed: daily_updates.help_needed,
          manager_comments: daily_updates.manager_comments,
          submitted_at: daily_updates.submitted_at,
          members: memberSummary,
        })
        .from(daily_updates)
        .leftJoin(members, eq(members.id, daily_updates.member_id))
        .where(and(inArray(daily_updates.project_id, projectIds), onDay))
        .orderBy(daily_updates.submitted_at),
    ]);

    const result = projectRows
      .map((p) => {
        const submitted = standups.filter((s) => s.project_id === p.id);
        const submittedBy = new Set(submitted.map((s) => s.member_id));
        // Only Active projects expect daily updates
        const expected = p.status === 'Active' ? team.filter((t) => t.project_id === p.id) : [];
        const missing = expected
          .filter((t) => !submittedBy.has(t.id))
          .map(({ id, first_name, last_name, avatar_url, project_role }) => ({ id, first_name, last_name, avatar_url, project_role }));
        return {
          id: p.id,
          name: p.name,
          status: p.status,
          expected: expected.length,
          submitted,
          missing,
          blockers: submitted.filter((s) => s.blockers?.trim()).length,
        };
      })
      // Hide inactive projects with nothing to show
      .filter((p) => p.expected > 0 || p.submitted.length > 0)
      .sort((a, b) => b.missing.length - a.missing.length || a.name.localeCompare(b.name));

    const summary = result.reduce(
      (acc, p) => ({
        expected: acc.expected + p.expected,
        submitted: acc.submitted + p.submitted.length,
        missing: acc.missing + p.missing.length,
        blockers: acc.blockers + p.blockers,
      }),
      { expected: 0, submitted: 0, missing: 0, blockers: 0 },
    );

    return NextResponse.json({ ...base, summary, projects: result });
  } catch (error) {
    return handleRouteError(error, 'Organization standups error');
  }
}
