'use client';

import { use } from 'react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/store/AuthContext';
import { useProjectTeam } from '@/hooks/useProjectTeam';
import { useRoadmap, useUpdateRoadmapPhase, useDeleteRoadmapPhase, useUpdateRoadmapModule, useDeleteRoadmapModule, RoadmapPhase, RoadmapModule } from '@/hooks/useRoadmap';
import { RoadmapPhaseDialog } from '@/components/projects/RoadmapPhaseDialog';
import { RoadmapModuleDialog } from '@/components/projects/RoadmapModuleDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Map, Plus, MoreHorizontal, ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Edit, Trash2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

export default function RoadmapPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const { memberProfile } = useAuth();
  const router = useRouter();
  
  // Data Fetching
  const { data: teamMembers } = useProjectTeam(projectId);
  const { data: roadmaps, isLoading } = useRoadmap(projectId);
  
  // Mutations
  const updatePhaseMutation = useUpdateRoadmapPhase(projectId);
  const deletePhaseMutation = useDeleteRoadmapPhase(projectId);
  const updateModuleMutation = useUpdateRoadmapModule(projectId);
  const deleteModuleMutation = useDeleteRoadmapModule(projectId);

  // Dialog State
  const [phaseDialogOpen, setPhaseDialogOpen] = useState(false);
  const [phaseToEdit, setPhaseToEdit] = useState<RoadmapPhase | null>(null);
  
  const [moduleDialogOpen, setModuleDialogOpen] = useState(false);
  const [moduleToEdit, setModuleToEdit] = useState<RoadmapModule | null>(null);
  const [targetPhaseId, setTargetPhaseId] = useState<string | null>(null);

  if (isLoading) {
    return <div className="animate-pulse space-y-6">
      <div className="h-8 bg-muted rounded w-1/4"></div>
      <div className="flex gap-6 overflow-x-hidden pt-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="min-w-[350px] h-[500px] bg-muted rounded-xl"></div>
        ))}
      </div>
    </div>;
  }

  const isAdmin = memberProfile?.organization_role === 'Organization Admin';
  const isPM = teamMembers?.some((m: any) => m.member_id === memberProfile?.id && m.project_role === 'Project Manager');
  const canManage = isAdmin || isPM;

  // --- Phase Actions ---
  const handleEditPhase = (phase: RoadmapPhase) => {
    setPhaseToEdit(phase);
    setPhaseDialogOpen(true);
  };

  const handleDeletePhase = async (phaseId: string) => {
    if (confirm('Are you sure you want to delete this Phase? All modules inside it will also be deleted.')) {
      try {
        await deletePhaseMutation.mutateAsync(phaseId);
        toast.success('Phase deleted');
      } catch (e: any) {
        toast.error(e.message || 'Failed to delete phase');
      }
    }
  };

  const handleMovePhase = async (phase: RoadmapPhase, direction: 'left' | 'right') => {
    if (!roadmaps) return;
    const currentIndex = roadmaps.findIndex(r => r.id === phase.id);
    if (direction === 'left' && currentIndex === 0) return;
    if (direction === 'right' && currentIndex === roadmaps.length - 1) return;

    const swapIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1;
    const swapPhase = roadmaps[swapIndex];

    try {
      // Optimistically we could swap, but simple two-call is safer for MVP
      await Promise.all([
        updatePhaseMutation.mutateAsync({ phaseId: phase.id, data: { order_index: swapPhase.order_index } }),
        updatePhaseMutation.mutateAsync({ phaseId: swapPhase.id, data: { order_index: phase.order_index } })
      ]);
      toast.success('Phase moved');
    } catch (e: any) {
      toast.error('Failed to move phase');
    }
  };

  // --- Module Actions ---
  const handleEditModule = (module: RoadmapModule) => {
    setModuleToEdit(module);
    setTargetPhaseId(module.roadmap_id);
    setModuleDialogOpen(true);
  };

  const handleDeleteModule = async (moduleId: string) => {
    if (confirm('Are you sure you want to delete this module?')) {
      try {
        await deleteModuleMutation.mutateAsync(moduleId);
        toast.success('Module deleted');
      } catch (e: any) {
        toast.error(e.message || 'Failed to delete module');
      }
    }
  };

  const handleMoveModule = async (phase: RoadmapPhase, module: RoadmapModule, direction: 'up' | 'down') => {
    const modules = phase.modules;
    const currentIndex = modules.findIndex(m => m.id === module.id);
    if (direction === 'up' && currentIndex === 0) return;
    if (direction === 'down' && currentIndex === modules.length - 1) return;

    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const swapModule = modules[swapIndex];

    try {
      await Promise.all([
        updateModuleMutation.mutateAsync({ moduleId: module.id, data: { order_index: swapModule.order_index } }),
        updateModuleMutation.mutateAsync({ moduleId: swapModule.id, data: { order_index: module.order_index } })
      ]);
    } catch (e: any) {
      toast.error('Failed to move module');
    }
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return 'border-success text-success';
      case 'In Progress': return 'border-primary text-primary';
      default: return 'border-muted-foreground text-muted-foreground';
    }
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in">
      <div className="flex justify-between items-end mb-6 shrink-0">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Map className="w-6 h-6 text-primary" />
            Product Roadmap
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Macro-level planning: define high-level phases and map out functional modules.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto pb-6">
        <div className="flex gap-6 h-full items-start">
          
          {roadmaps?.map((phase, pIdx) => (
            <div key={phase.id} className="min-w-[350px] w-[350px] shrink-0 bg-secondary/30 rounded-xl border flex flex-col max-h-full">
              {/* Phase Header */}
              <div className="p-4 border-b bg-secondary/50 rounded-t-xl flex justify-between items-start group">
                <div>
                  <h3 className="font-semibold text-foreground line-clamp-1" title={phase.name}>{phase.name}</h3>
                  {(phase.start_date || phase.end_date) && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {phase.start_date || '?'} to {phase.end_date || '?'}
                    </p>
                  )}
                </div>
                
                {canManage && (
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 opacity-0 group-hover:opacity-100 transition-opacity" />}>
                        <MoreHorizontal className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleMovePhase(phase, 'left')} disabled={pIdx === 0}>
                        <ArrowLeft className="w-4 h-4 mr-2" /> Move Left
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleMovePhase(phase, 'right')} disabled={pIdx === (roadmaps.length - 1)}>
                        <ArrowRight className="w-4 h-4 mr-2" /> Move Right
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleEditPhase(phase)}>
                        <Edit className="w-4 h-4 mr-2" /> Edit Phase
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDeletePhase(phase.id)}>
                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

              {/* Modules List */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {phase.modules?.map((mod, mIdx) => (
                  <div 
                    key={mod.id} 
                    className="bg-card border rounded-lg p-4 shadow-sm group hover:border-primary/50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/workspace/projects/${projectId}/modules/${mod.id}`)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex gap-2 items-center flex-wrap">
                        <Badge className={`text-[10px] ${getPriorityColor(mod.priority)}`}>{mod.priority}</Badge>
                        <Badge variant="outline" className={`text-[10px] ${getStatusColor(mod.status)}`}>{mod.status}</Badge>
                      </div>
                      
                      {canManage && (
                        <div onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                          <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-6 w-6 -mr-2 -mt-2 opacity-0 group-hover:opacity-100 transition-opacity" />}>
                              <MoreHorizontal className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleMoveModule(phase, mod, 'up')} disabled={mIdx === 0}>
                              <ArrowUp className="w-4 h-4 mr-2" /> Move Up
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleMoveModule(phase, mod, 'down')} disabled={mIdx === (phase.modules.length - 1)}>
                              <ArrowDown className="w-4 h-4 mr-2" /> Move Down
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleEditModule(mod)}>
                              <Edit className="w-4 h-4 mr-2" /> Edit Module
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDeleteModule(mod.id)}>
                              <Trash2 className="w-4 h-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      )}
                    </div>
                    
                    <h4 className="font-medium text-sm text-foreground mb-1">{mod.name}</h4>
                    <p className="text-xs text-muted-foreground line-clamp-2" title={mod.objectives || ''}>
                      {mod.objectives}
                    </p>
                  </div>
                ))}

                {phase.modules?.length === 0 && (
                  <div className="text-center py-8 text-xs text-muted-foreground">
                    No modules in this phase.
                  </div>
                )}
              </div>

              {/* Add Module Button */}
              {canManage && (
                <div className="p-3 border-t bg-secondary/30 rounded-b-xl">
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setModuleToEdit(null);
                      setTargetPhaseId(phase.id);
                      setModuleDialogOpen(true);
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" /> Add Module
                  </Button>
                </div>
              )}
            </div>
          ))}

          {/* Add Phase Button */}
          {canManage && (
            <div className="min-w-[350px] shrink-0">
              <Button 
                variant="outline" 
                className="w-full h-[60px] border-dashed hover:bg-secondary/50"
                onClick={() => {
                  setPhaseToEdit(null);
                  setPhaseDialogOpen(true);
                }}
              >
                <Plus className="w-4 h-4 mr-2" /> Add Phase
              </Button>
            </div>
          )}
          
        </div>
      </div>

      <RoadmapPhaseDialog 
        projectId={projectId} 
        open={phaseDialogOpen} 
        onOpenChange={setPhaseDialogOpen} 
        phaseToEdit={phaseToEdit}
        nextOrderIndex={roadmaps ? Math.max(0, ...roadmaps.map((r: any) => r.order_index)) + 1 : 0}
      />
      
      <RoadmapModuleDialog 
        projectId={projectId} 
        roadmapId={targetPhaseId}
        open={moduleDialogOpen} 
        onOpenChange={setModuleDialogOpen} 
        moduleToEdit={moduleToEdit}
        nextOrderIndex={roadmaps && targetPhaseId 
          ? Math.max(0, ...(roadmaps.find((r: any) => r.id === targetPhaseId)?.modules.map((m: any) => m.order_index) || [0])) + 1 
          : 0}
      />

    </div>
  );
}
