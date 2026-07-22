import { SupabaseClient } from '@supabase/supabase-js';

type LogActivityParams = {
  supabase: SupabaseClient<any, "public", any>;
  projectId: string;
  memberId: string;
  action: string;
  entityType: string;
  entityId: string;
  description?: string;
};

export async function logActivity({
  supabase,
  projectId,
  memberId,
  action,
  entityType,
  entityId,
  description
}: LogActivityParams) {
  try {
    const { error } = await supabase
      .from('activity_logs')
      .insert({
        project_id: projectId,
        member_id: memberId,
        action,
        entity_type: entityType,
        entity_id: entityId,
        description
      });

    if (error) {
      console.error('Failed to log activity:', error);
      // We don't throw to avoid breaking the main operation if logging fails
    }
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
}
