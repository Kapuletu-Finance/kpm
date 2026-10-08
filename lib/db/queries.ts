import { and, eq, getTableColumns, type SQL } from 'drizzle-orm';
import { db } from '@/lib/db';
import { features, meeting_action_items, meetings, members, modules, organizations, project_members, projects, roadmaps } from '@/lib/db/schema';

// Small, frequently used lookups shared by the API routes. Each is a single
// primary-key or unique-index probe.

export type Member = typeof members.$inferSelect;
export type ProjectMember = typeof project_members.$inferSelect;

/** The member row for a user id (members.id === users.id). */
export async function getMember(memberId: string): Promise<Member | null> {
  const [row] = await db.select().from(members).where(eq(members.id, memberId)).limit(1);
  return row ?? null;
}

/** The member row plus its organization's name. */
export async function getMemberWithOrgName(memberId: string) {
  const [row] = await db
    .select({ member: members, organization_name: organizations.name })
    .from(members)
    .leftJoin(organizations, eq(organizations.id, members.organization_id))
    .where(eq(members.id, memberId))
    .limit(1);
  return row ? { ...row.member, organization_name: row.organization_name } : null;
}

/** The caller's project_members row for a project, or null if not on the team. */
export async function getProjectMembership(projectId: string, memberId: string): Promise<ProjectMember | null> {
  const [row] = await db
    .select()
    .from(project_members)
    .where(and(eq(project_members.project_id, projectId), eq(project_members.member_id, memberId)))
    .limit(1);
  return row ?? null;
}

/** Column set for the `{ id, first_name, last_name, avatar_url }` member summaries the UI embeds. */
export const memberSummary = {
  id: members.id,
  first_name: members.first_name,
  last_name: members.last_name,
  avatar_url: members.avatar_url,
};

export type ProjectAccess =
  | { hasAccess: false; role?: undefined; member: Member | null }
  | { hasAccess: true; role: string; member: Member };

/**
 * Whether `userId` may access `projectId`, and in what role:
 * - 'Organization Admin' when they administer the project's organization,
 * - otherwise their project_members.project_role ('Project Manager' | 'Member' | ...).
 */
export async function getProjectAccess(userId: string, projectId: string): Promise<ProjectAccess> {
  const [member, [project]] = await Promise.all([
    getMember(userId),
    db
      .select({ organization_id: projects.organization_id, project_role: project_members.project_role })
      .from(projects)
      .leftJoin(
        project_members,
        and(eq(project_members.project_id, projects.id), eq(project_members.member_id, userId)),
      )
      .where(eq(projects.id, projectId))
      .limit(1),
  ]);

  if (!member || !project) return { hasAccess: false, member };
  if (member.organization_role === 'Organization Admin' && member.organization_id === project.organization_id) {
    return { hasAccess: true, role: 'Organization Admin', member };
  }
  if (project.project_role) return { hasAccess: true, role: project.project_role, member };
  return { hasAccess: false, member };
}

export const canManageProject = (access: ProjectAccess) =>
  access.role === 'Organization Admin' || access.role === 'Project Manager';

/** The project a feature belongs to (features -> modules -> roadmaps). */
export async function getFeatureProjectId(featureId: string): Promise<string | null> {
  const [row] = await db
    .select({ project_id: roadmaps.project_id })
    .from(features)
    .innerJoin(modules, eq(modules.id, features.module_id))
    .innerJoin(roadmaps, eq(roadmaps.id, modules.roadmap_id))
    .where(eq(features.id, featureId))
    .limit(1);
  return row?.project_id ?? null;
}

/** The project a module belongs to (modules -> roadmaps). */
export async function getModuleProjectId(moduleId: string): Promise<string | null> {
  const [row] = await db
    .select({ project_id: roadmaps.project_id })
    .from(modules)
    .innerJoin(roadmaps, eq(roadmaps.id, modules.roadmap_id))
    .where(eq(modules.id, moduleId))
    .limit(1);
  return row?.project_id ?? null;
}

/** Whether a meeting exists and belongs to the project. */
export async function meetingInProject(meetingId: string, projectId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: meetings.id })
    .from(meetings)
    .where(and(eq(meetings.id, meetingId), eq(meetings.project_id, projectId)))
    .limit(1);
  return !!row;
}

/** Meeting action items with the assignee summary embedded as `members`. */
export function selectActionItems(where: SQL) {
  return db
    .select({ ...getTableColumns(meeting_action_items), members: memberSummary })
    .from(meeting_action_items)
    .leftJoin(members, eq(members.id, meeting_action_items.assigned_to))
    .where(where);
}
