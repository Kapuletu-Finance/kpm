'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/store/AuthContext';
import { useProjectTeam } from '@/hooks/useProjectTeam';
import { useSprints } from '@/hooks/useSprints';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Timer, Plus, Calendar, ArrowRight, Play } from 'lucide-react';
import { CreateSprintDialog } from '@/components/projects/CreateSprintDialog';
import { format, parseISO } from 'date-fns';

export default function SprintsHubPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const router = useRouter();
  const { memberProfile } = useAuth();
  
  const { data: teamMembers } = useProjectTeam(projectId);
  const { data: sprints, isLoading } = useSprints(projectId);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const isAdmin = memberProfile?.organization_role === 'Organization Admin';
  const isPM = teamMembers?.some((m: any) => m.member_id === memberProfile?.id && m.project_role === 'Project Manager');
  const canManage = isAdmin || isPM;

  if (isLoading) {
    return <div className="animate-pulse space-y-6">
      <div className="h-10 bg-muted rounded w-1/4"></div>
      <div className="h-40 bg-muted rounded-xl"></div>
      <div className="h-40 bg-muted rounded-xl"></div>
    </div>;
  }

  const activeSprints = sprints?.filter(s => s.status === 'Active' || s.status === 'Review') || [];
  const planningSprints = sprints?.filter(s => s.status === 'Planning') || [];
  const completedSprints = sprints?.filter(s => s.status === 'Completed') || [];

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'Active': return <Badge className="bg-success text-success-foreground">Active</Badge>;
      case 'Review': return <Badge className="bg-warning text-warning-foreground">Review</Badge>;
      case 'Completed': return <Badge className="bg-primary text-primary-foreground">Completed</Badge>;
      default: return <Badge variant="outline">Planning</Badge>;
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'TBD';
    try {
      return format(parseISO(dateStr), 'MMM d, yyyy');
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in space-y-8">
      
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Timer className="w-6 h-6 text-primary" />
            Sprints
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage agile timeboxes and execute work on the Kanban board.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Create Sprint
          </Button>
        )}
      </div>

      <div className="space-y-8">
        
        {/* Active Sprints */}
        {activeSprints.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2 text-success">Active Execution</h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {activeSprints.map(sprint => (
                <div key={sprint.id} className="bg-success/5 border border-success/20 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-success/10 rounded-bl-full -mr-8 -mt-8" />
                  
                  <div className="flex justify-between items-start mb-3">
                    {getStatusBadge(sprint.status)}
                    <Badge variant="secondary" className="font-mono">{sprint.features?.length || 0} features</Badge>
                  </div>
                  
                  <h4 className="font-bold text-lg mb-1">{sprint.name}</h4>
                  
                  <div className="flex items-center text-xs text-muted-foreground mb-4 font-medium">
                    <Calendar className="w-3 h-3 mr-1" />
                    {formatDate(sprint.start_date)} - {formatDate(sprint.end_date)}
                  </div>
                  
                  {sprint.goal && (
                    <p className="text-sm text-foreground/80 mb-6 line-clamp-2">
                      {sprint.goal}
                    </p>
                  )}

                  <Button className="w-full bg-success hover:bg-success/90" onClick={() => router.push(`/workspace/projects/${projectId}/sprints/${sprint.id}/board`)}>
                    <Play className="w-4 h-4 mr-2" /> Go to Board
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Planning Sprints */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold border-b pb-2">Backlog & Planning</h3>
          {planningSprints.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
              No sprints in planning.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {planningSprints.map(sprint => (
                <div key={sprint.id} className="bg-card border rounded-xl p-5 shadow-sm hover:border-primary/50 transition-colors group cursor-pointer" onClick={() => router.push(`/workspace/projects/${projectId}/sprints/${sprint.id}/plan`)}>
                  <div className="flex justify-between items-start mb-3">
                    {getStatusBadge(sprint.status)}
                    <Badge variant="secondary" className="font-mono">{sprint.features?.length || 0} features</Badge>
                  </div>
                  
                  <h4 className="font-bold text-lg mb-1 group-hover:text-primary transition-colors">{sprint.name}</h4>
                  
                  <div className="flex items-center text-xs text-muted-foreground mb-4 font-medium">
                    <Calendar className="w-3 h-3 mr-1" />
                    {formatDate(sprint.start_date)} - {formatDate(sprint.end_date)}
                  </div>
                  
                  <div className="flex items-center text-sm font-medium text-primary mt-4">
                    Plan Sprint <ArrowRight className="w-4 h-4 ml-1 opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:translate-x-1" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Completed Sprints */}
        {completedSprints.length > 0 && (
          <div className="space-y-4 opacity-75">
            <h3 className="text-lg font-semibold border-b pb-2">Completed</h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {completedSprints.map(sprint => (
                <div key={sprint.id} className="bg-muted/30 border rounded-xl p-5">
                  <div className="flex justify-between items-start mb-2">
                    {getStatusBadge(sprint.status)}
                  </div>
                  <h4 className="font-bold mb-1">{sprint.name}</h4>
                  <div className="flex items-center text-xs text-muted-foreground">
                    <Calendar className="w-3 h-3 mr-1" />
                    {formatDate(sprint.end_date)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      <CreateSprintDialog
        projectId={projectId}
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </div>
  );
}
