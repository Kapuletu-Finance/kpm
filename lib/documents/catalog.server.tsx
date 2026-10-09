import type { ReactElement } from 'react';
import type { DocumentProps } from '@react-pdf/renderer';
import { and, asc, desc, eq, getTableColumns, sql } from 'drizzle-orm';
import { format, parseISO } from 'date-fns';
import { Text as PdfText, View as PdfView } from '@react-pdf/renderer';
import { db } from '@/lib/db';
import {
  daily_updates, feature_members, features, meeting_action_items, meeting_participants, meetings, members, milestones,
  organizations, project_members, projects, releases, sprint_retrospectives, sprints,
} from '@/lib/db/schema';
import {
  canManageProject, getMember, getOverseenProjectIds, getProjectAccess, meetingInProject,
  memberSummary, selectActionItems, type Member,
} from '@/lib/db/queries';
import { buildReport, parseRange } from '@/lib/reports.server';
import { getMemberOverview } from '@/lib/member-overview.server';
import { getSprintInsights } from '@/lib/sprint-insights.server';
import { getStandupDay } from '@/lib/standups.server';
import { organizationTimezone, todayIn } from '@/lib/timezone';
import type { DocumentBranding } from './branding.server';
import { mdToPlain } from './text';
import {
  DataTable, KeyValues, OfficialDocument, Paragraph, PrintedBurndown, Section, SignOff, StatGrid, TextBlock,
  type DocumentMeta,
} from './pdf';

// The official documents KPM issues. Each entry checks who may issue it, gathers its data,
// and renders it on the organization's letterhead.

export class DocumentError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export type DocumentContext = { userId: string; viewer: Member; params: URLSearchParams };

export type PreparedDocument = {
  organizationId: string;
  projectId?: string;
  /** Used in the file name and audit log */
  title: string;
  filename: string;
  render: (branding: DocumentBranding, meta: Pick<DocumentMeta, 'reference' | 'generatedAt' | 'generatedBy' | 'organizationName'>) => ReactElement<DocumentProps>;
};

