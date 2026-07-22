import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface Deliverable {
  id: string;
  entity_type: string;
  entity_id: string;
  member_id: string;
  title: string;
  type: 'GitHub PR' | 'Figma Link' | 'API Doc' | 'Document' | 'Video' | 'Screenshot' | 'Demo' | 'Commit' | 'Deployment URL';
  link: string;
  description: string | null;
  status: 'Pending' | 'Submitted' | 'Reviewed' | 'Approved' | 'Rejected';
  created_at: string;
  members?: {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url: string | null;
  };
}

export function useDeliverables(projectId: string, featureId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'features', featureId, 'deliverables'],
    queryFn: async (): Promise<Deliverable[]> => {
      const res = await fetch(`/api/v1/projects/${projectId}/features/${featureId}/deliverables`);
      if (!res.ok) throw new Error('Failed to fetch deliverables');
      return res.json();
    },
    enabled: !!projectId && !!featureId,
  });
}

export function useSubmitDeliverable(projectId: string, featureId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<Deliverable>) => {
      const res = await fetch(`/api/v1/projects/${projectId}/features/${featureId}/deliverables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to submit deliverable');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'features', featureId, 'deliverables'] });
    },
  });
}

export function useDeleteDeliverable(projectId: string, featureId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (deliverableId: string) => {
      const res = await fetch(`/api/v1/projects/${projectId}/features/${featureId}/deliverables/${deliverableId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete deliverable');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'features', featureId, 'deliverables'] });
    },
  });
}
