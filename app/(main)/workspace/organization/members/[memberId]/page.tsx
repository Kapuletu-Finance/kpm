'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { AlertCircle, ArrowLeft, ExternalLink, Loader2, Mail } from 'lucide-react';
import { useMemberOverview } from '@/hooks/useInsights';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

const iso = (d: Date) => d.toISOString().slice(0, 10);
const RANGES = [
  { label: '7 days', days: 6 },
  { label: '30 days', days: 29 },
  { label: '90 days', days: 89 },
];

function Tile({ label, value, note, alert }: { label: string; value: string | number; note?: string; alert?: boolean }) {
  return (
    <div className="bg-card border rounded-xl p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold tabular-nums mt-1 ${alert ? 'text-destructive' : ''}`}>{value}</div>
      {note && <div className="text-xs text-muted-foreground mt-0.5">{note}</div>}
    </div>
  );
}

function Panel({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <section className="bg-card border rounded-xl overflow-hidden">
      <h2 className="font-semibold p-4 border-b text-sm">
        {title}{count !== undefined && <span className="text-muted-foreground font-normal"> ({count})</span>}
      </h2>
      {children}
    </section>
  );
}

const Empty = ({ text }: { text: string }) => <p className="p-4 text-sm text-muted-foreground">{text}</p>;
const fmt = (d: string | null, pattern = 'MMM d') => (d ? format(parseISO(d), pattern) : '—');

