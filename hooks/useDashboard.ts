import { useQuery } from '@tanstack/react-query';

export type DashboardStats = {
  activeProjects: number;
  assignedFeatures: number;
  pendingDeliverables: number;
  upcomingMeetings: number;
};

export type DashboardFeature = {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  project_id: string;
  project_name: string;
};

export type DashboardDeliverable = {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  entity_type: string;
  entity_id: string;
};

export type DashboardMeeting = {
  id: string;
  title: string;
  date: string;
  start_time: string;
  type: string;
  project_id: string;
  project_name: string;
};

export type DashboardData = {
  stats: DashboardStats;
  assignedFeatures: DashboardFeature[];
  pendingDeliverables: DashboardDeliverable[];
  upcomingMeetings: DashboardMeeting[];
};

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard', 'me'],
    queryFn: async (): Promise<DashboardData> => {
      const res = await fetch('/api/v1/dashboard/me');
      if (!res.ok) throw new Error('Failed to fetch dashboard data');
      return res.json();
    },
  });
}

export function useOrgDashboard() {
  return useQuery({
    queryKey: ['dashboard', 'organization'],
    queryFn: async () => {
      const res = await fetch('/api/v1/dashboard/organization');
      if (!res.ok) throw new Error('Failed to fetch org dashboard data');
      return res.json();
    },
  });
}

export function useManagerDashboard() {
  return useQuery({
    queryKey: ['dashboard', 'manager'],
    queryFn: async () => {
      const res = await fetch('/api/v1/dashboard/manager');
      if (!res.ok) throw new Error('Failed to fetch manager dashboard data');
      return res.json();
    },
  });
}
