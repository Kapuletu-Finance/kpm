'use client';

import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRelease, useUpdateRelease, useAssignFeaturesToRelease } from '@/hooks/useReleases';
import { useAuth } from '@/store/AuthContext';
import { useProjectTeam } from '@/hooks/useProjectTeam';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ArrowLeft, Rocket, Save, Plus, X, Loader2, CheckCircle2, Circle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

export default function ReleaseDetailPage({ params }: { params: Promise<{ projectId: string, releaseId: string }> }) {
  const { projectId, releaseId } = use(params);
  const router = useRouter();
  const { memberProfile } = useAuth();
  const { data: teamMembers } = useProjectTeam(projectId);
  const { data: release, isLoading } = useRelease(projectId, releaseId);
  const updateMutation = useUpdateRelease(projectId);
  const assignMutation = useAssignFeaturesToRelease(projectId);

  const role = teamMembers?.find((m: any) => m.member_id === memberProfile?.id)?.project_role;
  const isGlobalAdmin = memberProfile?.organization_role === 'Organization Admin';
  const canManage = isGlobalAdmin || role === 'Project Manager';

  // Editable fields
  const [status, setStatus] = useState<string>('Planned');
  const [notes, setNotes] = useState('');
  
  // Unassigned features for the modal
  const [unassignedFeatures, setUnassignedFeatures] = useState<any[]>([]);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const supabase = createClient();

  useEffect(() => {
    if (release) {
      setStatus(release.status);
      setNotes(release.release_notes || '');
    }
  }, [release]);

  const loadUnassignedFeatures = async () => {
    const { data } = await supabase
      .from('features')
      .select('id, title, status, priority')
      .eq('module_id', (await supabase.from('modules').select('id').eq('roadmap_id', (await supabase.from('roadmaps').select('id').eq('project_id', projectId).single()).data?.id))) // Simplification, ideally we join properly, but let's just query where release_id is null
    
    // Actually, we can just fetch all features for the project. 
    // Wait, let's do a proper query:
    const { data: roadmaps } = await supabase.from('roadmaps').select('id').eq('project_id', projectId);
    if (!roadmaps?.length) return;
    const roadmapIds = roadmaps.map(r => r.id);
    const { data: modules } = await supabase.from('modules').select('id').in('roadmap_id', roadmapIds);
    if (!modules?.length) return;
    const moduleIds = modules.map(m => m.id);
    
    const { data: features } = await supabase
      .from('features')
      .select('id, title, status, priority')
      .in('module_id', moduleIds)
      .is('release_id', null);

    if (features) setUnassignedFeatures(features);
  };

  const handleUpdate = async () => {
    try {
      await updateMutation.mutateAsync({
        releaseId,
        data: {
          status: status as any,
          release_notes: notes
        }
      });
      toast.success('Release updated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update release');
    }
  };

  const handleAssign = async () => {
    if (selectedFeatures.length === 0) return;
    try {
      await assignMutation.mutateAsync({
        releaseId,
        featureIds: selectedFeatures,
        action: 'assign'
      });
      toast.success('Features assigned successfully');
      setIsAssignModalOpen(false);
      setSelectedFeatures([]);
    } catch (err: any) {
      toast.error(err.message || 'Failed to assign features');
    }
  };

  const handleRemoveFeature = async (featureId: string) => {
    try {
      await assignMutation.mutateAsync({
        releaseId,
        featureIds: [featureId],
        action: 'remove'
      });
      toast.success('Feature removed from release');
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove feature');
    }
  };

  if (isLoading) return <div className="p-6 animate-pulse">Loading Release...</div>;
  if (!release) return <div className="p-6">Release not found</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4 border-b pb-6">
        <Link href={`/workspace/projects/${projectId}/releases`}>
          <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{release.version}</h1>
            {release.title && <Badge variant="secondary" className="text-sm font-normal">{release.title}</Badge>}
          </div>
        </div>
        {canManage && (
          <div className="flex items-center gap-3">
            <Select value={status} onValueChange={(val: string | null) => val && setStatus(val)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Planned">Planned</SelectItem>
                <SelectItem value="Staging">Staging</SelectItem>
                <SelectItem value="Released">Released</SelectItem>
                <SelectItem value="Rolled Back">Rolled Back</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Changes
            </Button>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-6">
          <section className="space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Rocket className="w-5 h-5 text-primary" /> Features Included
            </h2>
            
            <div className="bg-card border rounded-xl overflow-hidden">
              {release.features?.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  No features assigned to this release yet.
                </div>
              ) : (
                <div className="divide-y">
                  {release.features?.map(feature => (
                    <div key={feature.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                      <div>
                        <h3 className="font-medium">{feature.title}</h3>
                        <p className="text-xs text-muted-foreground mt-1">Status: {feature.status}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {canManage && (
                          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={() => handleRemoveFeature(feature.id)}>
                            Remove
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {canManage && (
              <Dialog open={isAssignModalOpen} onOpenChange={(val) => {
                setIsAssignModalOpen(val);
                if (val) loadUnassignedFeatures();
                else setSelectedFeatures([]);
              }}>
                <DialogTrigger className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 w-full border-dashed">
                  <Plus className="w-4 h-4 mr-2" /> Assign Features
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
                  <DialogHeader>
                    <DialogTitle>Assign Features to {release.version}</DialogTitle>
                  </DialogHeader>
                  <div className="flex-1 overflow-y-auto pr-2 space-y-2 mt-4">
                    {unassignedFeatures.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">No unassigned features found in this project.</p>
                    ) : (
                      unassignedFeatures.map(feature => {
                        const isSelected = selectedFeatures.includes(feature.id);
                        return (
                          <div 
                            key={feature.id} 
                            onClick={() => setSelectedFeatures(prev => isSelected ? prev.filter(id => id !== feature.id) : [...prev, feature.id])}
                            className={`p-3 border rounded-lg cursor-pointer transition-colors flex items-center gap-3 ${isSelected ? 'border-primary bg-primary/5' : 'hover:border-primary/50'}`}
                          >
                            {isSelected ? <CheckCircle2 className="w-5 h-5 text-primary" /> : <Circle className="w-5 h-5 text-muted-foreground" />}
                            <div>
                              <p className="font-medium text-sm">{feature.title}</p>
                              <p className="text-xs text-muted-foreground">{feature.status}</p>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                  <div className="pt-4 border-t flex justify-end gap-2 mt-auto">
                    <Button variant="outline" onClick={() => setIsAssignModalOpen(false)}>Cancel</Button>
                    <Button onClick={handleAssign} disabled={selectedFeatures.length === 0 || assignMutation.isPending}>
                      Assign {selectedFeatures.length} Features
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className="space-y-2">
            <label className="text-sm font-medium">Release Notes</label>
            <Textarea 
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="min-h-[200px]"
              placeholder="Detailed release notes for this version..."
              disabled={!canManage}
            />
          </section>
          
          {!canManage && (
            <div className="p-4 bg-muted/30 rounded-xl text-sm text-muted-foreground">
              Only Project Managers can edit release configurations.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
