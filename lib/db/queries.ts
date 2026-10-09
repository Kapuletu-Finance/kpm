import { and, eq, getTableColumns, type SQL } from 'drizzle-orm';
import { db } from '@/lib/db';
import { deliverables, features, meeting_action_items, meetings, members, modules, organizations, project_members, projects, roadmaps, sprints } from '@/lib/db/schema';

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

  if (!member || !project || member.status === 'Inactive') return { hasAccess: false, member };
  // A project is only reachable from inside its own organization
  if (member.organization_id !== project.organization_id) return { hasAccess: false, member };
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

/**
 * The projects a member oversees: every project in the organization for an Org Admin,
 * otherwise the projects where they are a Project Manager. Empty for everyone else.
 */
export async function getOverseenProjectIds(member: Member): Promise<string[]> {
  if (!member.organization_id || member.status === 'Inactive') return [];
  if (member.organization_role === 'Organization Admin') {
    const rows = await db.select({ id: projects.id }).from(projects).where(eq(projects.organization_id, member.organization_id));
    return rows.map((r) => r.id);
  }
  const rows = await db
    .select({ id: project_members.project_id })
    .from(project_members)
    .innerJoin(projects, eq(projects.id, project_members.project_id))
    .where(
      and(
        eq(project_members.member_id, member.id),
        eq(project_members.project_role, 'Project Manager'),
        eq(projects.organization_id, member.organization_id),
      ),
    );
  return rows.map((r) => r.id!).filter(Boolean);
}

/** Whether the caller may review deliverables: managers, or team members granted review authority. */
export async function canReviewInProject(access: ProjectAccess, userId: string, projectId: string): Promise<boolean> {
  if (!access.hasAccess) return false;
  if (canManageProject(access)) return true;
  const membership = await getProjectMembership(projectId, userId);
  return !!membership?.review_authority;
}

/** Member ids who should be told about new submissions: the project's PMs and reviewers. */
export async function getProjectReviewerIds(projectId: string): Promise<string[]> {
  const rows = await db
    .select({ member_id: project_members.member_id, project_role: project_members.project_role, review_authority: project_members.review_authority })
    .from(project_members)
    .where(eq(project_members.project_id, projectId));
  return rows
    .filter((r) => r.member_id && (r.project_role === 'Project Manager' || r.review_authority))
    .map((r) => r.member_id!);
}

/** Whether a member belongs to the same organization as the project. */
export async function memberInProjectOrg(memberId: string, projectId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: members.id })
    .from(members)
    .innerJoin(projects, eq(projects.organization_id, members.organization_id))
    .where(and(eq(members.id, memberId), eq(projects.id, projectId)))
    .limit(1);
  return !!row;
}

/** Whether a sprint exists and belongs to the project. */
export async function sprintInProject(sprintId: string, projectId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: sprints.id })
    .from(sprints)
    .where(and(eq(sprints.id, sprintId), eq(sprints.project_id, projectId)))
    .limit(1);
  return !!row;
}

/** The project a deliverable belongs to, resolved through its parent entity. */
async function getDeliverableProjectId(deliverableId: string): Promise<string | null> {
  const [row] = await db
    .select({ entity_type: deliverables.entity_type, entity_id: deliverables.entity_id })
    .from(deliverables)
    .where(eq(deliverables.id, deliverableId))
    .limit(1);
  if (!row) return null;
  if (row.entity_type === 'Project') return row.entity_id;
  if (row.entity_type === 'Feature') return getFeatureProjectId(row.entity_id);
  const [meeting] = await db
    .select({ project_id: meetings.project_id })
    .from(meetings)
    .where(eq(meetings.id, row.entity_id))
    .limit(1);
  return meeting?.project_id ?? null;
}

/**
 * Whether a polymorphic entity (as used by comments and deliverables) belongs to the project.
 * Routes scoped to a project must check this before reading or writing by entity id.
 */
export async function entityInProject(entityType: string, entityId: string, projectId: string): Promise<boolean> {
  switch (entityType) {
    case 'Project':
      return entityId === projectId;
    case 'Feature':
      return (await getFeatureProjectId(entityId)) === projectId;
    case 'Module':
      return (await getModuleProjectId(entityId)) === projectId;
    case 'Meeting':
      return meetingInProject(entityId, projectId);
    case 'Deliverable':
      return (await getDeliverableProjectId(entityId)) === projectId;
    default:
      return false;
  }
}

/** Meeting action items with the assignee summary embedded as `members`. */
export function selectActionItems(where: SQL) {
  return db
    .select({ ...getTableColumns(meeting_action_items), members: memberSummary })
    .from(meeting_action_items)
    .leftJoin(members, eq(members.id, meeting_action_items.assigned_to))
    .where(where);
}
