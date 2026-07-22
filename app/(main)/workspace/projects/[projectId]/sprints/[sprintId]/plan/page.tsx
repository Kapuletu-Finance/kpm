'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/store/AuthContext';
import { useProjectTeam } from '@/hooks/useProjectTeam';
import { useSprint, useUpdateSprint, useBacklogFeatures } from '@/hooks/useSprints';
import { useUpdateFeature } from '@/hooks/useFeatures';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ArrowLeft, ArrowRight, ArrowRightCircle, CheckCircle2, ChevronRight, XCircle } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

export default function SprintPlanPage({ params }: { params: Promise<{ projectId: string, sprintId: string }> }) {
  const { projectId, sprintId } = use(params);
  const router = useRouter();
  const { memberProfile } = useAuth();
  const [startDialogOpen, setStartDialogOpen] = useState(false);
  
  const { data: teamMembers } = useProjectTeam(projectId);
  const { data: sprint, isLoading: isSprintLoading } = useSprint(projectId, sprintId);
  const { data: backlogFeatures, isLoading: isBacklogLoading } = useBacklogFeatures(projectId);

  const updateSprintMutation = useUpdateSprint(projectId);
  const updateFeatureMutation = useUpdateFeature(projectId);
  const queryClient = useQueryClient();

  const isAdmin = memberProfile?.organization_role === 'Organization Admin';
  const isPM = teamMembers?.some((m: any) => m.member_id === memberProfile?.id && m.project_role === 'Project Manager');
  const canManage = isAdmin || isPM;

  if (isSprintLoading || isBacklogLoading) {
    return <div className="animate-pulse space-y-6">
      <div className="h-8 bg-muted rounded w-1/3"></div>
      <div className="flex gap-6"><div className="h-96 bg-muted rounded-xl flex-1"></div><div className="w-96 bg-muted rounded-xl h-96"></div></div>
    </div>;
  }

  if (!sprint) {
    return <div>Sprint not found</div>;
  }

  const handleStartSprint = async () => {
    try {
      await updateSprintMutation.mutateAsync({ sprintId, data: { status: 'Active' } });
      toast.success('Sprint Started!');
      router.push(`/workspace/projects/${projectId}/sprints/${sprintId}/board`);
    } catch (error) { toast.error('Failed to start sprint'); }
  };

  const handleAddToSprint = async (featureId: string) => {
    try {
      await updateFeatureMutation.mutateAsync({ featureId, data: { sprint_id: sprintId } });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'sprints'] });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'features', 'backlog'] });
      toast.success('Added to sprint');
    } catch (error) { toast.error('Failed to add'); }
  };

  const handleRemoveFromSprint = async (featureId: string) => {
    try {
      await updateFeatureMutation.mutateAsync({ featureId, data: { sprint_id: null } });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'sprints'] });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'features', 'backlog'] });
      toast.success('Removed from sprint');
    } catch (error) { toast.error('Failed to remove'); }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Critical': return 'bg-destructive text-destructive-foreground';
      case 'High': return 'bg-orange-500 text-white';
      case 'Medium': return 'bg-blue-500 text-white';
      case 'Low': return 'bg-muted text-muted-foreground';
      default: return 'bg-secondary text-secondary-foreground';
    }
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in space-y-6">
      
      {/* Breadcrumbs */}
      <div className="flex items-center text-sm text-muted-foreground gap-2">
        <Link href={`/workspace/projects/${projectId}/sprints`} className="hover:text-foreground flex items-center transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1" /> Sprints
        </Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-foreground font-medium">{sprint.name} (Planning)</span>
      </div>

      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Plan: {sprint.name}</h1>
          <p className="text-muted-foreground max-w-2xl">{sprint.goal || 'No goal set for this sprint.'}</p>
        </div>
        
        {canManage && sprint.status === 'Planning' && (
          <>
            <Button onClick={() => setStartDialogOpen(true)} className="bg-success hover:bg-success/90">
              <CheckCircle2 className="w-4 h-4 mr-2" /> Start Sprint
            </Button>
            <AlertDialog open={startDialogOpen} onOpenChange={setStartDialogOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Start Sprint</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to start this sprint? The sprint board will unlock and the team can begin execution.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleStartSprint} className="bg-success hover:bg-success/90">
                    Yes, Start Sprint
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-250px)] min-h-[500px]">
        
        {/* Left: Backlog */}
        <div className="bg-card border rounded-xl shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b bg-muted/20">
            <h3 className="font-semibold flex items-center justify-between">
              Project Backlog
              <Badge variant="secondary">{backlogFeatures?.length || 0}</Badge>
            </h3>
            <p className="text-xs text-muted-foreground mt-1">Features not assigned to any sprint.</p>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {backlogFeatures?.map(feature => (
              <div key={feature.id} className="border rounded-lg p-3 hover:border-primary/50 transition-colors flex items-center justify-between group">
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-[10px]">{feature.status}</Badge>
                    <Badge className={`text-[10px] ${getPriorityColor(feature.priority)}`}>{feature.priority}</Badge>
                    <span className="text-xs text-muted-foreground truncate">{feature.modules?.name}</span>
                  </div>
                  <h4 className="font-medium text-sm truncate">{feature.title}</h4>
                </div>
                {canManage && (
                  <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleAddToSprint(feature.id)}>
                    <ArrowRightCircle className="w-5 h-5" />
                  </Button>
                )}
              </div>
            ))}

            {backlogFeatures?.length === 0 && (
              <div className="text-center py-12 text-sm text-muted-foreground">
                No unassigned features found in the backlog.
              </div>
            )}
          </div>
        </div>

        {/* Right: Sprint Scope */}
        <div className="bg-primary/5 border border-primary/20 rounded-xl shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b border-primary/20 bg-primary/10">
            <h3 className="font-semibold text-primary flex items-center justify-between">
              Sprint Scope
              <Badge className="bg-primary">{sprint.features?.length || 0}</Badge>
            </h3>
            <p className="text-xs text-primary/70 mt-1">Features assigned to {sprint.name}.</p>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {sprint.features?.map((feature: any) => (
              <div key={feature.id} className="bg-card border rounded-lg p-3 shadow-sm hover:border-destructive/50 transition-colors flex items-center justify-between group">
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-[10px]">{feature.status}</Badge>
                    <Badge className={`text-[10px] ${getPriorityColor(feature.priority)}`}>{feature.priority}</Badge>
                  </div>
                  <h4 className="font-medium text-sm truncate">{feature.title}</h4>
                </div>
                {canManage && (
                  <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleRemoveFromSprint(feature.id)}>
                    <XCircle className="w-5 h-5" />
                  </Button>
                )}
              </div>
            ))}

            {sprint.features?.length === 0 && (
              <div className="text-center py-12 text-sm text-muted-foreground flex flex-col items-center">
                <ArrowRight className="w-8 h-8 text-primary/40 mb-2" />
                Add features from the backlog to this sprint.
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
