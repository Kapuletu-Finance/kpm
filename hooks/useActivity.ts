import { useQuery } from '@tanstack/react-query';

export type ActivityLog = {
  id: string;
  project_id: string;
  member_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  description: string;
  created_at: string;
  member: {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url: string | null;
    role: string;
  };
  project?: {
    id: string;
    name: string;
  };
};

type ActivityResponse = {
  data: ActivityLog[];
  count: number;
  offset: number;
  limit: number;
};

export function useProjectActivity(projectId: string, limit = 50, offset = 0) {
  return useQuery({
    queryKey: ['activity', 'project', projectId, limit, offset],
    queryFn: async (): Promise<ActivityResponse> => {
      const res = await fetch(`/api/v1/projects/${projectId}/activity?limit=${limit}&offset=${offset}`);
      if (!res.ok) throw new Error('Failed to fetch project activity');
      return res.json();
    },
    enabled: !!projectId,
  });
}

export function useOrganizationActivity(limit = 50, offset = 0) {
  return useQuery({
    queryKey: ['activity', 'organization', limit, offset],
    queryFn: async (): Promise<ActivityResponse> => {
      const res = await fetch(`/api/v1/organization/activity?limit=${limit}&offset=${offset}`);
      if (!res.ok) throw new Error('Failed to fetch organization activity');
      return res.json();
    },
  });
}
