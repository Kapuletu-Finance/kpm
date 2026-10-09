'use client';

import { useState } from 'react';
import Link from 'next/link';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { Download, Trophy, Rocket, Flag, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { reportCsvUrl, useReport, type Report } from '@/hooks/useInsights';
import { Badge } from '@/components/ui/badge';
import { DownloadDocumentButton } from '@/components/documents/DownloadDocumentButton';

const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => iso(new Date(Date.now() - n * 864e5));

const PRESETS = [
  { label: '7 days', days: 6 },
  { label: '30 days', days: 29 },
  { label: '90 days', days: 89 },
];

function Tile({ label, value, note, tone }: { label: string; value: number | string; note?: string; tone?: 'warn' }) {
  return (
    <div className="bg-card border rounded-xl p-4">
      <div className="text-xs text-muted-foreground flex items-center gap-1.5">
        {tone === 'warn' && <AlertTriangle className="w-3.5 h-3.5 text-warning" aria-label="Needs attention" />}
        {label}
      </div>
      <div className="text-2xl font-bold tabular-nums mt-1">{value}</div>
      {note && <div className="text-xs text-muted-foreground mt-0.5">{note}</div>}
    </div>
  );
}

/** A labeled single-value meter: share of features released. */
function Completion({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2 min-w-[120px]" role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label="Features released">
      <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${value}%`, background: 'var(--viz-series-1)' }} />
      </div>
      <span className="text-xs tabular-nums text-foreground w-9 text-right">{value}%</span>
    </div>
  );
}

function CsvLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline" download>
      <Download className="w-3.5 h-3.5" /> {label}
    </a>
  );
}

const ACHIEVEMENT_ICON = { Milestone: Flag, Release: Rocket, Feature: CheckCircle2 } as const;

/**
 * Report over a date range: headline numbers, per-project health, per-person contribution
 * and achievements, each exportable as CSV.
 * - Organization mode (no projectId): admins see everything, PMs their projects.
 * - Project mode: one project's report.
 */
export function ReportView({ projectId, showPeopleLinks = true }: { projectId?: string; showPeopleLinks?: boolean }) {
  const projectScoped = !!projectId;
  const [range, setRange] = useState({ from: daysAgo(29), to: iso(new Date()) });
  const { data: report, isLoading, error, isFetching } = useReport(range, projectId, projectScoped);

  const setPreset = (days: number) => setRange({ from: daysAgo(days), to: iso(new Date()) });

  return (
    <div className="space-y-6">
      {/* Filters: one row above everything they control */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex rounded-md border overflow-hidden" role="group" aria-label="Quick ranges">
          {PRESETS.map((p) => {
            const selected = range.from === daysAgo(p.days) && range.to === iso(new Date());
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => setPreset(p.days)}
                aria-pressed={selected}
                className={`px-3 h-9 text-sm border-r last:border-r-0 transition-colors ${selected ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <label className="text-xs text-muted-foreground space-y-1">
          <span className="block">From</span>
          <input type="date" value={range.from} max={range.to} onChange={(e) => e.target.value && setRange((r) => ({ ...r, from: e.target.value }))}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground" />
        </label>
        <label className="text-xs text-muted-foreground space-y-1">
          <span className="block">To</span>
          <input type="date" value={range.to} min={range.from} onChange={(e) => e.target.value && setRange((r) => ({ ...r, to: e.target.value }))}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground" />
        </label>
        {isFetching && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground mb-2.5" aria-label="Loading" />}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {projectScoped ? (
            <DownloadDocumentButton type="project-status" params={{ projectId, ...range }} label="Status report (PDF)" />
          ) : (
            <DownloadDocumentButton type="portfolio" params={range} label="Portfolio report (PDF)" />
          )}
          <DownloadDocumentButton type="team-performance" params={{ projectId, ...range }} label="Team report (PDF)" />
        </div>
      </div>
      {report && <p className="text-xs text-muted-foreground -mt-3">Days are measured in {report.range.timezone}. PDFs carry your organization&apos;s official letterhead.</p>}

      {error && <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">{(error as Error).message}</div>}
      {isLoading && <div className="h-64 bg-muted/40 rounded-xl animate-pulse" />}

      {report && <ReportBody report={report} range={range} projectId={projectId} projectScoped={projectScoped} showPeopleLinks={showPeopleLinks} />}
    </div>
  );
}

function ReportBody({ report, range, projectId, projectScoped, showPeopleLinks }: {
  report: Report; range: { from: string; to: string }; projectId?: string; projectScoped: boolean; showPeopleLinks: boolean;
}) {
  const t = report.totals;
  const csv = (s: 'projects' | 'members' | 'achievements') => reportCsvUrl(s, range, projectId, projectScoped);

  return (
    <>
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Tile label="Features released" value={t.features_released} note={`${t.sprints_completed} sprint(s) completed`} />
        <Tile label="Milestones achieved" value={t.milestones_achieved} note={`${t.releases_shipped} release(s) shipped`} />
        <Tile label="Deliverables submitted" value={t.deliverables_submitted} note={`${t.deliverables_awaiting_review} awaiting review now`} />
        <Tile label="Standups" value={t.standups} note={`${t.blockers} with blockers · ${t.meetings} meetings`} />
        {t.overdue_features > 0 && <Tile label="Overdue features" value={t.overdue_features} note="Past due and not released" tone="warn" />}
      </div>

      {/* Projects */}
      <section className="bg-card border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold">{projectScoped ? 'Project health' : `Projects (${report.projects.length})`}</h2>
          <CsvLink href={csv('projects')} label="CSV" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="text-left font-medium p-3">Project</th>
                <th className="text-left font-medium p-3">Released</th>
                <th className="text-right font-medium p-3">In range</th>
                <th className="text-right font-medium p-3">Overdue</th>
                <th className="text-left font-medium p-3">Active sprint</th>
                <th className="text-right font-medium p-3">Standups</th>
                <th className="text-right font-medium p-3">Awaiting review</th>
                <th className="text-left font-medium p-3">Next milestone</th>
              </tr>
            </thead>
            <tbody>
              {report.projects.map((p) => (
                <tr key={p.id} className="border-t align-top">
                  <td className="p-3">
                    <Link href={`/workspace/projects/${p.id}`} className="font-medium hover:text-primary">{p.name}</Link>
                    <div className="text-xs text-muted-foreground">{p.status} · {p.manager}</div>
                  </td>
                  <td className="p-3">
                    <Completion value={p.features.completion} />
                    <div className="text-xs text-muted-foreground mt-1 tabular-nums">{p.features.released} of {p.features.total}</div>
                  </td>
                  <td className="p-3 text-right tabular-nums">{p.features.released_in_range}</td>
                  <td className="p-3 text-right tabular-nums">
                    {p.features.overdue > 0 ? <span className="text-destructive font-medium">{p.features.overdue}</span> : 0}
                  </td>
                  <td className="p-3">{p.sprints.active ?? <span className="text-muted-foreground">None</span>}</td>
                  <td className="p-3 text-right tabular-nums">
                    {p.standups.submitted_in_range}
                    {p.standups.blockers_in_range > 0 && <div className="text-xs text-destructive">{p.standups.blockers_in_range} blocker(s)</div>}
                  </td>
                  <td className="p-3 text-right tabular-nums">{p.deliverables.awaiting_review}</td>
                  <td className="p-3">
                    {p.milestones.upcoming[0] ? (
                      <>
                        <div>{p.milestones.upcoming[0].title}</div>
                        <div className={`text-xs ${p.milestones.upcoming[0].overdue ? 'text-destructive' : 'text-muted-foreground'}`}>
                          {p.milestones.upcoming[0].overdue ? 'Overdue · ' : 'Due '}{format(parseISO(p.milestones.upcoming[0].due_date), 'MMM d')}
                        </div>
                      </>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                </tr>
              ))}
              {report.projects.length === 0 && (
                <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">No projects in this report.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* People */}
      <section className="bg-card border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="font-semibold">People ({report.members.length})</h2>
            <p className="text-xs text-muted-foreground">Standup rate = working days with a standup, out of {t.expected_days} working day(s) in range.</p>
          </div>
          <CsvLink href={csv('members')} label="CSV" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="text-left font-medium p-3">Person</th>
                <th className="text-right font-medium p-3">Standup rate</th>
                <th className="text-right font-medium p-3">Released</th>
                <th className="text-right font-medium p-3">Open</th>
                <th className="text-right font-medium p-3">Deliverables</th>
                <th className="text-right font-medium p-3">Reviews</th>
                <th className="text-right font-medium p-3">Blockers</th>
                <th className="text-left font-medium p-3">Last active</th>
              </tr>
            </thead>
            <tbody>
              {report.members.map((m) => (
                <tr key={m.id} className="border-t">
                  <td className="p-3">
                    {showPeopleLinks ? (
                      <Link href={`/workspace/organization/members/${m.id}`} className="font-medium hover:text-primary">{m.name}</Link>
                    ) : <span className="font-medium">{m.name}</span>}
                    <div className="text-xs text-muted-foreground">{m.job_title || m.role}{m.status === 'Inactive' && ' · Inactive'}</div>
                  </td>
                  <td className="p-3 text-right tabular-nums">
                    {m.standup_rate === null ? '—' : (
                      <span className={m.standup_rate < 60 ? 'text-destructive font-medium' : ''}>{m.standup_rate}%</span>
                    )}
                    <div className="text-xs text-muted-foreground">{m.standup_days}/{m.expected_days} days</div>
                  </td>
                  <td className="p-3 text-right tabular-nums">{m.features_released}</td>
                  <td className="p-3 text-right tabular-nums">{m.open_features}</td>
                  <td className="p-3 text-right tabular-nums">
                    {m.deliverables_submitted}
                    <div className="text-xs text-muted-foreground">{m.deliverables_approved} approved</div>
                  </td>
                  <td className="p-3 text-right tabular-nums">{m.reviews_given}</td>
                  <td className="p-3 text-right tabular-nums">{m.blockers}</td>
                  <td className="p-3 text-muted-foreground text-xs">
                    {m.last_active ? formatDistanceToNow(parseISO(m.last_active), { addSuffix: true }) : 'No activity'}
                  </td>
                </tr>
              ))}
              {report.members.length === 0 && (
                <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">No people on these projects yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Achievements */}
      <section className="bg-card border rounded-xl">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold flex items-center gap-2"><Trophy className="w-4 h-4 text-accent" /> Achievements</h2>
          <CsvLink href={csv('achievements')} label="CSV" />
        </div>
        {report.achievements.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Nothing shipped or achieved in this range yet.</p>
        ) : (
          <ul className="divide-y">
            {report.achievements.map((a, i) => {
              const Icon = ACHIEVEMENT_ICON[a.kind];
              return (
                <li key={`${a.kind}-${i}`} className="flex items-center gap-3 p-3 text-sm">
                  <Icon className="w-4 h-4 text-primary shrink-0" aria-hidden />
                  <Badge variant="outline" className="text-[10px] shrink-0">{a.kind}</Badge>
                  <span className="font-medium truncate">{a.title}</span>
                  <span className="text-muted-foreground truncate hidden sm:inline">· {a.project}</span>
                  <span className="ml-auto text-xs text-muted-foreground shrink-0">{a.at ? format(parseISO(a.at), 'MMM d') : ''}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
