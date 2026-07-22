'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/store/AuthContext';
import { useProjectTeam } from '@/hooks/useProjectTeam';
import { useModuleFeatures } from '@/hooks/useFeatures';
import { useRoadmap } from '@/hooks/useRoadmap';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Target, Plus, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { CreateFeatureDialog } from '@/components/projects/CreateFeatureDialog';

export default function ModuleDetailsPage({ params }: { params: Promise<{ projectId: string, moduleId: string }> }) {
  const { projectId, moduleId } = use(params);
  const router = useRouter();
  const { memberProfile } = useAuth();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  
  const { data: teamMembers } = useProjectTeam(projectId);
  const { data: roadmaps, isLoading: isRoadmapLoading } = useRoadmap(projectId);
  const { data: features, isLoading: isFeaturesLoading } = useModuleFeatures(projectId, moduleId);

  if (isRoadmapLoading || isFeaturesLoading) {
    return <div className="animate-pulse space-y-6">
      <div className="h-8 bg-muted rounded w-1/3"></div>
      <div className="h-64 bg-muted rounded-xl"></div>
    </div>;
  }

  // Find the specific module from the roadmap tree
  const currentPhase = roadmaps?.find(r => r.modules.some(m => m.id === moduleId));
  const currentModule = currentPhase?.modules.find(m => m.id === moduleId);

  if (!currentModule) {
    return <div>Module not found</div>;
  }

  const isAdmin = memberProfile?.organization_role === 'Organization Admin';
  const isPM = teamMembers?.some((m: any) => m.member_id === memberProfile?.id && m.project_role === 'Project Manager');
  const canManage = isAdmin || isPM;

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Critical': return 'bg-destructive text-destructive-foreground';
      case 'High': return 'bg-orange-500 text-white';
      case 'Medium': return 'bg-blue-500 text-white';
      case 'Low': return 'bg-muted text-muted-foreground';
      default: return 'bg-secondary text-secondary-foreground';
    }
  };

  const completedFeatures = features?.filter(f => f.status === 'Released').length || 0;
  const totalFeatures = features?.length || 0;
  const progress = totalFeatures > 0 ? Math.round((completedFeatures / totalFeatures) * 100) : 0;

  return (
    <div className="flex flex-col h-full animate-in fade-in space-y-6">
      
      {/* Breadcrumbs */}
      <div className="flex items-center text-sm text-muted-foreground gap-2">
        <Link href={`/workspace/projects/${projectId}/roadmap`} className="hover:text-foreground flex items-center transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Roadmap
        </Link>
        <ChevronRight className="w-4 h-4" />
        <span>{currentPhase?.name}</span>
        <ChevronRight className="w-4 h-4" />
        <span className="text-foreground font-medium">{currentModule.name}</span>
      </div>

      {/* Header Card */}
      <div className="bg-card border rounded-xl p-6 shadow-sm">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight mb-2">{currentModule.name}</h1>
            <div className="flex gap-2 items-center flex-wrap">
              <Badge className={getPriorityColor(currentModule.priority)}>{currentModule.priority}</Badge>
              <Badge variant="outline">{currentModule.status}</Badge>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground mb-1">Module Progress</div>
            <div className="text-3xl font-bold text-primary">{progress}%</div>
          </div>
        </div>
        
        {currentModule.objectives && (
          <div className="mt-4 p-4 bg-primary/5 rounded-lg border border-primary/10 flex gap-3">
            <Target className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-primary mb-1">Primary Objectives</h3>
              <p className="text-sm text-foreground/80 whitespace-pre-wrap">{currentModule.objectives}</p>
            </div>
          </div>
        )}
        
        {currentModule.description && (
          <div className="mt-4 text-sm text-muted-foreground whitespace-pre-wrap">
            {currentModule.description}
          </div>
        )}
      </div>

      {/* Features Section */}
      <div className="flex-1">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            Features 
            <Badge variant="secondary" className="rounded-full">{totalFeatures}</Badge>
          </h2>
          {canManage && (
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> Create Feature
            </Button>
          )}
        </div>

        <div className="grid gap-3">
          {features?.map(feature => (
            <div 
              key={feature.id} 
              className="bg-card border rounded-lg p-4 shadow-sm hover:border-primary/50 transition-colors cursor-pointer group flex items-center justify-between"
              onClick={() => router.push(`/workspace/projects/${projectId}/features/${feature.id}`)}
            >
              <div className="flex items-center gap-4">
                <Badge variant="outline" className={`w-28 justify-center ${feature.status === 'Released' ? 'border-success text-success' : ''}`}>
                  {feature.status}
                </Badge>
                <div>
                  <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                    {feature.title}
                  </h4>
                  {feature.description && (
                    <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5 max-w-2xl">
                      {feature.description}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                {/* Assignees Avatars could go here */}
                {feature.feature_members && feature.feature_members.length > 0 && (
                  <div className="flex -space-x-2">
                    {feature.feature_members.slice(0, 3).map((fm: any) => (
                      <div key={fm.id} className="w-8 h-8 rounded-full bg-secondary border-2 border-background flex items-center justify-center text-[10px] font-bold text-secondary-foreground" title={`${fm.members.first_name} ${fm.members.last_name}`}>
                        {fm.members.first_name[0]}{fm.members.last_name[0]}
                      </div>
                    ))}
                    {feature.feature_members.length > 3 && (
                      <div className="w-8 h-8 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                        +{feature.feature_members.length - 3}
                      </div>
                    )}
                  </div>
                )}
                
                <Badge className={getPriorityColor(feature.priority)}>{feature.priority}</Badge>
                <ChevronRight className="w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          ))}

          {features?.length === 0 && (
            <div className="text-center py-12 border border-dashed rounded-xl bg-secondary/20">
              <h3 className="text-lg font-medium text-foreground mb-2">No features yet</h3>
              <p className="text-muted-foreground mb-4">Start breaking down this module into granular engineering features.</p>
              {canManage && (
                <Button variant="outline" onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" /> Create First Feature
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
      
      <CreateFeatureDialog
        projectId={projectId}
        moduleId={moduleId}
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </div>
  );
}
