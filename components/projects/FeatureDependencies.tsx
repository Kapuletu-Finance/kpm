'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { GitBranch, Link2, Plus, X, AlertTriangle } from 'lucide-react';
import { useFeatureDependencies, useLinkCandidates, useLinkFeature, useUnlinkFeature } from '@/hooks/useInsights';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const selectClass = 'h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring';

/** Sidebar panel: what this feature blocks, is blocked by, or relates to. */
export function FeatureDependencies({ projectId, featureId, canManage }: { projectId: string; featureId: string; canManage: boolean }) {
  const { data: deps, isLoading } = useFeatureDependencies(projectId, featureId);
  const [adding, setAdding] = useState(false);
  const { data: candidates } = useLinkCandidates(projectId, featureId, adding);
  const link = useLinkFeature(projectId, featureId);
  const unlink = useUnlinkFeature(projectId, featureId);
  const [otherId, setOtherId] = useState('');
  const [relation, setRelation] = useState('Blocked By');

  const blockedBy = (deps ?? []).filter((d) => d.blocking);
  const linked = new Set((deps ?? []).map((d) => d.feature.id));

  const handleLink = async () => {
    if (!otherId) return;
    try {
      await link.mutateAsync({ depends_on_feature_id: otherId, dependency_type: relation });
      toast.success('Features linked');
      setAdding(false);
      setOtherId('');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleUnlink = async (id: string) => {
    try {
      await unlink.mutateAsync(id);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="bg-card border rounded-xl p-5 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <GitBranch className="w-4 h-4" /> Dependencies
        </h3>
        {canManage && !adding && (
          <Button variant="ghost" size="sm" className="h-7" onClick={() => setAdding(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Link
          </Button>
        )}
      </div>

      {blockedBy.length > 0 && (
        <div className="rounded-md border border-warning/40 bg-warning/10 p-2.5 text-xs flex gap-2">
          <AlertTriangle className="w-4 h-4 text-warning shrink-0" aria-hidden />
          <span>Blocked by {blockedBy.length} unreleased feature{blockedBy.length > 1 ? 's' : ''}.</span>
        </div>
      )}

      {isLoading ? (
        <div className="h-10 bg-muted/40 rounded animate-pulse" />
      ) : (deps ?? []).length === 0 && !adding ? (
        <p className="text-sm text-muted-foreground">No linked features.</p>
      ) : (
        <ul className="space-y-2">
          {(deps ?? []).map((d) => (
            <li key={d.id} className="flex items-start gap-2 text-sm">
              <Badge variant={d.blocking ? 'destructive' : 'outline'} className="text-[10px] shrink-0 mt-0.5">{d.relation}</Badge>
              <div className="min-w-0 flex-1">
                <Link href={`/workspace/projects/${projectId}/features/${d.feature.id}`} className="hover:text-primary line-clamp-2">{d.feature.title}</Link>
                <div className="text-xs text-muted-foreground">{d.feature.status}</div>
              </div>
              {canManage && (
                <button
                  type="button"
                  onClick={() => handleUnlink(d.id)}
                  className="text-muted-foreground hover:text-destructive p-0.5"
                  aria-label={`Unlink ${d.feature.title}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <div className="space-y-2 border-t pt-3">
          <select aria-label="Relationship" value={relation} onChange={(e) => setRelation(e.target.value)} className={selectClass}>
            <option value="Blocked By">This feature is blocked by…</option>
            <option value="Blocks">This feature blocks…</option>
            <option value="Relates To">This feature relates to…</option>
          </select>
          <select aria-label="Feature" value={otherId} onChange={(e) => setOtherId(e.target.value)} className={selectClass}>
            <option value="">Choose a feature</option>
            {(candidates ?? []).filter((c) => !linked.has(c.id)).map((c) => (
              <option key={c.id} value={c.id}>{c.title} ({c.module_name})</option>
            ))}
          </select>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setAdding(false); setOtherId(''); }}>Cancel</Button>
            <Button size="sm" onClick={handleLink} disabled={!otherId || link.isPending}>
              <Link2 className="w-3.5 h-3.5 mr-1.5" /> Link
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
