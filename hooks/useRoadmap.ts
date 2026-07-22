import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// --- Types ---
export interface RoadmapModule {
  id: string;
  roadmap_id: string;
  name: string;
  description: string | null;
  objectives: string | null;
  status: 'Not Started' | 'In Progress' | 'Completed';
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  order_index: number;
}

export interface RoadmapPhase {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  order_index: number;
  modules: RoadmapModule[];
}

// --- Roadmap Phase Hooks ---

export function useRoadmap(projectId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'roadmap'],
    queryFn: async (): Promise<RoadmapPhase[]> => {
      const res = await fetch(`/api/v1/projects/${projectId}/roadmap`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to fetch roadmap');
      }
      return res.json();
    },
    enabled: !!projectId,
  });
}

export function useCreateRoadmapPhase(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<RoadmapPhase>) => {
      const res = await fetch(`/api/v1/projects/${projectId}/roadmap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create roadmap phase');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'roadmap'] });
    },
  });
}

export function useUpdateRoadmapPhase(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ phaseId, data }: { phaseId: string; data: Partial<RoadmapPhase> }) => {
      const res = await fetch(`/api/v1/projects/${projectId}/roadmap/${phaseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update roadmap phase');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'roadmap'] });
    },
  });
}

export function useDeleteRoadmapPhase(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (phaseId: string) => {
      const res = await fetch(`/api/v1/projects/${projectId}/roadmap/${phaseId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to delete roadmap phase');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'roadmap'] });
    },
  });
}

// --- Roadmap Module Hooks ---

export function useCreateRoadmapModule(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<RoadmapModule>) => {
      const res = await fetch(`/api/v1/projects/${projectId}/modules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create module');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'roadmap'] });
    },
  });
}

export function useUpdateRoadmapModule(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ moduleId, data }: { moduleId: string; data: Partial<RoadmapModule> }) => {
      const res = await fetch(`/api/v1/projects/${projectId}/modules/${moduleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update module');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'roadmap'] });
    },
  });
}

export function useDeleteRoadmapModule(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (moduleId: string) => {
      const res = await fetch(`/api/v1/projects/${projectId}/modules/${moduleId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to delete module');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'roadmap'] });
    },
  });
}
