import { and, asc, desc, eq, getTableColumns, inArray, ne } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  activity_logs, daily_updates, deliverables, feature_members, features, meeting_action_items, meetings,
  modules, project_members, projects, roadmaps, users,
} from '@/lib/db/schema';
import { getMember, getOverseenProjectIds, type Member } from '@/lib/db/queries';
import { organizationTimezone } from '@/lib/timezone';
import { buildReport } from '@/lib/reports.server';

/**
 * The projects whose data `viewer` may see about `target`, or null when they may not view
 * the target at all. Admins and the member themself see everything in the organization;
 * a Project Manager sees the projects they manage that the target is on.
 */
async function visibleProjectIds(viewer: Member, target: Member): Promise<string[] | null> {
  if (!viewer.organization_id || viewer.organization_id !== target.organization_id) return null;

  const targetProjects = await db
    .select({ id: project_members.project_id })
    .from(project_members)
    .where(eq(project_members.member_id, target.id));
  const targetIds = targetProjects.map((p) => p.id!).filter(Boolean);

  if (viewer.organization_role === 'Organization Admin') return getOverseenProjectIds(viewer);
  if (viewer.id === target.id) return targetIds;

  const managed = await getOverseenProjectIds(viewer);
  const shared = targetIds.filter((id) => managed.includes(id));
  return shared.length ? shared : null;
}

/** Everything one person is working on, for owners and managers. */
export async function getMemberOverview(viewerId: string, targetId: string, range: { from: string; to: string }) {
  const [viewer, target] = await Promise.all([getMember(viewerId), getMember(targetId)]);
  if (!viewer || !target) return null;

  const projectIds = await visibleProjectIds(viewer, target);
  if (projectIds === null) return null;

  const tz = await organizationTimezone(target.organization_id!);
  const scope = projectIds.length ? projectIds : ['00000000-0000-0000-0000-000000000000'];

  const [report, [account], memberships, openFeatures, recentDeliverables, recentStandups, actionItems, activity] = await Promise.all([
    buildReport({ organizationId: target.organization_id!, projectIds, ...range, timezone: tz }),
    db.select({ last_sign_in_at: users.lastSignInAt }).from(users).where(eq(users.id, targetId)).limit(1),
    db
      .select({
        project_id: projects.id,
        name: projects.name,
        status: projects.status,
        project_role: project_members.project_role,
        functional_role: project_members.functional_role,
        review_authority: project_members.review_authority,
        joined_at: project_members.joined_at,
      })
      .from(project_members)
      .innerJoin(projects, eq(projects.id, project_members.project_id))
      .where(and(eq(project_members.member_id, targetId), inArray(projects.id, scope)))
      .orderBy(asc(projects.name)),
    db
      .select({
        id: features.id,
        title: features.title,
        status: features.status,
        priority: features.priority,
        due_date: features.due_date,
        responsibility: feature_members.responsibility,
        project_id: roadmaps.project_id,
        project_name: projects.name,
      })
      .from(feature_members)
      .innerJoin(features, eq(features.id, feature_members.feature_id))
      .innerJoin(modules, eq(modules.id, features.module_id))
      .innerJoin(roadmaps, eq(roadmaps.id, modules.roadmap_id))
      .innerJoin(projects, eq(projects.id, roadmaps.project_id))
      .where(and(eq(feature_members.member_id, targetId), ne(features.status, 'Released'), inArray(roadmaps.project_id, scope)))
      .orderBy(asc(features.due_date)),
    db
      .select({
        id: deliverables.id,
        title: deliverables.title,
        type: deliverables.type,
        status: deliverables.status,
        link: deliverables.link,
        submitted_at: deliverables.submitted_at,
        feature_id: features.id,
        feature_title: features.title,
        project_id: roadmaps.project_id,
      })
      .from(deliverables)
      .innerJoin(features, and(eq(deliverables.entity_type, 'Feature'), eq(features.id, deliverables.entity_id)))
      .innerJoin(modules, eq(modules.id, features.module_id))
      .innerJoin(roadmaps, eq(roadmaps.id, modules.roadmap_id))
      .where(and(eq(deliverables.member_id, targetId), inArray(roadmaps.project_id, scope)))
      .orderBy(desc(deliverables.submitted_at))
      .limit(10),
    db
      .select({ ...getTableColumns(daily_updates), project_name: projects.name })
      .from(daily_updates)
      .innerJoin(projects, eq(projects.id, daily_updates.project_id))
      .where(and(eq(daily_updates.member_id, targetId), inArray(daily_updates.project_id, scope)))
      .orderBy(desc(daily_updates.submitted_at))
      .limit(10),
    db
      .select({
        id: meeting_action_items.id,
        description: meeting_action_items.description,
        status: meeting_action_items.status,
        due_date: meeting_action_items.due_date,
        meeting_id: meetings.id,
        meeting_title: meetings.title,
        project_id: meetings.project_id,
      })
      .from(meeting_action_items)
      .innerJoin(meetings, eq(meetings.id, meeting_action_items.meeting_id))
      .where(
        and(
          eq(meeting_action_items.assigned_to, targetId),
          ne(meeting_action_items.status, 'Completed'),
          inArray(meetings.project_id, scope),
        ),
      )
      .orderBy(asc(meeting_action_items.due_date)),
    db
      .select({
        id: activity_logs.id,
        action: activity_logs.action,
        entity_type: activity_logs.entity_type,
        description: activity_logs.description,
        created_at: activity_logs.created_at,
        project: { id: projects.id, name: projects.name },
      })
      .from(activity_logs)
      .leftJoin(projects, eq(projects.id, activity_logs.project_id))
      .where(
        and(
          eq(activity_logs.member_id, targetId),
          viewer.organization_role === 'Organization Admin' || viewer.id === targetId
            ? eq(activity_logs.organization_id, target.organization_id!)
            : inArray(activity_logs.project_id, scope),
        ),
      )
      .orderBy(desc(activity_logs.created_at))
      .limit(25),
  ]);

  const stats = report.members.find((m) => m.id === targetId) ?? null;

  return {
    member: {
      id: target.id,
      first_name: target.first_name,
      last_name: target.last_name,
      email: target.email,
      job_title: target.job_title,
      avatar_url: target.avatar_url,
      organization_role: target.organization_role,
      status: target.status,
      created_at: target.created_at,
      last_sign_in_at: account?.last_sign_in_at ?? null,
    },
    range: report.range,
    stats,
    projects: memberships,
    open_features: openFeatures,
    recent_deliverables: recentDeliverables,
    recent_standups: recentStandups,
    open_action_items: actionItems,
    activity,
    // Whether the viewer sees the whole organization or only shared projects
    scope: viewer.organization_role === 'Organization Admin' || viewer.id === targetId ? 'organization' : 'shared-projects',
  };
}

export type MemberOverview = NonNullable<Awaited<ReturnType<typeof getMemberOverview>>>;
