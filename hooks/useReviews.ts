import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface Review {
  id: string;
  deliverable_id: string;
  reviewer_id: string;
  decision: 'Pending' | 'Approved' | 'Changes Requested' | 'Rejected';
  comments: string | null;
  reviewed_at: string;
  created_at: string;
  members?: {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url: string | null;
  };
}

export function useReviews(projectId: string, featureId: string, deliverableId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'features', featureId, 'deliverables', deliverableId, 'reviews'],
    queryFn: async (): Promise<Review[]> => {
      const res = await fetch(`/api/v1/projects/${projectId}/features/${featureId}/deliverables/${deliverableId}/reviews`);
      if (!res.ok) throw new Error('Failed to fetch reviews');
      return res.json();
    },
    enabled: !!projectId && !!featureId && !!deliverableId,
  });
}

export function useSubmitReview(projectId: string, featureId: string, deliverableId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<Review>) => {
      const res = await fetch(`/api/v1/projects/${projectId}/features/${featureId}/deliverables/${deliverableId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to submit review');
      return res.json();
    },
    onSuccess: () => {
      // Invalidate both the reviews and the deliverables list so the deliverable status updates in UI
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'features', featureId, 'deliverables', deliverableId, 'reviews'] });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'features', featureId, 'deliverables'] });
    },
  });
}
