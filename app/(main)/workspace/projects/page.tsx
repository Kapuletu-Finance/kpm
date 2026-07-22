'use client';

import { useProjects } from '@/hooks/useProjects';
import { useAuth } from '@/store/AuthContext';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { Button } from '@/components/ui/button';
import { Plus, Loader2 } from 'lucide-react';
import { CreateProjectDialog } from '@/components/projects/CreateProjectDialog';
import { useState } from 'react';

export default function ProjectsPage() {
  const { data: projects, isLoading } = useProjects();
  const { memberProfile } = useAuth();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const canCreateProject = 
    memberProfile?.organization_role === 'Organization Admin' || 
    memberProfile?.organization_role === 'Project Manager';

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            {memberProfile?.organization_role === 'Organization Admin' ? 'All Projects' : 'My Projects'}
          </h2>
          <p className="text-muted-foreground mt-2">
            {memberProfile?.organization_role === 'Organization Admin' 
              ? 'Manage all projects across the organization.' 
              : 'Projects you are actively assigned to.'}
          </p>
        </div>
        
        {canCreateProject && (
          <Button onClick={() => setIsCreateOpen(true)} className="shrink-0 gap-2">
            <Plus className="w-4 h-4" />
            New Project
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : projects?.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-border rounded-xl bg-muted/10">
          <h3 className="text-xl font-semibold mb-2">No projects found</h3>
          <p className="text-muted-foreground mb-6 text-center max-w-md">
            {canCreateProject 
              ? "You haven't created any projects yet. Start by creating your first project to organize your team's work."
              : "You haven't been assigned to any projects yet. An admin or project manager will invite you when a project is ready."}
          </p>
          {canCreateProject && (
            <Button onClick={() => setIsCreateOpen(true)} variant="outline">
              Create your first project
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {projects?.map((project: any) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}

      {canCreateProject && (
        <CreateProjectDialog 
          open={isCreateOpen} 
          onOpenChange={setIsCreateOpen} 
        />
      )}
    </div>
  );
}