type Definition = {
  label: string;
  /** Short code in the reference number, e.g. PSR */
  code: string;
  prepare: (ctx: DocumentContext) => Promise<PreparedDocument>;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const d = (v: string | Date | null | undefined, pattern = 'dd MMM yyyy') => {
  if (!v) return '—';
  try {
    return format(typeof v === 'string' ? parseISO(v) : v, pattern);
  } catch {
    return String(v);
  }
};
const pct = (v: number | null) => (v === null ? '—' : `${v}%`);
const required = (params: URLSearchParams, key: string) => {
  const v = params.get(key);
  if (!v) throw new DocumentError(`Missing ${key}`, 400);
  return v;
};

async function projectFor(ctx: DocumentContext, projectId: string, needs: 'member' | 'manager') {
  const access = await getProjectAccess(ctx.userId, projectId);
  if (!access.hasAccess) throw new DocumentError('Project not found', 404);
  if (needs === 'manager' && !canManageProject(access)) {
    throw new DocumentError('Only Project Managers and Admins can issue this document', 403);
  }
  const [project] = await db
    .select({ ...getTableColumns(projects), manager_first: members.first_name, manager_last: members.last_name })
    .from(projects)
    .leftJoin(members, eq(members.id, projects.project_manager_id))
    .where(eq(projects.id, projectId))
    .limit(1);
  return project;
}

async function rangeFor(ctx: DocumentContext, organizationId: string) {
  const tz = await organizationTimezone(organizationId);
  const range = parseRange(new URL(`http://local/?${ctx.params.toString()}`), tz);
  if ('error' in range) throw new DocumentError(range.error, 400);
  return { ...range, tz };
}

const periodLabel = (r: { from: string; to: string }) => `${d(r.from)} – ${d(r.to)}`;
const name = (first?: string | null, last?: string | null) => [first, last].filter(Boolean).join(' ') || '—';

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

const projectStatus: Definition = {
  label: 'Project Status Report',
  code: 'PSR',
  async prepare(ctx) {
    const projectId = required(ctx.params, 'projectId');
    const project = await projectFor(ctx, projectId, 'manager');
    const orgId = project.organization_id!;
    const range = await rangeFor(ctx, orgId);

    const [report, milestoneRows, blockerRows] = await Promise.all([
      buildReport({ organizationId: orgId, projectIds: [projectId], from: range.from, to: range.to, timezone: range.tz }),
      db.select().from(milestones).where(eq(milestones.project_id, projectId)).orderBy(sql`${milestones.due_date} asc nulls last`),
      db
        .select({ submitted_at: daily_updates.submitted_at, blockers: daily_updates.blockers, first: members.first_name, last: members.last_name })
        .from(daily_updates)
        .leftJoin(members, eq(members.id, daily_updates.member_id))
        .where(
          and(
            eq(daily_updates.project_id, projectId),
            sql`coalesce(trim(${daily_updates.blockers}), '') <> ''`,
            sql`${daily_updates.submitted_at} >= (${range.from}::date)::timestamp at time zone ${range.tz}`,
            sql`${daily_updates.submitted_at} < ((${range.to}::date) + 1)::timestamp at time zone ${range.tz}`,
          ),
        )
        .orderBy(desc(daily_updates.submitted_at))
        .limit(15),
    ]);
    const p = report.projects[0];

    return {
      organizationId: orgId,
      projectId,
      title: `Project Status Report - ${project.name}`,
      filename: `${project.name} Status Report ${range.from} to ${range.to}.pdf`,
      render: (b, meta) => (
        <OfficialDocument
          branding={b}
          meta={{ ...meta, title: 'Project Status Report', subtitle: project.name, details: [['Period', periodLabel(range)], ['Project manager', name(project.manager_first, project.manager_last)]] }}
        >
          <Section title="Executive summary" color={b.primaryColor}>
            <StatGrid
              color={b.primaryColor}
              stats={[
                { label: 'Features released', value: `${p.features.completion}%`, note: `${p.features.released} of ${p.features.total} overall` },
                { label: 'Released this period', value: p.features.released_in_range },
                { label: 'Overdue features', value: p.features.overdue },
                { label: 'Awaiting review', value: p.deliverables.awaiting_review },
              ]}
            />
            <View16 />
            <KeyValues
              items={[
                ['Status', project.status],
                ['Priority', project.priority],
                ['Start date', d(project.start_date)],
                ['Target end', d(project.end_date)],
                ['Active sprint', p.sprints.active],
                ['Milestones', `${p.milestones.achieved} achieved, ${p.milestones.missed} missed, ${p.milestones.total} total`],
              ]}
            />
          </Section>

          <Section title="Feature pipeline" color={b.primaryColor}>
            <DataTable
              color={b.primaryColor}
              columns={[{ label: 'Stage', width: 70 }, { label: 'Features', width: 30, align: 'right' }]}
              rows={['Idea', 'Requirements', 'Design', 'Development', 'Integration', 'Testing', 'Approval', 'Released'].map((st) => [st, p.features.by_status[st] ?? 0])}
            />
          </Section>

          <Section title="Delivery this period" color={b.primaryColor}>
            <KeyValues
              items={[
                ['Sprints completed', p.sprints.completed_in_range],
                ['Releases shipped', p.releases_shipped_in_range],
                ['Deliverables submitted', p.deliverables.submitted_in_range],
                ['Deliverables approved', p.deliverables.approved_in_range],
                ['Meetings held', p.meetings.held_in_range],
                ['Open action items', p.meetings.open_action_items],
                ['Standups submitted', p.standups.submitted_in_range],
                ['Blockers reported', p.standups.blockers_in_range],
              ]}
            />
          </Section>

          <Section title="Milestones" color={b.primaryColor}>
            <DataTable
              color={b.primaryColor}
              empty="No milestones defined."
              columns={[{ label: 'Milestone', width: 46 }, { label: 'Due', width: 18 }, { label: 'Status', width: 16 }, { label: 'Achieved', width: 20 }]}
              rows={milestoneRows.map((m) => [m.title, d(m.due_date), m.status, m.achieved_at ? d(m.achieved_at) : ''])}
            />
          </Section>

          <Section title="Team contribution" color={b.primaryColor}>
            <DataTable
              color={b.primaryColor}
              empty="No team members."
              columns={[
                { label: 'Member', width: 28 }, { label: 'Standup rate', width: 14, align: 'right' }, { label: 'Released', width: 12, align: 'right' },
                { label: 'Open', width: 10, align: 'right' }, { label: 'Deliverables', width: 14, align: 'right' }, { label: 'Reviews', width: 11, align: 'right' },
                { label: 'Blockers', width: 11, align: 'right' },
              ]}
              rows={report.members.map((m) => [m.name, pct(m.standup_rate), m.features_released, m.open_features, m.deliverables_submitted, m.reviews_given, m.blockers])}
            />
          </Section>

          <Section title="Achievements this period" color={b.primaryColor}>
            <DataTable
              color={b.primaryColor}
              empty="Nothing shipped or achieved in this period."
              columns={[{ label: 'Date', width: 18 }, { label: 'Type', width: 16 }, { label: 'Achievement', width: 66 }]}
              rows={report.achievements.map((a) => [d(a.at), a.kind, a.title])}
            />
          </Section>

          <Section title="Reported blockers" color={b.primaryColor}>
            <DataTable
              color={b.primaryColor}
              empty="No blockers reported in this period."
              columns={[{ label: 'Date', width: 16 }, { label: 'Reported by', width: 22 }, { label: 'Blocker', width: 62 }]}
              rows={blockerRows.map((r) => [d(r.submitted_at), name(r.first, r.last), mdToPlain(r.blockers)])}
            />
          </Section>
        </OfficialDocument>
      ),
    };
  },
};

const portfolio: Definition = {
  label: 'Portfolio Report',
  code: 'PFR',
  async prepare(ctx) {
    const orgId = ctx.viewer.organization_id!;
    const projectIds = await getOverseenProjectIds(ctx.viewer);
    if (ctx.viewer.organization_role !== 'Organization Admin' && projectIds.length === 0) {
      throw new DocumentError('Available to Organization Admins and Project Managers', 403);
    }
    const range = await rangeFor(ctx, orgId);
    const report = await buildReport({ organizationId: orgId, projectIds, from: range.from, to: range.to, timezone: range.tz });
    const t = report.totals;
    const scope = ctx.viewer.organization_role === 'Organization Admin' ? 'All projects' : 'Projects you manage';

    return {
      organizationId: orgId,
      title: 'Portfolio Report',
      filename: `Portfolio Report ${range.from} to ${range.to}.pdf`,
      render: (b, meta) => (
        <OfficialDocument branding={b} meta={{ ...meta, title: 'Portfolio Report', subtitle: scope, details: [['Period', periodLabel(range)], ['Projects', String(t.projects)]] }}>
          <Section title="Summary" color={b.primaryColor}>
            <StatGrid
              color={b.primaryColor}
              stats={[
                { label: 'Active projects', value: t.active_projects, note: `${t.projects} in total` },
                { label: 'Features released', value: t.features_released, note: `${t.sprints_completed} sprint(s) completed` },
                { label: 'Milestones achieved', value: t.milestones_achieved, note: `${t.releases_shipped} release(s) shipped` },
                { label: 'Overdue features', value: t.overdue_features },
                { label: 'Deliverables submitted', value: t.deliverables_submitted, note: `${t.deliverables_awaiting_review} awaiting review` },
                { label: 'Standups', value: t.standups, note: `${t.blockers} with blockers` },
                { label: 'Meetings held', value: t.meetings },
                { label: 'People', value: report.members.length },
              ]}
            />
          </Section>
          <Section title="Projects" color={b.primaryColor}>
            <DataTable
              color={b.primaryColor}
              empty="No projects."
              columns={[
                { label: 'Project', width: 24 }, { label: 'Status', width: 11 }, { label: 'Manager', width: 17 }, { label: 'Released', width: 11, align: 'right' },
                { label: 'In period', width: 10, align: 'right' }, { label: 'Overdue', width: 9, align: 'right' }, { label: 'Next milestone', width: 18 },
              ]}
              rows={report.projects.map((p) => [
                p.name, p.status, p.manager, `${p.features.completion}%`, p.features.released_in_range, p.features.overdue,
                p.milestones.upcoming[0] ? `${p.milestones.upcoming[0].title} (${d(p.milestones.upcoming[0].due_date, 'dd MMM')})` : '',
              ])}
            />
          </Section>
          <Section title="Achievements this period" color={b.primaryColor}>
            <DataTable
              color={b.primaryColor}
              empty="Nothing shipped or achieved in this period."
              columns={[{ label: 'Date', width: 15 }, { label: 'Type', width: 13 }, { label: 'Achievement', width: 47 }, { label: 'Project', width: 25 }]}
              rows={report.achievements.map((a) => [d(a.at), a.kind, a.title, a.project])}
            />
          </Section>
        </OfficialDocument>
      ),
    };
  },
};

const teamPerformance: Definition = {
  label: 'Team Performance Report',
  code: 'TPR',
  async prepare(ctx) {
    const projectId = ctx.params.get('projectId');
    let orgId = ctx.viewer.organization_id!;
    let projectIds: string[];
    let subtitle = 'All overseen projects';
    if (projectId) {
      const project = await projectFor(ctx, projectId, 'manager');
      orgId = project.organization_id!;
      projectIds = [projectId];
      subtitle = project.name;
    } else {
      projectIds = await getOverseenProjectIds(ctx.viewer);
      if (ctx.viewer.organization_role !== 'Organization Admin' && projectIds.length === 0) {
        throw new DocumentError('Available to Organization Admins and Project Managers', 403);
      }
    }
    const range = await rangeFor(ctx, orgId);
    const report = await buildReport({ organizationId: orgId, projectIds, from: range.from, to: range.to, timezone: range.tz });

    return {
      organizationId: orgId,
      projectId: projectId ?? undefined,
      title: `Team Performance Report - ${subtitle}`,
      filename: `Team Performance ${subtitle} ${range.from} to ${range.to}.pdf`,
      render: (b, meta) => (
        <OfficialDocument branding={b} meta={{ ...meta, title: 'Team Performance Report', subtitle, details: [['Period', periodLabel(range)], ['Working days', String(report.totals.expected_days)]] }}>
          <Section title="Contribution by person" color={b.primaryColor}>
            <DataTable
              color={b.primaryColor}
              empty="No people on these projects."
              columns={[
                { label: 'Member', width: 22 }, { label: 'Role', width: 14 }, { label: 'Standups', width: 11, align: 'right' }, { label: 'Rate', width: 8, align: 'right' },
                { label: 'Released', width: 9, align: 'right' }, { label: 'Open', width: 7, align: 'right' }, { label: 'Submitted', width: 10, align: 'right' },
                { label: 'Approved', width: 10, align: 'right' }, { label: 'Reviews', width: 9, align: 'right' },
              ]}
              rows={report.members.map((m) => [
                m.name + (m.status === 'Inactive' ? ' (inactive)' : ''), m.job_title || m.role, `${m.standup_days}/${m.expected_days}`, pct(m.standup_rate),
                m.features_released, m.open_features, m.deliverables_submitted, m.deliverables_approved, m.reviews_given,
              ])}
            />
          </Section>
          <Section title="How these figures are measured" color={b.primaryColor}>
            <Paragraph muted>
              Standups: days in the period with at least one standup, out of Monday–Friday working days (days after today are not counted), measured in {range.tz}.
              Released: features assigned to the person that reached Released in the period. Open: assigned features not yet released.
              Submitted / Approved: deliverables the person submitted, and those approved, in the period. Reviews: deliverable reviews the person gave.
            </Paragraph>
          </Section>
        </OfficialDocument>
      ),
    };
  },
};

const sprintReport: Definition = {
  label: 'Sprint Report',
  code: 'SPR',
  async prepare(ctx) {
    const projectId = required(ctx.params, 'projectId');
    const sprintId = required(ctx.params, 'sprintId');
    const project = await projectFor(ctx, projectId, 'member');
    const insights = await getSprintInsights(projectId, sprintId);
    if (!insights) throw new DocumentError('Sprint not found in this project', 404);
    const sprint = insights.sprint;

    const [scope, assignees, [retro]] = await Promise.all([
      db.select({ id: features.id, title: features.title, status: features.status, priority: features.priority }).from(features).where(eq(features.sprint_id, sprintId)).orderBy(asc(features.title)),
      db
        .select({ feature_id: feature_members.feature_id, first: members.first_name, last: members.last_name })
        .from(feature_members)
        .innerJoin(features, eq(features.id, feature_members.feature_id))
        .leftJoin(members, eq(members.id, feature_members.member_id))
        .where(eq(features.sprint_id, sprintId)),
      db.select().from(sprint_retrospectives).where(eq(sprint_retrospectives.sprint_id, sprintId)).limit(1),
    ]);
    const owners = (fid: string) => assignees.filter((a) => a.feature_id === fid).map((a) => name(a.first, a.last)).join(', ');

    return {
      organizationId: project.organization_id!,
      projectId,
      title: `Sprint Report - ${sprint.name}`,
      filename: `${project.name} ${sprint.name} Sprint Report.pdf`,
      render: (b, meta) => (
        <OfficialDocument
          branding={b}
          meta={{ ...meta, title: 'Sprint Report', subtitle: `${project.name} · ${sprint.name}`, details: [['Sprint dates', `${d(sprint.start_date)} – ${d(sprint.end_date)}`], ['Status', sprint.status ?? '—']] }}
        >
          <Section title="Sprint overview" color={b.primaryColor}>
            <StatGrid
              color={b.primaryColor}
              stats={[
                { label: 'Features in scope', value: insights.total },
                { label: 'Released', value: insights.completed, note: insights.total ? `${Math.round((insights.completed / insights.total) * 100)}% of scope` : undefined },
                { label: 'Remaining', value: insights.total - insights.completed },
                { label: 'Standups logged', value: insights.standups },
              ]}
            />
            <View16 />
            <KeyValues items={[['Goal', sprint.goal], ['Definition of success', sprint.definition_of_success], ['Risks', sprint.risks]]} />
          </Section>
          <Section title="Burndown" color={b.primaryColor}>
            <PrintedBurndown data={insights.burndown} color={b.primaryColor} />
          </Section>
          <Section title="Scope" color={b.primaryColor}>
            <DataTable
              color={b.primaryColor}
              empty="No features in this sprint."
              columns={[{ label: 'Feature', width: 44 }, { label: 'Status', width: 16 }, { label: 'Priority', width: 12 }, { label: 'Owners', width: 28 }]}
              rows={scope.map((f) => [f.title, f.status, f.priority, owners(f.id)])}
            />
          </Section>
          <Section title="Velocity (features released per sprint)" color={b.primaryColor}>
            <DataTable
              color={b.primaryColor}
              columns={[{ label: 'Sprint', width: 70 }, { label: 'Released', width: 30, align: 'right' }]}
              rows={insights.velocity.map((v) => [v.sprint_id === sprintId ? `${v.name} (this sprint)` : v.name, v.completed])}
            />
          </Section>
          <Section title="Retrospective" color={b.primaryColor}>
            {[
              ['What went well', retro?.what_went_well],
              ["What didn't go well", retro?.what_didnt_go_well],
              ['Lessons learned', retro?.lessons_learned],
              ['Process improvements', retro?.process_improvements],
            ].map(([label, text]) => (
              <SubBlock key={label as string} label={label as string} text={mdToPlain(text as string | null)} />
            ))}
          </Section>
        </OfficialDocument>
      ),
    };
  },
};

const meetingMinutes: Definition = {
  label: 'Meeting Minutes',
  code: 'MIN',
  async prepare(ctx) {
    const projectId = required(ctx.params, 'projectId');
    const meetingId = required(ctx.params, 'meetingId');
    const project = await projectFor(ctx, projectId, 'member');
    if (!(await meetingInProject(meetingId, projectId))) throw new DocumentError('Meeting not found', 404);

    const [[meeting], attendees, actions] = await Promise.all([
      db
        .select({ ...getTableColumns(meetings), organizer_first: members.first_name, organizer_last: members.last_name, sprint_name: sprints.name })
        .from(meetings)
        .leftJoin(members, eq(members.id, meetings.created_by))
        .leftJoin(sprints, eq(sprints.id, meetings.sprint_id))
        .where(eq(meetings.id, meetingId))
        .limit(1),
      db
        .select({ ...memberSummary, email: members.email, role: project_members.project_role })
        .from(meeting_participants)
        .innerJoin(members, eq(members.id, meeting_participants.member_id))
        .leftJoin(project_members, and(eq(project_members.member_id, members.id), eq(project_members.project_id, projectId)))
        .where(eq(meeting_participants.meeting_id, meetingId))
        .orderBy(asc(members.first_name)),
      selectActionItems(eq(meeting_action_items.meeting_id, meetingId)),
    ]);
    const tz = await organizationTimezone(project.organization_id!);
    const when = meeting.start_time
      ? `${meeting.start_time.toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short', timeZone: tz })}${meeting.end_time ? ` – ${meeting.end_time.toLocaleTimeString('en-GB', { timeStyle: 'short', timeZone: tz })}` : ''} (${tz})`
      : '—';

    return {
      organizationId: project.organization_id!,
      projectId,
      title: `Minutes - ${meeting.title}`,
      filename: `Minutes ${meeting.title} ${meeting.start_time ? d(meeting.start_time, 'yyyy-MM-dd') : ''}.pdf`,
      render: (b, meta) => (
        <OfficialDocument branding={b} meta={{ ...meta, title: 'Minutes of Meeting', subtitle: meeting.title, details: [['Project', project.name], ['Date', meeting.start_time ? d(meeting.start_time) : '—']] }}>
          <Section title="Meeting details" color={b.primaryColor}>
            <KeyValues
              items={[
                ['When', when],
                ['Format', meeting.type === 'Physical' ? 'In person' : 'Online'],
                [meeting.type === 'Physical' ? 'Location' : 'Link', meeting.type === 'Physical' ? meeting.location : meeting.meeting_link],
                ['Convened by', name(meeting.organizer_first, meeting.organizer_last)],
                ['Sprint', meeting.sprint_name],
                ['Attendees', String(attendees.length)],
              ]}
            />
          </Section>
          <Section title="Attendance" color={b.primaryColor}>
            <DataTable
              color={b.primaryColor}
              empty="No attendees recorded."
              columns={[{ label: 'Name', width: 35 }, { label: 'Project role', width: 25 }, { label: 'Email', width: 40 }]}
              rows={attendees.map((a) => [name(a.first_name, a.last_name), a.role ?? 'Guest', a.email])}
            />
          </Section>
          <Section title="Objective" color={b.primaryColor}><TextBlock text={mdToPlain(meeting.objective)} /></Section>
          <Section title="Agenda" color={b.primaryColor}><TextBlock text={mdToPlain(meeting.agenda)} /></Section>
          <Section title="Minutes" color={b.primaryColor}><TextBlock text={mdToPlain(meeting.minutes)} empty="Minutes have not been recorded." /></Section>
          <Section title="Decisions" color={b.primaryColor}><TextBlock text={mdToPlain(meeting.decisions)} empty="No decisions recorded." /></Section>
          <Section title="Action items" color={b.primaryColor}>
            <DataTable
              color={b.primaryColor}
              empty="No action items."
              columns={[{ label: '#', width: 6 }, { label: 'Action', width: 48 }, { label: 'Owner', width: 20 }, { label: 'Due', width: 13 }, { label: 'Status', width: 13 }]}
              rows={actions.map((a, i) => [i + 1, a.description, a.members ? name(a.members.first_name, a.members.last_name) : 'Unassigned', d(a.due_date), a.status])}
            />
          </Section>
          <SignOff roles={['Recorded by', 'Approved by (chair)']} />
        </OfficialDocument>
      ),
    };
  },
};

const standupDigest: Definition = {
  label: 'Daily Standup Digest',
  code: 'SUD',
  async prepare(ctx) {
    const orgId = ctx.viewer.organization_id!;
    let projectIds = await getOverseenProjectIds(ctx.viewer);
    if (ctx.viewer.organization_role !== 'Organization Admin' && projectIds.length === 0) {
      throw new DocumentError('Available to Organization Admins and Project Managers', 403);
    }
    const projectId = ctx.params.get('projectId');
    if (projectId) {
      if (!projectIds.includes(projectId)) throw new DocumentError('Project not found', 404);
      projectIds = [projectId];
    }
    const tz = await organizationTimezone(orgId);
    const date = ctx.params.get('date') || todayIn(tz);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new DocumentError('Date must be in YYYY-MM-DD format', 400);
    const day = await getStandupDay(projectIds, date, tz);

    return {
      organizationId: orgId,
      title: `Daily Standup Digest - ${date}`,
      filename: `Standup Digest ${date}.pdf`,
      render: (b, meta) => (
        <OfficialDocument branding={b} meta={{ ...meta, title: 'Daily Standup Digest', subtitle: d(date, 'EEEE, dd MMMM yyyy'), details: [['Timezone', tz], ['Projects', String(day.projects.length)]] }}>
          <Section title="Summary" color={b.primaryColor}>
            <StatGrid
              color={b.primaryColor}
              stats={[
                { label: 'Submitted', value: `${day.summary.submitted}/${day.summary.expected}` },
                { label: 'Missing', value: day.summary.missing },
                { label: 'Reporting blockers', value: day.summary.blockers },
                { label: 'Day', value: d(date, 'EEE dd MMM'), note: day.is_weekend ? 'Weekend' : undefined },
              ]}
            />
          </Section>
          {day.projects.length === 0 && <Paragraph muted>No active projects with team members.</Paragraph>}
          {day.projects.map((p) => (
            <Section key={p.id} title={`${p.name} — ${p.submitted.length} of ${p.expected} submitted`} color={b.primaryColor}>
              {p.missing.length > 0 && (
                <Paragraph muted>Not submitted: {p.missing.map((m) => name(m.first_name, m.last_name)).join(', ')}</Paragraph>
              )}
              <DataTable
                color={b.primaryColor}
                empty="No standups for this day."
                columns={[{ label: 'Member', width: 16 }, { label: 'Yesterday', width: 29 }, { label: 'Today', width: 29 }, { label: 'Blockers', width: 26 }]}
                rows={p.submitted.map((s) => [name(s.members?.first_name, s.members?.last_name), mdToPlain(s.yesterday), mdToPlain(s.today), mdToPlain(s.blockers)])}
              />
            </Section>
          ))}
        </OfficialDocument>
      ),
    };
  },
};

const memberReport: Definition = {
  label: 'Member Activity Report',
  code: 'MAR',
  async prepare(ctx) {
    const memberId = required(ctx.params, 'memberId');
    const orgId = ctx.viewer.organization_id!;
    const range = await rangeFor(ctx, orgId);
    const o = await getMemberOverview(ctx.userId, memberId, { from: range.from, to: range.to });
    if (!o) throw new DocumentError('Member not found', 404);
    const st = o.stats;
    const fullName = name(o.member.first_name, o.member.last_name);

    return {
      organizationId: orgId,
      title: `Member Activity Report - ${fullName}`,
      filename: `${fullName} Activity Report ${range.from} to ${range.to}.pdf`,
      render: (b, meta) => (
        <OfficialDocument
          branding={b}
          meta={{ ...meta, title: 'Member Activity Report', subtitle: fullName, details: [['Period', periodLabel(range)], ['Role', o.member.job_title || o.member.organization_role || 'Member']] }}
        >
          <Section title="Summary" color={b.primaryColor}>
            <StatGrid
              color={b.primaryColor}
              stats={[
                { label: 'Standup rate', value: pct(st?.standup_rate ?? null), note: st ? `${st.standup_days} of ${st.expected_days} working days` : undefined },
                { label: 'Features released', value: st?.features_released ?? 0, note: `${st?.open_features ?? 0} open` },
                { label: 'Deliverables', value: st?.deliverables_submitted ?? 0, note: `${st?.deliverables_approved ?? 0} approved` },
                { label: 'Reviews given', value: st?.reviews_given ?? 0 },
              ]}
            />
            <View16 />
            <KeyValues
              items={[
                ['Email', o.member.email],
                ['Status', o.member.status],
                ['Member since', d(o.member.created_at)],
                ['Last sign-in', o.member.last_sign_in_at ? d(o.member.last_sign_in_at) : 'Never'],
              ]}
            />
            {o.scope === 'shared-projects' && <Paragraph muted>Covers only the projects managed by the person who issued this report.</Paragraph>}
          </Section>
          <Section title="Projects" color={b.primaryColor}>
            <DataTable
              color={b.primaryColor}
              empty="Not on any project."
              columns={[{ label: 'Project', width: 40 }, { label: 'Role', width: 30 }, { label: 'Status', width: 30 }]}
              rows={o.projects.map((p) => [p.name, p.functional_role || p.project_role, p.status])}
            />
          </Section>
          <Section title="Open features" color={b.primaryColor}>
            <DataTable
              color={b.primaryColor}
              empty="Nothing assigned."
              columns={[{ label: 'Feature', width: 40 }, { label: 'Project', width: 22 }, { label: 'Status', width: 14 }, { label: 'Priority', width: 10 }, { label: 'Due', width: 14 }]}
              rows={o.open_features.map((f) => [f.title, f.project_name, f.status, f.priority, d(f.due_date)])}
            />
          </Section>
          <Section title="Recent deliverables" color={b.primaryColor}>
            <DataTable
              color={b.primaryColor}
              empty="No deliverables."
              columns={[{ label: 'Deliverable', width: 36 }, { label: 'Feature', width: 30 }, { label: 'Submitted', width: 16 }, { label: 'Status', width: 18 }]}
              rows={o.recent_deliverables.map((x) => [x.title, x.feature_title, d(x.submitted_at), x.status])}
            />
          </Section>
          <Section title="Recent standups" color={b.primaryColor}>
            <DataTable
              color={b.primaryColor}
              empty="No standups."
              columns={[{ label: 'Date', width: 14 }, { label: 'Project', width: 18 }, { label: 'Today', width: 40 }, { label: 'Blockers', width: 28 }]}
              rows={o.recent_standups.map((x) => [d(x.submitted_at), x.project_name, mdToPlain(x.today), mdToPlain(x.blockers)])}
            />
          </Section>
          <Section title="Open action items" color={b.primaryColor}>
            <DataTable
              color={b.primaryColor}
              empty="No open action items."
              columns={[{ label: 'Action', width: 50 }, { label: 'Meeting', width: 30 }, { label: 'Due', width: 20 }]}
              rows={o.open_action_items.map((a) => [a.description, a.meeting_title, d(a.due_date)])}
            />
          </Section>
        </OfficialDocument>
      ),
    };
  },
};

const releaseNotes: Definition = {
  label: 'Release Notes',
  code: 'REL',
  async prepare(ctx) {
    const projectId = required(ctx.params, 'projectId');
    const releaseId = required(ctx.params, 'releaseId');
    const project = await projectFor(ctx, projectId, 'member');
    const [release] = await db.select().from(releases).where(and(eq(releases.id, releaseId), eq(releases.project_id, projectId))).limit(1);
    if (!release) throw new DocumentError('Release not found', 404);
    const scope = await db
      .select({ title: features.title, status: features.status, priority: features.priority })
      .from(features)
      .where(eq(features.release_id, releaseId))
      .orderBy(asc(features.title));
    const checklist = Array.isArray(release.deployment_checklist) ? (release.deployment_checklist as unknown[]) : [];
    const checklistRows = checklist.map((item) => {
      if (typeof item === 'string') return [item, ''];
      const o = (item ?? {}) as Record<string, unknown>;
      return [String(o.title ?? o.label ?? o.text ?? o.name ?? ''), o.done || o.completed || o.checked ? 'Done' : 'Pending'];
    });

    return {
      organizationId: project.organization_id!,
      projectId,
      title: `Release Notes - ${release.version}`,
      filename: `${project.name} Release ${release.version}.pdf`,
      render: (b, meta) => (
        <OfficialDocument
          branding={b}
          meta={{ ...meta, title: 'Release Notes', subtitle: `${project.name} · ${release.version}${release.title ? ` — ${release.title}` : ''}`, details: [['Release date', d(release.release_date)], ['Status', release.status ?? '—']] }}
        >
          <Section title="Notes" color={b.primaryColor}><TextBlock text={mdToPlain(release.release_notes)} empty="No release notes written." /></Section>
          <Section title={`Included features (${scope.length})`} color={b.primaryColor}>
            <DataTable
              color={b.primaryColor}
              empty="No features assigned to this release."
              columns={[{ label: 'Feature', width: 60 }, { label: 'Status', width: 22 }, { label: 'Priority', width: 18 }]}
              rows={scope.map((f) => [f.title, f.status, f.priority])}
            />
          </Section>
          {checklistRows.length > 0 && (
            <Section title="Deployment checklist" color={b.primaryColor}>
              <DataTable color={b.primaryColor} columns={[{ label: 'Step', width: 78 }, { label: 'State', width: 22 }]} rows={checklistRows} />
            </Section>
          )}
          <Section title="Rollback plan" color={b.primaryColor}><TextBlock text={mdToPlain(release.rollback_plan)} empty="No rollback plan recorded." /></Section>
          <SignOff roles={['Release manager', 'Approved by']} />
        </OfficialDocument>
      ),
    };
  },
};

/** A sample used by the branding settings preview. */
const brandingSample: Definition = {
  label: 'Letterhead Preview',
  code: 'PRV',
  async prepare(ctx) {
    if (ctx.viewer.organization_role !== 'Organization Admin') throw new DocumentError('Only Organization Admins can preview branding', 403);
    return {
      organizationId: ctx.viewer.organization_id!,
      title: 'Letterhead preview',
      filename: 'Letterhead Preview.pdf',
      render: (b, meta) => (
        <OfficialDocument branding={b} meta={{ ...meta, title: 'Letterhead Preview', subtitle: 'How your official documents will look', details: [['Template', b.template]] }}>
          <Section title="Sample section" color={b.primaryColor}>
            <StatGrid color={b.primaryColor} stats={[{ label: 'Features released', value: '72%' }, { label: 'Milestones', value: 4 }, { label: 'Standup rate', value: '91%' }, { label: 'Open items', value: 3 }]} />
            <View16 />
            <DataTable
              color={b.primaryColor}
              columns={[{ label: 'Item', width: 50 }, { label: 'Owner', width: 25 }, { label: 'Status', width: 25 }]}
              rows={[['Sample deliverable', 'A. Member', 'Approved'], ['Sample milestone', 'P. Manager', 'Achieved']]}
            />
          </Section>
        </OfficialDocument>
      ),
    };
  },
};

export const DOCUMENTS: Record<string, Definition> = {
  'project-status': projectStatus,
  portfolio,
  'team-performance': teamPerformance,
  'sprint-report': sprintReport,
  'meeting-minutes': meetingMinutes,
  'standup-digest': standupDigest,
  'member-report': memberReport,
  'release-notes': releaseNotes,
  'branding-preview': brandingSample,
};

/** Loads the viewer and the organization name used on every document. */
export async function loadViewer(userId: string) {
  const viewer = await getMember(userId);
  if (!viewer?.organization_id) throw new DocumentError('Member profile not found', 404);
  const [org] = await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, viewer.organization_id)).limit(1);
  return { viewer, organizationName: org?.name ?? '' };
}

// Small layout helpers used above
function View16() {
  return <PdfView style={{ height: 8 }} />;
}
function SubBlock({ label, text }: { label: string; text: string }) {
  return (
    <PdfView style={{ marginBottom: 8 }}>
      <PdfText style={{ fontFamily: 'Helvetica-Bold', fontSize: 9, marginBottom: 2 }}>{label}</PdfText>
      <TextBlock text={text} empty="Not recorded." />
    </PdfView>
  );
}
