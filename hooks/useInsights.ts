'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

// Hooks for oversight and delivery insights: reports, org-wide standups, member overviews,
// milestones, sprint insights/retrospectives and feature dependencies.

async function getJson<T>(url: string, fallback: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || fallback);
  }
  return res.json();
}

async function sendJson<T>(url: string, method: string, data: unknown, fallback: string): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || fallback);
  }
  return res.json();
}

const qs = (params: Record<string, string | undefined | null>) => {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();
  return s ? `?${s}` : '';
};

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export type ReportRange = { from?: string; to?: string };

export type ProjectReport = {
  id: string;
  name: string;
  status: string;
  priority: string;
  manager: string;
  start_date: string | null;
  end_date: string | null;
  features: { total: number; released: number; completion: number; released_in_range: number; created_in_range: number; overdue: number; by_status: Record<string, number> };
  sprints: { completed_in_range: number; active: string | null };
  milestones: { total: number; achieved: number; missed: number; upcoming: { title: string; due_date: string; overdue: boolean }[] };
  releases_shipped_in_range: number;
  deliverables: { submitted_in_range: number; approved_in_range: number; awaiting_review: number };
  standups: { submitted_in_range: number; blockers_in_range: number; contributors: number };
  meetings: { held_in_range: number; open_action_items: number };
};

export type MemberReport = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  job_title: string | null;
  standup_days: number;
  expected_days: number;
  standup_rate: number | null;
  blockers: number;
  open_features: number;
  features_released: number;
  deliverables_submitted: number;
  deliverables_approved: number;
  reviews_given: number;
  last_active: string | null;
};

export type Report = {
  range: { from: string; to: string; timezone: string };
  totals: Record<string, number>;
  projects: ProjectReport[];
  members: MemberReport[];
  achievements: { kind: 'Milestone' | 'Release' | 'Feature'; title: string; project: string; at: string | null }[];
  scope?: 'organization' | 'managed';
};

/** Organization report (admins: whole org; PMs: their projects), or a single project's report. */
export function useReport(range: ReportRange, projectId?: string, projectScoped = false) {
  const url = projectScoped
    ? `/api/v1/projects/${projectId}/report${qs({ ...range })}`
    : `/api/v1/organization/reports${qs({ ...range, projectId })}`;
  return useQuery({
    queryKey: ['report', projectScoped ? 'project' : 'organization', projectId ?? 'all', range.from, range.to],
    queryFn: () => getJson<Report>(url, 'Failed to load report'),
    enabled: !projectScoped || !!projectId,
  });
}

/** The CSV download URL for a report section. */
export function reportCsvUrl(section: 'projects' | 'members' | 'achievements', range: ReportRange, projectId?: string, projectScoped = false) {
  return projectScoped
    ? `/api/v1/projects/${projectId}/report${qs({ ...range, format: 'csv', section })}`
    : `/api/v1/organization/reports${qs({ ...range, projectId, format: 'csv', section })}`;
}

// ---------------------------------------------------------------------------
// Org-wide standups
// ---------------------------------------------------------------------------

type MemberSummary = { id: string; first_name: string; last_name: string; avatar_url: string | null };

export type StandupDay = {
  date: string;
  timezone: string;
  is_weekend: boolean;
  summary: { expected: number; submitted: number; missing: number; blockers: number };
  projects: {
    id: string;
    name: string;
    status: string;
    expected: number;
    blockers: number;
    missing: (MemberSummary & { project_role: string })[];
    submitted: {
      id: string;
      member_id: string;
      yesterday: string | null;
      today: string | null;
      blockers: string | null;
      risks: string | null;
      help_needed: string | null;
      manager_comments: string | null;
      submitted_at: string;
      members: MemberSummary | null;
    }[];
  }[];
};

export function useOrganizationStandups(date?: string, projectId?: string) {
  return useQuery({
    queryKey: ['organization', 'standups', date ?? 'today', projectId ?? 'all'],
    queryFn: () => getJson<StandupDay>(`/api/v1/organization/standups${qs({ date, projectId })}`, 'Failed to load standups'),
  });
}

// ---------------------------------------------------------------------------
// Member overview
// ---------------------------------------------------------------------------

export type MemberOverview = {
  member: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    job_title: string | null;
    avatar_url: string | null;
    organization_role: string;
    status: string;
    created_at: string;
    last_sign_in_at: string | null;
  };
  range: { from: string; to: string; timezone: string };
  stats: MemberReport | null;
  projects: { project_id: string; name: string; status: string; project_role: string; functional_role: string | null; review_authority: boolean | null }[];
  open_features: { id: string; title: string; status: string; priority: string; due_date: string | null; responsibility: string | null; project_id: string; project_name: string }[];
  recent_deliverables: { id: string; title: string; type: string | null; status: string; link: string | null; submitted_at: string; feature_id: string; feature_title: string; project_id: string }[];
  recent_standups: { id: string; project_id: string; project_name: string; yesterday: string | null; today: string | null; blockers: string | null; submitted_at: string }[];
  open_action_items: { id: string; description: string; status: string; due_date: string | null; meeting_id: string; meeting_title: string; project_id: string }[];
  activity: { id: string; action: string; entity_type: string; description: string | null; created_at: string; project: { id: string; name: string } | null }[];
  scope: 'organization' | 'shared-projects';
};

