import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Feature } from './useFeatures';

export interface Sprint {
  id: string;
  project_id: string;
  name: string;
  goal: string | null;
  definition_of_success: string | null;
  risks: string | null;
  start_date: string | null;
  end_date: string | null;
  status: 'Planning' | 'Active' | 'Review' | 'Completed';
  features?: Feature[];
  created_at: string;
}

export function useSprints(projectId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'sprints'],
    queryFn: async (): Promise<Sprint[]> => {
      const res = await fetch(`/api/v1/projects/${projectId}/sprints`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to fetch sprints');
      }
      return res.json();
    },
    enabled: !!projectId,
  });
}

export function useSprint(projectId: string, sprintId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'sprints', sprintId],
    queryFn: async (): Promise<Sprint> => {
      const res = await fetch(`/api/v1/projects/${projectId}/sprints/${sprintId}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to fetch sprint');
      }
      return res.json();
    },
    enabled: !!projectId && !!sprintId,
  });
}

export function useCreateSprint(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<Sprint>) => {
      const res = await fetch(`/api/v1/projects/${projectId}/sprints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create sprint');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'sprints'] });
    },
  });
}

export function useUpdateSprint(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sprintId, data }: { sprintId: string; data: Partial<Sprint> }) => {
      const res = await fetch(`/api/v1/projects/${projectId}/sprints/${sprintId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update sprint');
      }
      return res.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'sprints'] });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'sprints', variables.sprintId] });
    },
  });
}

export function useDeleteSprint(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sprintId: string) => {
      const res = await fetch(`/api/v1/projects/${projectId}/sprints/${sprintId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to delete sprint');
      }
      return res.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'sprints'] });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'sprints', variables] });
    },
  });
}

export function useBacklogFeatures(projectId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'features', 'backlog'],
    queryFn: async (): Promise<Feature[]> => {
      const res = await fetch(`/api/v1/projects/${projectId}/features/backlog`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to fetch backlog features');
      }
      return res.json();
    },
    enabled: !!projectId,
  });
}
