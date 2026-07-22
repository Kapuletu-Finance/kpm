import { createClient } from '@/lib/supabase/server';

export interface NotificationPayload {
  member_id: string;
  title: string;
  message?: string;
  type?: 'Assignment' | 'Mention' | 'Review' | 'System';
  entity_type?: 'Feature' | 'Deliverable' | 'Meeting' | 'Project';
  entity_id?: string;
}

/**
 * Utility to securely create a notification from the server side.
 */
export async function createNotification(payload: NotificationPayload) {
  try {
    const supabase = await createClient();
    
    // Make sure we have a valid session to perform insertions if RLS requires it.
    // If not, we could use a service role key. Assuming the authenticated user
    // can insert notifications for other users as long as they are authenticated.
    
    const { error } = await supabase
      .from('notifications')
      .insert({
        member_id: payload.member_id,
        title: payload.title,
        message: payload.message || null,
        type: payload.type || 'System',
        entity_type: payload.entity_type || null,
        entity_id: payload.entity_id || null,
        is_read: false
      });

    if (error) {
      console.error('Failed to create notification:', error);
      return { success: false, error };
    }

    return { success: true };
  } catch (error) {
    console.error('Error creating notification:', error);
    return { success: false, error };
  }
}
