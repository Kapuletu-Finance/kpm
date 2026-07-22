'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useProjectTeam(projectId: string) {
  return useQuery({
    queryKey: ['projectTeam', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/v1/projects/${projectId}/team`);
      if (!response.ok) {
        throw new Error('Failed to fetch project team');
      }
      return response.json();
    },
    enabled: !!projectId,
  });
}

export function useAddProjectMember(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      first_name?: string;
      last_name?: string;
      email?: string;
      member_id?: string;
      project_role: string;
      functional_role?: string;
      role_responsibilities?: string[];
      review_authority: boolean;
    }) => {
      const response = await fetch(`/api/v1/projects/${projectId}/team`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add project member');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectTeam', projectId] });
    },
  });
}

export function useUpdateProjectMember(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      memberId,
      ...data
    }: {
      memberId: string;
      project_role?: string;
      functional_role?: string;
      role_responsibilities?: string[];
      review_authority?: boolean;
    }) => {
      const response = await fetch(`/api/v1/projects/${projectId}/team/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update project member');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectTeam', projectId] });
    },
  });
}

export function useRemoveProjectMember(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (memberId: string) => {
      const response = await fetch(`/api/v1/projects/${projectId}/team/${memberId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to remove project member');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectTeam', projectId] });
    },
  });
}
