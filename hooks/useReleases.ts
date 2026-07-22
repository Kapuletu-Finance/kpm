import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface Release {
  id: string;
  project_id: string;
  version: string;
  title: string | null;
  release_notes: string | null;
  deployment_checklist: any[];
  rollback_plan: string | null;
  release_date: string | null;
  status: 'Planned' | 'Staging' | 'Released' | 'Rolled Back';
  created_at: string;
  updated_at: string;
  features?: {
    id: string;
    title: string;
    status: string;
    priority?: string;
  }[];
}

export function useReleases(projectId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'releases'],
    queryFn: async (): Promise<Release[]> => {
      const res = await fetch(`/api/v1/projects/${projectId}/releases`);
      if (!res.ok) throw new Error('Failed to fetch releases');
      return res.json();
    },
    enabled: !!projectId,
  });
}

export function useRelease(projectId: string, releaseId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'releases', releaseId],
    queryFn: async (): Promise<Release> => {
      const res = await fetch(`/api/v1/projects/${projectId}/releases/${releaseId}`);
      if (!res.ok) throw new Error('Failed to fetch release');
      return res.json();
    },
    enabled: !!projectId && !!releaseId,
  });
}

export function useCreateRelease(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Release>) => {
      const res = await fetch(`/api/v1/projects/${projectId}/releases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create release');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'releases'] });
    },
  });
}

export function useUpdateRelease(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ releaseId, data }: { releaseId: string, data: Partial<Release> }) => {
      const res = await fetch(`/api/v1/projects/${projectId}/releases/${releaseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update release');
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'releases'] });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'releases', variables.releaseId] });
    },
  });
}

export function useAssignFeaturesToRelease(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ releaseId, featureIds, action }: { releaseId: string, featureIds: string[], action: 'assign' | 'remove' }) => {
      const res = await fetch(`/api/v1/projects/${projectId}/releases/${releaseId}/features`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ featureIds, action }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to assign features');
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'releases'] });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'releases', variables.releaseId] });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'features'] });
    },
  });
}
