'use client';

import { useState } from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { AlertCircle, ChevronLeft, ChevronRight, Clock, Loader2, UserX } from 'lucide-react';
import { useOrganizationStandups } from '@/hooks/useInsights';
import { MarkdownRenderer } from '@/components/ui/markdown-renderer';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const shift = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 864e5).toISOString().slice(0, 10);

function Initials({ person }: { person: { first_name: string; last_name: string; avatar_url: string | null } | null }) {
  return (
    <Avatar className="w-8 h-8 border">
      <AvatarImage src={person?.avatar_url || ''} />
      <AvatarFallback className="text-xs">{person?.first_name?.[0]}{person?.last_name?.[0]}</AvatarFallback>
    </Avatar>
  );
}

export default function OrganizationStandupsPage() {
  // Undefined = "today" in the organization's timezone, resolved by the API
  const [date, setDate] = useState<string | undefined>();
  const { data, isLoading, error, isFetching } = useOrganizationStandups(date);
  const current = date ?? data?.date;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Daily Standups</h2>
          <p className="text-sm text-muted-foreground">Who has submitted, who hasn&apos;t, and what is blocking people, across your projects.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" aria-label="Previous day" disabled={!current} onClick={() => current && setDate(shift(current, -1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <input
            type="date"
            aria-label="Day"
            value={current ?? ''}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          />
          <Button variant="outline" size="icon" aria-label="Next day" disabled={!current} onClick={() => current && setDate(shift(current, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          {date && <Button variant="ghost" size="sm" onClick={() => setDate(undefined)}>Today</Button>}
          {isFetching && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" aria-label="Loading" />}
        </div>
      </div>

      {error && <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">{(error as Error).message}</div>}
      {isLoading && <div className="h-48 bg-muted/40 rounded-xl animate-pulse" />}

      {data && (
        <>
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            <div className="bg-card border rounded-xl p-4">
              <div className="text-xs text-muted-foreground">Submitted</div>
              <div className="text-2xl font-bold tabular-nums mt-1">{data.summary.submitted}<span className="text-base text-muted-foreground font-normal"> / {data.summary.expected}</span></div>
            </div>
            <div className="bg-card border rounded-xl p-4">
              <div className="text-xs text-muted-foreground flex items-center gap-1.5"><UserX className="w-3.5 h-3.5" /> Missing</div>
              <div className={`text-2xl font-bold tabular-nums mt-1 ${data.summary.missing > 0 && !data.is_weekend ? 'text-destructive' : ''}`}>{data.summary.missing}</div>
            </div>
            <div className="bg-card border rounded-xl p-4">
              <div className="text-xs text-muted-foreground flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" /> Reporting blockers</div>
              <div className="text-2xl font-bold tabular-nums mt-1">{data.summary.blockers}</div>
            </div>
            <div className="bg-card border rounded-xl p-4">
              <div className="text-xs text-muted-foreground flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Day</div>
              <div className="text-lg font-semibold mt-1">{format(parseISO(data.date), 'EEE, MMM d')}</div>
              <div className="text-xs text-muted-foreground">{data.timezone}{data.is_weekend && ' · weekend'}</div>
            </div>
          </div>

          {data.projects.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground bg-card border rounded-xl">
              No active projects with team members to report on.
            </div>
          )}

          {data.projects.map((p) => (
            <section key={p.id} className="bg-card border rounded-xl overflow-hidden">
              <div className="flex flex-wrap items-center gap-3 p-4 border-b">
                <Link href={`/workspace/projects/${p.id}/standups`} className="font-semibold hover:text-primary">{p.name}</Link>
                <span className="text-sm text-muted-foreground tabular-nums">{p.submitted.length} of {p.expected} submitted</span>
                {p.blockers > 0 && <Badge variant="destructive" className="text-[10px]">{p.blockers} blocker(s)</Badge>}
              </div>

              {p.missing.length > 0 && (
                <div className="px-4 py-3 border-b bg-muted/20 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground mr-1">Not submitted:</span>
                  {p.missing.map((m) => (
                    <Link key={m.id} href={`/workspace/organization/members/${m.id}`} className="inline-flex items-center gap-1.5 rounded-full border bg-background pl-1 pr-2.5 py-0.5 text-xs hover:border-primary">
                      <Initials person={m} />
                      {m.first_name} {m.last_name}
                    </Link>
                  ))}
                </div>
              )}

              {p.submitted.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No standups yet for this day.</p>
              ) : (
                <ul className="divide-y">
                  {p.submitted.map((s) => (
                    <li key={s.id} className="p-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <Initials person={s.members} />
                        <Link href={`/workspace/organization/members/${s.member_id}`} className="font-medium text-sm hover:text-primary">
                          {s.members?.first_name} {s.members?.last_name}
                        </Link>
                        <span className="text-xs text-muted-foreground">{format(parseISO(s.submitted_at), 'h:mm a')}</span>
                        {s.manager_comments && <Badge variant="secondary" className="text-[10px] ml-auto">Feedback given</Badge>}
                      </div>
                      <div className="grid gap-3 md:grid-cols-2 text-sm">
                        <div>
                          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Yesterday</div>
                          <div className="prose prose-sm dark:prose-invert max-w-none"><MarkdownRenderer content={s.yesterday || ''} /></div>
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Today</div>
                          <div className="prose prose-sm dark:prose-invert max-w-none"><MarkdownRenderer content={s.today || ''} /></div>
                        </div>
                      </div>
                      {s.blockers?.trim() && (
                        <div className="rounded-md bg-destructive/5 border border-destructive/20 p-3 text-sm">
                          <div className="text-xs font-semibold text-destructive flex items-center gap-1 mb-1"><AlertCircle className="w-3 h-3" /> Blockers</div>
                          <MarkdownRenderer content={s.blockers} />
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </>
      )}
    </div>
  );
}
