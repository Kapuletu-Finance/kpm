import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface Member {
  first_name: string;
  last_name: string;
  email: string;
  avatar_url: string | null;
}

export interface FeatureMember {
  id: string;
  member_id: string;
  responsibility: string | null;
  members: Member;
}

export interface FeatureChecklist {
  id: string;
  feature_id: string;
  title: string;
  is_completed: boolean;
  completed_by: string | null;
  completed_at: string | null;
  order_index: number;
}

export interface Feature {
  id: string;
  module_id: string;
  title: string;
  description: string | null;
  business_value: string | null;
  requirements: string | null;
  acceptance_criteria: string | null;
  technical_notes: string | null;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  status: 'Idea' | 'Requirements' | 'Design' | 'Development' | 'Integration' | 'Testing' | 'Approval' | 'Released';
  start_date: string | null;
  due_date: string | null;
  sprint_id?: string | null;
  modules?: any;
  feature_members?: FeatureMember[];
  feature_checklists?: FeatureChecklist[];
  created_at: string;
}

// --- Features Hooks ---

export function useModuleFeatures(projectId: string, moduleId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'modules', moduleId, 'features'],
    queryFn: async (): Promise<Feature[]> => {
      const res = await fetch(`/api/v1/projects/${projectId}/modules/${moduleId}/features`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to fetch features');
      }
      return res.json();
    },
    enabled: !!projectId && !!moduleId,
  });
}

export function useFeature(projectId: string, featureId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'features', featureId],
    queryFn: async (): Promise<Feature> => {
      const res = await fetch(`/api/v1/projects/${projectId}/features/${featureId}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to fetch feature');
      }
      return res.json();
    },
    enabled: !!projectId && !!featureId,
  });
}

export function useCreateFeature(projectId: string, moduleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<Feature>) => {
      const res = await fetch(`/api/v1/projects/${projectId}/modules/${moduleId}/features`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create feature');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'modules', moduleId, 'features'] });
      // We also invalidate the roadmap so module progress might update later if we add progress computation
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'roadmap'] });
    },
  });
}

export function useUpdateFeature(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ featureId, data }: { featureId: string; data: Partial<Feature> }) => {
      const res = await fetch(`/api/v1/projects/${projectId}/features/${featureId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update feature');
      }
      return res.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'features', variables.featureId] });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'modules', data.module_id, 'features'] });
    },
  });
}

export function useDeleteFeature(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ featureId, moduleId }: { featureId: string, moduleId: string }) => {
      const res = await fetch(`/api/v1/projects/${projectId}/features/${featureId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to delete feature');
      }
      return res.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'features', variables.featureId] });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'modules', variables.moduleId, 'features'] });
    },
  });
}

// --- Feature Checklist Hooks ---

export function useCreateChecklist(projectId: string, featureId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<FeatureChecklist>) => {
      const res = await fetch(`/api/v1/projects/${projectId}/features/${featureId}/checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create checklist item');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'features', featureId] });
    },
  });
}

export function useUpdateChecklist(projectId: string, featureId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ checklistId, data }: { checklistId: string; data: Partial<FeatureChecklist> }) => {
      const res = await fetch(`/api/v1/projects/${projectId}/features/${featureId}/checklist/${checklistId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update checklist item');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'features', featureId] });
    },
  });
}

export function useDeleteChecklist(projectId: string, featureId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (checklistId: string) => {
      const res = await fetch(`/api/v1/projects/${projectId}/features/${featureId}/checklist/${checklistId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to delete checklist item');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'features', featureId] });
    },
  });
}

// --- Feature Members Hooks ---

export function useAssignMember(projectId: string, featureId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { member_id: string; responsibility?: string }) => {
      const res = await fetch(`/api/v1/projects/${projectId}/features/${featureId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to assign member');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'features', featureId] });
    },
  });
}

export function useRemoveMember(projectId: string, featureId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (memberId: string) => {
      const res = await fetch(`/api/v1/projects/${projectId}/features/${featureId}/members/${memberId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to remove member');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'features', featureId] });
    },
  });
}
