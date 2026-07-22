'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useOrganization() {
  return useQuery({
    queryKey: ['organization'],
    queryFn: async () => {
      const response = await fetch('/api/v1/organization');
      if (!response.ok) {
        throw new Error('Failed to fetch organization');
      }
      return response.json();
    },
  });
}

export function useMembers() {
  return useQuery({
    queryKey: ['organization', 'members'],
    queryFn: async () => {
      const response = await fetch('/api/v1/organization/members');
      if (!response.ok) {
        throw new Error('Failed to fetch members');
      }
      return response.json();
    },
  });
}

export function useRemoveMember() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (memberId: string) => {
      const response = await fetch(`/api/v1/organization/members?id=${memberId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to remove member');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization', 'members'] });
    },
  });
}

export function useInviteMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { email: string; role: string }) => {
      const response = await fetch('/api/v1/auth/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to invite member');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization', 'members'] });
    },
  });
}

export function useResendInviteMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (memberId: string) => {
      const response = await fetch('/api/v1/auth/invite/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to resend invite');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization', 'members'] });
    },
  });
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/v1/organization', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update organization');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization'] });
    },
  });
}

export function useDeleteOrganization() {
  return useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/v1/organization', { method: 'DELETE' });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete organization');
      }
      return response.json();
    },
  });
}

export function useOrganizationStandards() {
  return useQuery({
    queryKey: ['organization', 'standards'],
    queryFn: async () => {
      const response = await fetch('/api/v1/organization/standards');
      if (!response.ok) throw new Error('Failed to fetch standards');
      return response.json();
    },
  });
}

export function useUpdateOrganizationStandards() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/v1/organization/standards', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update standards');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization', 'standards'] });
    },
  });
}

export function useUpdateProfile() {
  return useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/v1/organization/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update profile');
      }
      return response.json();
    },
  });
}
