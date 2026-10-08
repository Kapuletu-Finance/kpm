import { db } from '@/lib/db';
import { notifications } from '@/lib/db/schema';

export interface NotificationPayload {
  member_id: string;
  title: string;
  message?: string;
  type?: 'Assignment' | 'Mention' | 'Review' | 'System';
  entity_type?: 'Feature' | 'Deliverable' | 'Meeting' | 'Project';
  entity_id?: string;
}

/**
 * Creates a notification from server code.
 */
export async function createNotification(payload: NotificationPayload) {
  try {
    await db.insert(notifications).values({
      member_id: payload.member_id,
      title: payload.title,
      message: payload.message || null,
      type: payload.type || 'System',
      entity_type: payload.entity_type || null,
      entity_id: payload.entity_id || null,
      is_read: false,
    });
    return { success: true };
  } catch (error) {
    console.error('Failed to create notification:', error);
    return { success: false, error };
  }
}
