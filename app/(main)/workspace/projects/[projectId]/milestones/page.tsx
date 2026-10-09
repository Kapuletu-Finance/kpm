'use client';

import { use, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { Flag, Plus, Trash2, Trophy, Loader2, CalendarDays } from 'lucide-react';
import { useProject } from '@/hooks/useProjects';
import { useRoadmap } from '@/hooks/useRoadmap';
import { useDeleteMilestone, useMilestones, useSaveMilestone, type Milestone } from '@/hooks/useInsights';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const STATUSES: Milestone['status'][] = ['Planned', 'In Progress', 'Achieved', 'Missed'];
const today = () => new Date().toISOString().slice(0, 10);
const selectClass = 'h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring';

function statusBadge(m: Milestone) {
  const overdue = m.due_date && m.due_date < today() && (m.status === 'Planned' || m.status === 'In Progress');
  if (m.status === 'Achieved') return <Badge className="bg-success text-success-foreground">Achieved</Badge>;
  if (m.status === 'Missed') return <Badge variant="destructive">Missed</Badge>;
  if (overdue) return <Badge variant="destructive">Overdue</Badge>;
  return <Badge variant="outline">{m.status}</Badge>;
}

export default function MilestonesPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const { data: project } = useProject(projectId);
  const { data: milestones, isLoading } = useMilestones(projectId);
  const { data: phases } = useRoadmap(projectId);
  const save = useSaveMilestone(projectId);
  const remove = useDeleteMilestone(projectId);
  const canManage = Boolean(project?.can_manage);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', due_date: '', roadmap_id: '' });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await save.mutateAsync({
        data: {
          title: form.title,
          description: form.description || undefined,
          due_date: form.due_date || null,
          roadmap_id: form.roadmap_id || null,
        },
      });
      toast.success('Milestone added');
      setOpen(false);
      setForm({ title: '', description: '', due_date: '', roadmap_id: '' });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const setStatus = async (m: Milestone, status: Milestone['status']) => {
    try {
      await save.mutateAsync({ id: m.id, data: { status } });
      toast.success(status === 'Achieved' ? `Achieved: ${m.title}` : `Moved to ${status}`);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (m: Milestone) => {
    if (!window.confirm(`Delete milestone "${m.title}"?`)) return;
    try {
      await remove.mutateAsync(m.id);
      toast.success('Milestone deleted');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const upcoming = (milestones ?? []).filter((m) => m.status === 'Planned' || m.status === 'In Progress');
  const done = (milestones ?? []).filter((m) => m.status === 'Achieved' || m.status === 'Missed');
  const achieved = done.filter((m) => m.status === 'Achieved').length;

  const Row = ({ m }: { m: Milestone }) => (
    <li className="p-4 flex flex-wrap items-start gap-3">
      <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${m.status === 'Achieved' ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'}`}>
        {m.status === 'Achieved' ? <Trophy className="w-4 h-4" /> : <Flag className="w-4 h-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{m.title}</span>
          {statusBadge(m)}
          {m.phase && <Badge variant="secondary" className="text-[10px]">{m.phase.name}</Badge>}
        </div>
        {m.description && <p className="text-sm text-muted-foreground mt-1">{m.description}</p>}
        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
          <CalendarDays className="w-3.5 h-3.5" />
          {m.status === 'Achieved' && m.achieved_at
            ? `Achieved ${format(parseISO(m.achieved_at), 'MMM d, yyyy')}${m.due_date ? ` (due ${format(parseISO(m.due_date), 'MMM d')})` : ''}`
            : m.due_date ? `Due ${format(parseISO(m.due_date), 'MMM d, yyyy')}` : 'No due date'}
        </div>
      </div>
      {canManage && (
        <div className="flex items-center gap-2">
          <select
            aria-label={`Status of ${m.title}`}
            value={m.status}
            disabled={save.isPending}
            onChange={(e) => setStatus(m, e.target.value as Milestone['status'])}
            className={selectClass}
          >
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <Button variant="ghost" size="icon" aria-label={`Delete ${m.title}`} className="text-muted-foreground hover:text-destructive" onClick={() => handleDelete(m)}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      )}
    </li>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Flag className="w-6 h-6 text-primary" /> Milestones</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Checkpoints the team is working toward. {milestones?.length ? `${achieved} of ${milestones.length} achieved.` : ''}
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" /> Add milestone</Button>
        )}
      </div>

      {isLoading ? <div className="h-40 bg-muted/40 rounded-xl animate-pulse" /> : (
        <>
          <section className="bg-card border rounded-xl">
            <h3 className="font-semibold p-4 border-b text-sm">Upcoming ({upcoming.length})</h3>
            {upcoming.length === 0
              ? <p className="p-4 text-sm text-muted-foreground">{canManage ? 'No upcoming milestones. Add one to give the team a target.' : 'No upcoming milestones.'}</p>
              : <ul className="divide-y">{upcoming.map((m) => <Row key={m.id} m={m} />)}</ul>}
          </section>
          {done.length > 0 && (
            <section className="bg-card border rounded-xl">
              <h3 className="font-semibold p-4 border-b text-sm">Achievements & closed ({done.length})</h3>
              <ul className="divide-y">{done.map((m) => <Row key={m.id} m={m} />)}</ul>
            </section>
          )}
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add milestone</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <label htmlFor="ms-title" className="text-sm font-medium">Title</label>
              <Input id="ms-title" required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Beta launch to first customers" />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="ms-desc" className="text-sm font-medium">What does done look like?</label>
              <Textarea id="ms-desc" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="ms-due" className="text-sm font-medium">Due date</label>
                <Input id="ms-due" type="date" value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="ms-phase" className="text-sm font-medium">Roadmap phase</label>
                <select id="ms-phase" value={form.roadmap_id} onChange={(e) => setForm((f) => ({ ...f, roadmap_id: e.target.value }))} className={`${selectClass} w-full`}>
                  <option value="">None</option>
                  {(phases ?? []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Add milestone
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
