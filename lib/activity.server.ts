import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { activity_logs, projects } from '@/lib/db/schema';

type LogActivityParams = {
  memberId: string;
  action: string;
  entityType: string;
  entityId: string;
  description?: string;
} & (
  // Project events: the organization is looked up from the project
  | { projectId: string; organizationId?: string }
  // Organization-level events (roles, invites, settings) have no project
  | { projectId?: null; organizationId: string }
);

export async function logActivity({
  projectId,
  organizationId,
  memberId,
  action,
  entityType,
  entityId,
  description
}: LogActivityParams) {
  try {
    let orgId = organizationId ?? null;
    if (!orgId && projectId) {
      const [project] = await db
        .select({ organization_id: projects.organization_id })
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);
      orgId = project?.organization_id ?? null;
    }

    await db.insert(activity_logs).values({
      organization_id: orgId,
      project_id: projectId ?? null,
      member_id: memberId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      description,
    });
  } catch (error) {
    // Never fail the main operation because logging failed.
    console.error('Failed to log activity:', error);
  }
}