export default function MemberOverviewPage({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = use(params);
  const [days, setDays] = useState(29);
  // Captured once so render stays pure; the range is derived from it
  const [today] = useState(() => iso(new Date()));
  const range = { from: iso(new Date(Date.parse(`${today}T00:00:00Z`) - days * 864e5)), to: today };
  const { data, isLoading, error, isFetching } = useMemberOverview(memberId, range);

  if (isLoading) return <div className="h-64 bg-muted/40 rounded-xl animate-pulse" />;
  if (error || !data) {
    return (
      <div className="space-y-4">
        <Link href="/workspace/organization" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Members
        </Link>
        <div className="p-6 bg-card border rounded-xl text-sm text-muted-foreground">
          {(error as Error)?.message === 'Member not found'
            ? "You don't have access to this person's work, or they are not in your organization."
            : (error as Error)?.message || 'Could not load this member.'}
        </div>
      </div>
    );
  }

  const { member, stats } = data;

  return (
    <div className="space-y-6">
      <Link href="/workspace/organization" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ArrowLeft className="w-4 h-4" /> Members
      </Link>

      <div className="flex flex-wrap items-center gap-4">
        <Avatar className="w-14 h-14 border">
          <AvatarImage src={member.avatar_url || ''} />
          <AvatarFallback>{member.first_name[0]}{member.last_name[0]}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight">{member.first_name} {member.last_name}</h2>
            <Badge variant="secondary">{member.organization_role}</Badge>
            {member.status !== 'Active' && <Badge variant="outline">{member.status}</Badge>}
          </div>
          <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
            {member.job_title && <span>{member.job_title}</span>}
            <span className="inline-flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{member.email}</span>
            <span>Last signed in {member.last_sign_in_at ? formatDistanceToNow(parseISO(member.last_sign_in_at), { addSuffix: true }) : 'never'}</span>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {isFetching && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" aria-label="Loading" />}
          <div className="flex rounded-md border overflow-hidden" role="group" aria-label="Period">
            {RANGES.map((r) => (
              <button
                key={r.label}
                type="button"
                aria-pressed={days === r.days}
                onClick={() => setDays(r.days)}
                className={`px-3 h-8 text-sm border-r last:border-r-0 ${days === r.days ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {data.scope === 'shared-projects' && (
        <p className="text-xs text-muted-foreground">Showing only the projects you manage that {member.first_name} is on.</p>
      )}

      {stats ? (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <Tile
            label="Standup rate"
            value={stats.standup_rate === null ? '—' : `${stats.standup_rate}%`}
            note={`${stats.standup_days} of ${stats.expected_days} working days`}
            alert={stats.standup_rate !== null && stats.standup_rate < 60}
          />
          <Tile label="Features released" value={stats.features_released} note={`${stats.open_features} still open`} />
          <Tile label="Deliverables" value={stats.deliverables_submitted} note={`${stats.deliverables_approved} approved · ${stats.reviews_given} reviews given`} />
          <Tile label="Blockers reported" value={stats.blockers} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No project activity in this period.</p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Projects" count={data.projects.length}>
          {data.projects.length === 0 ? <Empty text="Not on any project." /> : (
            <ul className="divide-y">
              {data.projects.map((p) => (
                <li key={p.project_id} className="p-3 flex items-center gap-3 text-sm">
                  <Link href={`/workspace/projects/${p.project_id}`} className="font-medium hover:text-primary">{p.name}</Link>
                  <span className="text-muted-foreground">{p.functional_role || p.project_role}</span>
                  {p.review_authority && <Badge variant="outline" className="text-[10px]">Reviewer</Badge>}
                  <Badge variant="secondary" className="ml-auto text-[10px]">{p.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Open features" count={data.open_features.length}>
          {data.open_features.length === 0 ? <Empty text="Nothing assigned right now." /> : (
            <ul className="divide-y">
              {data.open_features.map((f) => {
                const overdue = f.due_date && f.due_date < today;
                return (
                  <li key={f.id} className="p-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Link href={`/workspace/projects/${f.project_id}/features/${f.id}`} className="font-medium hover:text-primary truncate">{f.title}</Link>
                      <Badge variant="outline" className="text-[10px] ml-auto shrink-0">{f.status}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {f.project_name} · {f.priority}
                      {f.due_date && <span className={overdue ? 'text-destructive font-medium' : ''}> · {overdue ? 'Overdue, was due' : 'Due'} {fmt(f.due_date)}</span>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="Recent standups" count={data.recent_standups.length}>
          {data.recent_standups.length === 0 ? <Empty text="No standups submitted." /> : (
            <ul className="divide-y">
              {data.recent_standups.map((s) => (
                <li key={s.id} className="p-3 text-sm space-y-1">
                  <div className="text-xs text-muted-foreground">{fmt(s.submitted_at, 'EEE, MMM d · h:mm a')} · {s.project_name}</div>
                  <p className="line-clamp-2"><span className="text-muted-foreground">Today: </span>{s.today}</p>
                  {s.blockers?.trim() && (
                    <p className="text-destructive text-xs flex items-start gap-1"><AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />{s.blockers}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Recent deliverables" count={data.recent_deliverables.length}>
          {data.recent_deliverables.length === 0 ? <Empty text="No deliverables submitted." /> : (
            <ul className="divide-y">
              {data.recent_deliverables.map((d) => (
                <li key={d.id} className="p-3 text-sm flex items-center gap-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{d.title}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      <Link href={`/workspace/projects/${d.project_id}/features/${d.feature_id}`} className="hover:text-primary">{d.feature_title}</Link> · {fmt(d.submitted_at)}
                    </div>
                  </div>
                  {d.link && (
                    <a href={d.link} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary" aria-label={`Open ${d.title}`}>
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                  <Badge variant={d.status === 'Approved' ? 'default' : 'outline'} className="text-[10px] ml-auto shrink-0">{d.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Open action items" count={data.open_action_items.length}>
          {data.open_action_items.length === 0 ? <Empty text="No open action items." /> : (
            <ul className="divide-y">
              {data.open_action_items.map((a) => (
                <li key={a.id} className="p-3 text-sm">
                  <div>{a.description}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    <Link href={`/workspace/projects/${a.project_id}/meetings/${a.meeting_id}`} className="hover:text-primary">{a.meeting_title}</Link>
                    {' · '}{a.status}{a.due_date && ` · due ${fmt(a.due_date)}`}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Recent activity">
          {data.activity.length === 0 ? <Empty text="No recorded activity." /> : (
            <ul className="divide-y">
              {data.activity.map((a) => (
                <li key={a.id} className="p-3 text-sm flex items-start gap-3">
                  <div className="min-w-0">
                    <div>{a.description || `${a.action} ${a.entity_type}`}</div>
                    {a.project && <div className="text-xs text-muted-foreground">{a.project.name}</div>}
                  </div>
                  <span className="text-xs text-muted-foreground ml-auto shrink-0">{formatDistanceToNow(parseISO(a.created_at), { addSuffix: true })}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
