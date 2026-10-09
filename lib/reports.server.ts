import { sql, type SQL } from 'drizzle-orm';
import { db } from '@/lib/db';

// Reporting over a set of projects and a date range. Day boundaries use the organization's
// timezone. Each section is one aggregate query, so cost does not grow with row counts on
// the application side.

export type ReportScope = {
  organizationId: string;
  /** Projects the report covers (already authorized). */
  projectIds: string[];
  /** Inclusive YYYY-MM-DD dates. */
  from: string;
  to: string;
  timezone: string;
};

type Row = Record<string, unknown>;

const rows = async <T extends Row>(query: SQL) => (await db.execute(query)).rows as T[];
const num = (v: unknown) => Number(v ?? 0);

/** Monday–Friday days in [from, to], not counting days after today. */
export function workingDays(from: string, to: string, today: string): number {
  const end = to < today ? to : today;
  let count = 0;
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${end}T00:00:00Z`); t += 864e5) {
    const day = new Date(t).getUTCDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}

export async function buildReport(scope: ReportScope) {
  const { projectIds, from, to, timezone: tz } = scope;
  if (projectIds.length === 0) {
    return { range: { from, to, timezone: tz }, projects: [], members: [], achievements: [], totals: emptyTotals() };
  }

  const ids = sql.join(projectIds.map((id) => sql`${id}::uuid`), sql`, `);
  // [start, end) as timestamps at the organization's midnight
  const start = sql`(${from}::date)::timestamp at time zone ${tz}`;
  const end = sql`((${to}::date) + 1)::timestamp at time zone ${tz}`;
  const inRange = (col: SQL) => sql`${col} >= ${start} and ${col} < ${end}`;
  // Feature -> project, through modules and roadmap phases
  const featureProject = sql`
    select f.*, r.project_id from features f
    join modules m on m.id = f.module_id
    join roadmaps r on r.id = m.roadmap_id
    where r.project_id in (${ids})`;

  const [
    projectRows,
    featureStats,
    statusRows,
    sprintStats,
    milestoneRows,
    releaseStats,
    deliverableStats,
    standupStats,
    meetingStats,
    memberRows,
    achievementRows,
  ] = await Promise.all([
    rows(sql`
      select p.id, p.name, p.status, p.priority, p.start_date, p.end_date,
             coalesce(pm.first_name || ' ' || pm.last_name, 'Unassigned') as manager
      from projects p left join members pm on pm.id = p.project_manager_id
      where p.id in (${ids}) order by p.name`),
    rows(sql`
      select fp.project_id,
             count(*) as total,
             count(*) filter (where fp.status = 'Released') as released,
             count(*) filter (where ${inRange(sql`fp.completed_at`)}) as released_in_range,
             count(*) filter (where fp.due_date < (now() at time zone ${tz})::date and fp.status <> 'Released') as overdue,
             count(*) filter (where ${inRange(sql`fp.created_at`)}) as created_in_range
      from (${featureProject}) fp group by fp.project_id`),
    rows(sql`select fp.project_id, fp.status, count(*) as n from (${featureProject}) fp group by fp.project_id, fp.status`),
    rows(sql`
      select s.project_id,
             count(*) filter (where s.status = 'Completed' and s.end_date between ${from}::date and ${to}::date) as completed_in_range,
             max(s.name) filter (where s.status = 'Active') as active_sprint
      from sprints s where s.project_id in (${ids}) group by s.project_id`),
    rows(sql`
      select ms.project_id, ms.id, ms.title, ms.status, ms.due_date, ms.achieved_at
      from milestones ms where ms.project_id in (${ids})`),
    rows(sql`
      select rl.project_id,
             count(*) filter (where rl.status = 'Released' and rl.release_date between ${from}::date and ${to}::date) as shipped_in_range
      from releases rl where rl.project_id in (${ids}) group by rl.project_id`),
    rows(sql`
      select fp.project_id,
             count(d.id) filter (where ${inRange(sql`d.submitted_at`)}) as submitted_in_range,
             count(d.id) filter (where d.status in ('Pending', 'Submitted')) as awaiting_review,
             count(d.id) filter (where d.status = 'Approved' and ${inRange(sql`d.updated_at`)}) as approved_in_range
      from deliverables d join (${featureProject}) fp on d.entity_type = 'Feature' and d.entity_id = fp.id
      group by fp.project_id`),
    rows(sql`
      select du.project_id,
             count(*) as standups,
             count(*) filter (where coalesce(trim(du.blockers), '') <> '') as blockers,
             count(distinct du.member_id) as contributors
      from daily_updates du where du.project_id in (${ids}) and ${inRange(sql`du.submitted_at`)}
      group by du.project_id`),
    rows(sql`
      select mt.project_id,
             count(distinct mt.id) filter (where ${inRange(sql`mt.start_time`)}) as held_in_range,
             count(ai.id) filter (where ai.status <> 'Completed') as open_action_items
      from meetings mt left join meeting_action_items ai on ai.meeting_id = mt.id
      where mt.project_id in (${ids}) group by mt.project_id`),
    // People: everyone on a covered project, plus anyone who did something in range
    rows(sql`
      with scoped_members as (
        select distinct pmb.member_id as id from project_members pmb where pmb.project_id in (${ids})
        union
        select distinct du.member_id from daily_updates du where du.project_id in (${ids}) and ${inRange(sql`du.submitted_at`)}
      )
      select m.id, m.first_name, m.last_name, m.email, m.organization_role, m.status, m.job_title,
        (select count(distinct (du.submitted_at at time zone ${tz})::date) from daily_updates du
          where du.member_id = m.id and du.project_id in (${ids}) and ${inRange(sql`du.submitted_at`)}) as standup_days,
        (select count(*) from daily_updates du
          where du.member_id = m.id and du.project_id in (${ids}) and ${inRange(sql`du.submitted_at`)}
            and coalesce(trim(du.blockers), '') <> '') as blockers,
        (select count(*) from feature_members fm join (${featureProject}) fp on fp.id = fm.feature_id
          where fm.member_id = m.id and fp.status <> 'Released') as open_features,
        (select count(*) from feature_members fm join (${featureProject}) fp on fp.id = fm.feature_id
          where fm.member_id = m.id and ${inRange(sql`fp.completed_at`)}) as features_released,
        (select count(*) from deliverables d join (${featureProject}) fp on d.entity_type = 'Feature' and d.entity_id = fp.id
          where d.member_id = m.id and ${inRange(sql`d.submitted_at`)}) as deliverables_submitted,
        (select count(*) from deliverables d join (${featureProject}) fp on d.entity_type = 'Feature' and d.entity_id = fp.id
          where d.member_id = m.id and d.status = 'Approved' and ${inRange(sql`d.updated_at`)}) as deliverables_approved,
        (select count(*) from reviews rv join deliverables d on d.id = rv.deliverable_id
           join (${featureProject}) fp on d.entity_type = 'Feature' and d.entity_id = fp.id
          where rv.reviewer_id = m.id and ${inRange(sql`rv.reviewed_at`)}) as reviews_given,
        (select max(al.created_at) from activity_logs al
          where al.member_id = m.id and al.project_id in (${ids})) as last_active
      from members m join scoped_members sm on sm.id = m.id
      where m.organization_id = ${scope.organizationId}::uuid and m.status <> 'Invited'
      order by m.first_name, m.last_name`),
    // Achievements: milestones achieved, releases shipped and features released in range
    rows(sql`
      select * from (
        select 'Milestone' as kind, ms.title, p.name as project, ms.achieved_at as at
        from milestones ms join projects p on p.id = ms.project_id
        where ms.project_id in (${ids}) and ms.status = 'Achieved' and ${inRange(sql`ms.achieved_at`)}
        union all
        select 'Release', rl.version || coalesce(' - ' || rl.title, ''), p.name, rl.release_date::timestamp at time zone ${tz}
        from releases rl join projects p on p.id = rl.project_id
        where rl.project_id in (${ids}) and rl.status = 'Released' and rl.release_date between ${from}::date and ${to}::date
        union all
        select 'Feature', fp.title, p.name, fp.completed_at
        from (${featureProject}) fp join projects p on p.id = fp.project_id
        where ${inRange(sql`fp.completed_at`)}
      ) a order by at desc limit 100`),
  ]);

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const expectedDays = workingDays(from, to, today);
  const by = <T extends Row>(list: T[], projectId: string) => list.find((r) => r.project_id === projectId);

  const projects = projectRows.map((p) => {
    const id = p.id as string;
    const f = by(featureStats, id);
    const total = num(f?.total);
    const released = num(f?.released);
    const ms = milestoneRows.filter((m) => m.project_id === id);
    return {
      id,
      name: p.name as string,
      status: p.status as string,
      priority: p.priority as string,
      manager: p.manager as string,
      start_date: p.start_date as string | null,
      end_date: p.end_date as string | null,
      features: {
        total,
        released,
        completion: total ? Math.round((released / total) * 100) : 0,
        released_in_range: num(f?.released_in_range),
        created_in_range: num(f?.created_in_range),
        overdue: num(f?.overdue),
        by_status: Object.fromEntries(statusRows.filter((s) => s.project_id === id).map((s) => [s.status ?? 'Idea', num(s.n)])),
      },
      sprints: {
        completed_in_range: num(by(sprintStats, id)?.completed_in_range),
        active: (by(sprintStats, id)?.active_sprint as string | null) ?? null,
      },
      milestones: {
        total: ms.length,
        achieved: ms.filter((m) => m.status === 'Achieved').length,
        missed: ms.filter((m) => m.status === 'Missed').length,
        upcoming: ms
          .filter((m) => m.status !== 'Achieved' && m.status !== 'Missed' && m.due_date)
          .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)))
          .slice(0, 3)
          .map((m) => ({ title: m.title as string, due_date: m.due_date as string, overdue: String(m.due_date) < today })),
      },
      releases_shipped_in_range: num(by(releaseStats, id)?.shipped_in_range),
      deliverables: {
        submitted_in_range: num(by(deliverableStats, id)?.submitted_in_range),
        approved_in_range: num(by(deliverableStats, id)?.approved_in_range),
        awaiting_review: num(by(deliverableStats, id)?.awaiting_review),
      },
      standups: {
        submitted_in_range: num(by(standupStats, id)?.standups),
        blockers_in_range: num(by(standupStats, id)?.blockers),
        contributors: num(by(standupStats, id)?.contributors),
      },
      meetings: {
        held_in_range: num(by(meetingStats, id)?.held_in_range),
        open_action_items: num(by(meetingStats, id)?.open_action_items),
      },
    };
  });

  const members = memberRows.map((m) => {
    const standupDays = num(m.standup_days);
    return {
      id: m.id as string,
      name: `${m.first_name} ${m.last_name}`.trim(),
      email: m.email as string,
      role: m.organization_role as string,
      status: m.status as string,
      job_title: (m.job_title as string | null) ?? null,
      standup_days: standupDays,
      expected_days: expectedDays,
      // Share of working days in range with at least one standup
      standup_rate: expectedDays ? Math.min(100, Math.round((standupDays / expectedDays) * 100)) : null,
      blockers: num(m.blockers),
      open_features: num(m.open_features),
      features_released: num(m.features_released),
      deliverables_submitted: num(m.deliverables_submitted),
      deliverables_approved: num(m.deliverables_approved),
      reviews_given: num(m.reviews_given),
      last_active: m.last_active ? new Date(m.last_active as string).toISOString() : null,
    };
  });

  const achievements = achievementRows.map((a) => ({
    kind: a.kind as 'Milestone' | 'Release' | 'Feature',
    title: a.title as string,
    project: a.project as string,
    at: a.at ? new Date(a.at as string).toISOString() : null,
  }));

  const sum = (pick: (p: (typeof projects)[number]) => number) => projects.reduce((t, p) => t + pick(p), 0);
  const totals = {
    projects: projects.length,
    active_projects: projects.filter((p) => p.status === 'Active').length,
    features_released: sum((p) => p.features.released_in_range),
    sprints_completed: sum((p) => p.sprints.completed_in_range),
    milestones_achieved: achievements.filter((a) => a.kind === 'Milestone').length,
    releases_shipped: sum((p) => p.releases_shipped_in_range),
    deliverables_submitted: sum((p) => p.deliverables.submitted_in_range),
    deliverables_awaiting_review: sum((p) => p.deliverables.awaiting_review),
    standups: sum((p) => p.standups.submitted_in_range),
    blockers: sum((p) => p.standups.blockers_in_range),
    meetings: sum((p) => p.meetings.held_in_range),
    overdue_features: sum((p) => p.features.overdue),
    expected_days: expectedDays,
  };

  return { range: { from, to, timezone: tz }, totals, projects, members, achievements };
}

function emptyTotals() {
  return {
    projects: 0, active_projects: 0, features_released: 0, sprints_completed: 0, milestones_achieved: 0,
    releases_shipped: 0, deliverables_submitted: 0, deliverables_awaiting_review: 0, standups: 0,
    blockers: 0, meetings: 0, overdue_features: 0, expected_days: 0,
  };
}

export type Report = Awaited<ReturnType<typeof buildReport>>;

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  // Neutralize spreadsheet formulas, then quote when needed
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

const toCsv = (header: string[], data: unknown[][]) =>
  [header, ...data].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';

export function reportToCsv(report: Report, section: 'projects' | 'members' | 'achievements'): string {
  if (section === 'members') {
    return toCsv(
      ['Name', 'Email', 'Role', 'Status', 'Job title', 'Standup days', 'Working days', 'Standup rate %', 'Blockers reported',
        'Open features', 'Features released', 'Deliverables submitted', 'Deliverables approved', 'Reviews given', 'Last active'],
      report.members.map((m) => [m.name, m.email, m.role, m.status, m.job_title, m.standup_days, m.expected_days, m.standup_rate,
        m.blockers, m.open_features, m.features_released, m.deliverables_submitted, m.deliverables_approved, m.reviews_given, m.last_active]),
    );
  }
  if (section === 'achievements') {
    return toCsv(['Date', 'Type', 'Title', 'Project'], report.achievements.map((a) => [a.at, a.kind, a.title, a.project]));
  }
  return toCsv(
    ['Project', 'Status', 'Priority', 'Manager', 'Features', 'Released', 'Completion %', 'Released in range', 'Overdue',
      'Sprints completed', 'Active sprint', 'Milestones achieved', 'Milestones missed', 'Releases shipped',
      'Deliverables submitted', 'Deliverables approved', 'Awaiting review', 'Standups', 'Blockers', 'Meetings held', 'Open action items'],
    report.projects.map((p) => [p.name, p.status, p.priority, p.manager, p.features.total, p.features.released, p.features.completion,
      p.features.released_in_range, p.features.overdue, p.sprints.completed_in_range, p.sprints.active, p.milestones.achieved,
      p.milestones.missed, p.releases_shipped_in_range, p.deliverables.submitted_in_range, p.deliverables.approved_in_range,
      p.deliverables.awaiting_review, p.standups.submitted_in_range, p.standups.blockers_in_range, p.meetings.held_in_range,
      p.meetings.open_action_items]),
  );
}

// ---------------------------------------------------------------------------
// Request helpers
// ---------------------------------------------------------------------------

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Reads ?from=YYYY-MM-DD&to=YYYY-MM-DD, defaulting to the 30 days ending today (in `tz`).
 * Returns an error message for malformed or reversed ranges, or ranges over 366 days.
 */
export function parseRange(url: URL, tz: string): { from: string; to: string } | { error: string } {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const to = url.searchParams.get('to') || today;
  const from = url.searchParams.get('from') || new Date(Date.parse(`${to}T00:00:00Z`) - 29 * 864e5).toISOString().slice(0, 10);
  if (!DATE.test(from) || !DATE.test(to) || Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to))) {
    return { error: 'Dates must be in YYYY-MM-DD format' };
  }
  if (from > to) return { error: 'The start date must be on or before the end date' };
  if (Date.parse(to) - Date.parse(from) > 366 * 864e5) return { error: 'Reports cover at most one year' };
  return { from, to };
}

/** A CSV download response. */
export function csvResponse(csv: string, filename: string) {
  return new Response('﻿' + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename.replace(/[^\w.-]/g, '_')}"`,
    },
  });
}