export function useMemberOverview(memberId: string, range: ReportRange) {
  return useQuery({
    queryKey: ['organization', 'members', memberId, 'overview', range.from, range.to],
    queryFn: () => getJson<MemberOverview>(`/api/v1/organization/members/${memberId}${qs({ ...range })}`, 'Failed to load member'),
    enabled: !!memberId,
  });
}

// ---------------------------------------------------------------------------
// Milestones
// ---------------------------------------------------------------------------

export type Milestone = {
  id: string;
  project_id: string;
  roadmap_id: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  status: 'Planned' | 'In Progress' | 'Achieved' | 'Missed';
  achieved_at: string | null;
  created_at: string;
  phase?: { id: string; name: string } | null;
};

export type MilestoneInput = Partial<Pick<Milestone, 'title' | 'description' | 'due_date' | 'status' | 'roadmap_id'>>;

export function useMilestones(projectId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'milestones'],
    queryFn: () => getJson<Milestone[]>(`/api/v1/projects/${projectId}/milestones`, 'Failed to load milestones'),
    enabled: !!projectId,
  });
}

export function useSaveMilestone(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: MilestoneInput }) =>
      id
        ? sendJson<Milestone>(`/api/v1/projects/${projectId}/milestones/${id}`, 'PATCH', data, 'Failed to update milestone')
        : sendJson<Milestone>(`/api/v1/projects/${projectId}/milestones`, 'POST', data, 'Failed to create milestone'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'milestones'] }),
  });
}

export function useDeleteMilestone(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sendJson(`/api/v1/projects/${projectId}/milestones/${id}`, 'DELETE', undefined, 'Failed to delete milestone'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'milestones'] }),
  });
}

// ---------------------------------------------------------------------------
// Sprint insights, retrospective, completion
// ---------------------------------------------------------------------------

export type SprintInsights = {
  total: number;
  completed: number;
  status_counts: Record<string, number>;
  burndown: { date: string; ideal: number; remaining: number | null }[];
  velocity: { sprint_id: string; name: string; completed: number }[];
  standups: number;
};

export function useSprintInsights(projectId: string, sprintId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'sprints', sprintId, 'insights'],
    queryFn: () => getJson<SprintInsights>(`/api/v1/projects/${projectId}/sprints/${sprintId}/insights`, 'Failed to load sprint insights'),
    enabled: !!projectId && !!sprintId,
  });
}

export type Retrospective = {
  what_went_well: string | null;
  what_didnt_go_well: string | null;
  lessons_learned: string | null;
  process_improvements: string | null;
  updated_at?: string;
};

export function useRetrospective(projectId: string, sprintId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'sprints', sprintId, 'retrospective'],
    queryFn: () => getJson<Retrospective | null>(`/api/v1/projects/${projectId}/sprints/${sprintId}/retrospective`, 'Failed to load retrospective'),
    enabled: !!projectId && !!sprintId,
  });
}

export function useSaveRetrospective(projectId: string, sprintId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Retrospective>) =>
      sendJson(`/api/v1/projects/${projectId}/sprints/${sprintId}/retrospective`, 'PUT', data, 'Failed to save retrospective'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'sprints', sprintId, 'retrospective'] }),
  });
}

export function useCompleteSprint(projectId: string, sprintId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (carry_over_to: string) =>
      sendJson<{ carried_over: number }>(`/api/v1/projects/${projectId}/sprints/${sprintId}/complete`, 'POST', { carry_over_to }, 'Failed to complete sprint'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'sprints'] });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'features'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Feature dependencies
// ---------------------------------------------------------------------------

export type FeatureDependency = {
  id: string;
  relation: 'Blocks' | 'Blocked By' | 'Relates To';
  notes: string | null;
  feature: { id: string; title: string; status: string };
  blocking: boolean;
};

export function useFeatureDependencies(projectId: string, featureId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'features', featureId, 'dependencies'],
    queryFn: () => getJson<FeatureDependency[]>(`/api/v1/projects/${projectId}/features/${featureId}/dependencies`, 'Failed to load dependencies'),
    enabled: !!projectId && !!featureId,
  });
}

/** Other features in the project that this one can be linked to (loaded on demand). */
export function useLinkCandidates(projectId: string, featureId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['projects', projectId, 'features', featureId, 'link-candidates'],
    queryFn: () =>
      getJson<{ id: string; title: string; status: string; module_name: string }[]>(
        `/api/v1/projects/${projectId}/features/${featureId}/dependencies?candidates=1`,
        'Failed to load features',
      ),
    enabled: enabled && !!projectId && !!featureId,
  });
}

export function useLinkFeature(projectId: string, featureId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { depends_on_feature_id: string; dependency_type: string }) =>
      sendJson(`/api/v1/projects/${projectId}/features/${featureId}/dependencies`, 'POST', data, 'Failed to link features'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'features'] }),
  });
}

export function useUnlinkFeature(projectId: string, featureId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dependencyId: string) =>
      sendJson(`/api/v1/projects/${projectId}/features/${featureId}/dependencies/${dependencyId}`, 'DELETE', undefined, 'Failed to unlink features'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'features'] }),
  });
}
