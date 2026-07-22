import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface Standup {
  id: string;
  project_id: string;
  sprint_id: string | null;
  member_id: string;
  yesterday: string;
  today: string;
  blockers: string | null;
  risks: string | null;
  help_needed: string | null;
  manager_comments: string | null;
  submitted_at: string;
  created_at: string;
  members?: {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url: string | null;
  };
  sprints?: {
    id: string;
    name: string;
  };
}

export function useStandups(projectId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'standups'],
    queryFn: async (): Promise<Standup[]> => {
      const res = await fetch(`/api/v1/projects/${projectId}/standups`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to fetch standups');
      }
      return res.json();
    },
    enabled: !!projectId,
  });
}

export function useSubmitStandup(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<Standup>) => {
      const res = await fetch(`/api/v1/projects/${projectId}/standups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to submit standup');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'standups'] });
    },
  });
}

export function useUpdateStandup(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ standupId, data }: { standupId: string; data: Partial<Standup> }) => {
      const res = await fetch(`/api/v1/projects/${projectId}/standups/${standupId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update standup');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'standups'] });
    },
  });
}
