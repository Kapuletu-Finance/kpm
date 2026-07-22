import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface Meeting {
  id: string;
  project_id: string;
  sprint_id: string | null;
  title: string;
  objective: string | null;
  agenda: string | null;
  type: 'Online' | 'Physical';
  meeting_link: string | null;
  location: string | null;
  start_time: string;
  end_time: string;
  minutes: string | null;
  decisions: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  members?: {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url: string | null;
  };
}

export interface MeetingParticipant {
  member_id: string;
  joined_at: string;
  members: {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url: string | null;
    email: string;
  };
}

export interface MeetingActionItem {
  id: string;
  meeting_id: string;
  description: string;
  assigned_to: string | null;
  status: 'Pending' | 'In Progress' | 'Completed';
  due_date: string | null;
  created_at: string;
  members?: {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url: string | null;
  };
}

export function useMeetings(projectId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'meetings'],
    queryFn: async (): Promise<Meeting[]> => {
      const res = await fetch(`/api/v1/projects/${projectId}/meetings`);
      if (!res.ok) throw new Error('Failed to fetch meetings');
      return res.json();
    },
    enabled: !!projectId,
  });
}

export function useMeeting(projectId: string, meetingId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'meetings', meetingId],
    queryFn: async (): Promise<Meeting> => {
      const res = await fetch(`/api/v1/projects/${projectId}/meetings/${meetingId}`);
      if (!res.ok) throw new Error('Failed to fetch meeting');
      return res.json();
    },
    enabled: !!projectId && !!meetingId,
  });
}

export function useCreateMeeting(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Meeting>) => {
      const res = await fetch(`/api/v1/projects/${projectId}/meetings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create meeting');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'meetings'] });
    },
  });
}

export function useUpdateMeeting(projectId: string, meetingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Meeting>) => {
      const res = await fetch(`/api/v1/projects/${projectId}/meetings/${meetingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update meeting');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'meetings', meetingId] });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'meetings'] });
    },
  });
}

export function useDeleteMeeting(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (meetingId: string) => {
      const res = await fetch(`/api/v1/projects/${projectId}/meetings/${meetingId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete meeting');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'meetings'] });
    },
  });
}

// Participants Hooks
export function useMeetingParticipants(projectId: string, meetingId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'meetings', meetingId, 'participants'],
    queryFn: async (): Promise<MeetingParticipant[]> => {
      const res = await fetch(`/api/v1/projects/${projectId}/meetings/${meetingId}/participants`);
      if (!res.ok) throw new Error('Failed to fetch participants');
      return res.json();
    },
    enabled: !!projectId && !!meetingId,
  });
}

export function useAddMeetingParticipant(projectId: string, meetingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (memberId: string) => {
      const res = await fetch(`/api/v1/projects/${projectId}/meetings/${meetingId}/participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: memberId }),
      });
      if (!res.ok) throw new Error('Failed to add participant');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'meetings', meetingId, 'participants'] });
    },
  });
}

export function useRemoveMeetingParticipant(projectId: string, meetingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (memberId: string) => {
      const res = await fetch(`/api/v1/projects/${projectId}/meetings/${meetingId}/participants/${memberId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to remove participant');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'meetings', meetingId, 'participants'] });
    },
  });
}

// Action Items Hooks
export function useMeetingActionItems(projectId: string, meetingId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'meetings', meetingId, 'action-items'],
    queryFn: async (): Promise<MeetingActionItem[]> => {
      const res = await fetch(`/api/v1/projects/${projectId}/meetings/${meetingId}/action-items`);
      if (!res.ok) throw new Error('Failed to fetch action items');
      return res.json();
    },
    enabled: !!projectId && !!meetingId,
  });
}

export function useCreateActionItem(projectId: string, meetingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<MeetingActionItem>) => {
      const res = await fetch(`/api/v1/projects/${projectId}/meetings/${meetingId}/action-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create action item');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'meetings', meetingId, 'action-items'] });
    },
  });
}

export function useUpdateActionItem(projectId: string, meetingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<MeetingActionItem> & { id: string }) => {
      const res = await fetch(`/api/v1/projects/${projectId}/meetings/${meetingId}/action-items/${data.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update action item');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'meetings', meetingId, 'action-items'] });
    },
  });
}

export function useDeleteActionItem(projectId: string, meetingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (actionItemId: string) => {
      const res = await fetch(`/api/v1/projects/${projectId}/meetings/${meetingId}/action-items/${actionItemId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete action item');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'meetings', meetingId, 'action-items'] });
    },
  });
}
