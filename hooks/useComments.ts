import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface Comment {
  id: string;
  entity_type: string;
  entity_id: string;
  member_id: string;
  comment: string;
  parent_comment_id: string | null;
  created_at: string;
  updated_at: string;
  members?: {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url: string | null;
  };
}

export function useComments(projectId: string, entityType: string, entityId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'comments', entityType, entityId],
    queryFn: async (): Promise<Comment[]> => {
      const res = await fetch(`/api/v1/projects/${projectId}/comments?entityType=${entityType}&entityId=${entityId}`);
      if (!res.ok) throw new Error('Failed to fetch comments');
      return res.json();
    },
    enabled: !!projectId && !!entityType && !!entityId,
  });
}

export function useSubmitComment(projectId: string, entityType: string, entityId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { comment: string, parent_comment_id?: string | null }) => {
      const res = await fetch(`/api/v1/projects/${projectId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_type: entityType,
          entity_id: entityId,
          ...data
        }),
      });
      if (!res.ok) throw new Error('Failed to submit comment');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'comments', entityType, entityId] });
    },
  });
}

export function useDeleteComment(projectId: string, entityType: string, entityId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (commentId: string) => {
      const res = await fetch(`/api/v1/projects/${projectId}/comments/${commentId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete comment');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'comments', entityType, entityId] });
    },
  });
}
