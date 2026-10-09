'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { ArrowLeft, ChevronRight, CheckCircle2, Loader2, Save, Flag } from 'lucide-react';
import { useProject } from '@/hooks/useProjects';
import { useSprint, useSprints } from '@/hooks/useSprints';
import { useCompleteSprint, useRetrospective, useSaveRetrospective, useSprintInsights, type Retrospective } from '@/hooks/useInsights';
import { BurndownChart, VelocityChart } from '@/components/charts/SprintCharts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';

const RETRO_FIELDS: { key: keyof Retrospective; label: string; hint: string }[] = [
  { key: 'what_went_well', label: 'What went well', hint: 'Wins worth repeating' },
  { key: 'what_didnt_go_well', label: "What didn't go well", hint: 'Friction, surprises, misses' },
  { key: 'lessons_learned', label: 'Lessons learned', hint: 'What we know now' },
  { key: 'process_improvements', label: 'Process improvements', hint: 'Concrete changes for next sprint' },
];

function Stat({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="bg-card border rounded-xl p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold tabular-nums mt-1">{value}</div>
      {note && <div className="text-xs text-muted-foreground mt-0.5">{note}</div>}
    </div>
  );
}

export default function SprintInsightsPage({ params }: { params: Promise<{ projectId: string; sprintId: string }> }) {
  const { projectId, sprintId } = use(params);
  const { data: project } = useProject(projectId);
  const { data: sprint, isLoading } = useSprint(projectId, sprintId);
  const { data: sprints } = useSprints(projectId);
  const { data: insights, isLoading: loadingInsights, error: insightsError } = useSprintInsights(projectId, sprintId);
  const { data: retro } = useRetrospective(projectId, sprintId);
  const saveRetro = useSaveRetrospective(projectId, sprintId);
  const completeSprint = useCompleteSprint(projectId, sprintId);

  const canManage = Boolean(project?.can_manage);
  const [carryTo, setCarryTo] = useState('backlog');

  if (isLoading) return <div className="animate-pulse h-64 bg-muted rounded-xl" />;
  if (!sprint) return <div className="text-muted-foreground">Sprint not found.</div>;

  const isCompleted = sprint.status === 'Completed';
  const remaining = insights ? insights.total - insights.completed : 0;
  const nextSprints = (sprints ?? []).filter((s: any) => s.id !== sprintId && s.status !== 'Completed');
  const dates = (d: string | null) => (d ? format(parseISO(d), 'MMM d, yyyy') : 'TBD');

  const handleComplete = async () => {
    const target = carryTo === 'backlog' ? 'the backlog' : nextSprints.find((s: any) => s.id === carryTo)?.name;
    if (!window.confirm(`Complete ${sprint.name}? Unfinished features move to ${target}.`)) return;
    try {
      const result = await completeSprint.mutateAsync(carryTo);
      toast.success(result.carried_over ? `Sprint completed; ${result.carried_over} feature(s) carried over` : 'Sprint completed');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div>
        <div className="flex items-center text-sm text-muted-foreground gap-2 mb-1">
          <Link href={`/workspace/projects/${projectId}/sprints`} className="hover:text-foreground flex items-center transition-colors">
            <ArrowLeft className="w-4 h-4 mr-1" /> Sprints
          </Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-foreground font-medium">{sprint.name}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{sprint.name} insights</h1>
          <Badge variant={isCompleted ? 'default' : 'outline'}>{sprint.status}</Badge>
          <span className="text-sm text-muted-foreground">{dates(sprint.start_date)} – {dates(sprint.end_date)}</span>
          {!isCompleted && (
            <Link href={`/workspace/projects/${projectId}/sprints/${sprintId}/board`} className="text-sm text-primary hover:underline ml-auto">
              Open board
            </Link>
          )}
        </div>
        {sprint.goal && <p className="text-muted-foreground mt-2 max-w-3xl"><Flag className="w-4 h-4 inline mr-1.5 -mt-0.5" />{sprint.goal}</p>}
      </div>

      {insightsError && (
        <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">{(insightsError as Error).message}</div>
      )}

      {insights && (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Stat label="Features in sprint" value={insights.total} />
          <Stat label="Released" value={insights.completed} note={insights.total ? `${Math.round((insights.completed / insights.total) * 100)}% of scope` : undefined} />
          <Stat label="Remaining" value={remaining} />
          <Stat label="Standups logged" value={insights.standups} />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="bg-card border rounded-xl p-5 space-y-3">
          <div>
            <h2 className="font-semibold">Burndown</h2>
            <p className="text-xs text-muted-foreground">Features not yet released, day by day, against an even pace to zero.</p>
          </div>
          {loadingInsights ? <div className="h-56 bg-muted/40 rounded-lg animate-pulse" /> : insights && <BurndownChart data={insights.burndown} />}
        </section>
        <section className="bg-card border rounded-xl p-5 space-y-3">
          <div>
            <h2 className="font-semibold">Velocity</h2>
            <p className="text-xs text-muted-foreground">Recent completed sprints, plus this one. Use it to size the next sprint.</p>
          </div>
          {loadingInsights ? <div className="h-56 bg-muted/40 rounded-lg animate-pulse" /> : insights && <VelocityChart data={insights.velocity} currentSprintId={sprintId} />}
        </section>
      </div>

      {/* Re-mounts when a saved version arrives, so the editor starts from it */}
      <RetroEditor key={retro?.updated_at ?? (retro === undefined ? 'loading' : 'new')} retro={retro ?? null} onSave={async (d) => {
        try {
          await saveRetro.mutateAsync(d);
          toast.success('Retrospective saved');
        } catch (e: any) {
          toast.error(e.message);
        }
      }} saving={saveRetro.isPending} />

      {canManage && !isCompleted && (
        <section className="bg-card border rounded-xl p-5 space-y-3">
          <h2 className="font-semibold">Complete this sprint</h2>
          <p className="text-sm text-muted-foreground">
            {remaining > 0
              ? `${remaining} feature(s) are not released yet. Choose where they go.`
              : 'Every feature in this sprint is released.'}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {remaining > 0 && (
              <label className="flex items-center gap-2 text-sm">
                Carry unfinished work to
                <select
                  value={carryTo}
                  onChange={(e) => setCarryTo(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="backlog">Backlog</option>
                  {nextSprints.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.status})</option>
                  ))}
                </select>
              </label>
            )}
            <Button onClick={handleComplete} disabled={completeSprint.isPending}>
              {completeSprint.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Complete sprint
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}

/** The team's retrospective form. Starts from the saved version; the parent re-keys it when that changes. */
function RetroEditor({ retro, onSave, saving }: { retro: Retrospective | null; onSave: (d: Partial<Retrospective>) => Promise<void>; saving: boolean }) {
  const [draft, setDraft] = useState<Partial<Retrospective>>(retro ?? {});

  return (
    <section className="bg-card border rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold">Retrospective</h2>
          <p className="text-xs text-muted-foreground">
            Written together by the whole team.
            {retro?.updated_at && ` Last saved ${format(parseISO(retro.updated_at), 'MMM d, h:mm a')}.`}
          </p>
        </div>
        <Button size="sm" onClick={() => onSave(draft)} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {RETRO_FIELDS.map((f) => (
          <div key={f.key} className="space-y-1.5">
            <label htmlFor={`retro-${f.key}`} className="text-sm font-medium">{f.label}</label>
            <Textarea
              id={`retro-${f.key}`}
              placeholder={f.hint}
              className="min-h-[110px]"
              value={(draft[f.key] as string | null) ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
