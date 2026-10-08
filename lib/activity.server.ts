import { db } from '@/lib/db';
import { activity_logs } from '@/lib/db/schema';

type LogActivityParams = {
  projectId: string;
  memberId: string;
  action: string;
  entityType: string;
  entityId: string;
  description?: string;
};

export async function logActivity({
  projectId,
  memberId,
  action,
  entityType,
  entityId,
  description
}: LogActivityParams) {
  try {
    await db.insert(activity_logs).values({
      project_id: projectId,
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
