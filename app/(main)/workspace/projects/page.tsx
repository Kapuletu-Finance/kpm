'use client';

import { useState } from 'react';
import { useProjects, useUpdateProject } from '@/hooks/useProjects';
import { useAuth } from '@/store/AuthContext';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { Button } from '@/components/ui/button';
import { Plus, Loader2 } from 'lucide-react';
import { CreateProjectDialog } from '@/components/projects/CreateProjectDialog';
import { EditProjectDialog } from '@/components/projects/EditProjectDialog';
import { toast } from 'sonner';

export default function ProjectsPage() {
  const { data: projects, isLoading } = useProjects();
  const { memberProfile } = useAuth();
  const updateMutation = useUpdateProject();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<any | null>(null);

  const canCreateProject =
    memberProfile?.organization_role === 'Organization Admin' ||
    memberProfile?.organization_role === 'Project Manager';

  // A user can manage a project if they are the Org Admin or the assigned PM
  const canManageProject = (project: any) =>
    memberProfile?.organization_role === 'Organization Admin' ||
    project.project_manager_id === memberProfile?.id;

  const handlePublish = (project: any) => {
    updateMutation.mutate(
      { id: project.id, status: 'Active' },
      {
        onSuccess: () => toast.success(`${project.name} is now live`),
        onError: (err: any) => toast.error(err.message || 'Failed to publish project'),
      }
    );
  };

  const handleHold = (project: any) => {
    updateMutation.mutate(
      { id: project.id, status: 'On Hold' },
      {
        onSuccess: () => toast.success(`${project.name} has been put on hold`),
        onError: (err: any) => toast.error(err.message || 'Failed to update project'),
      }
    );
  };

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
            <ProjectCard
              key={project.id}
              project={project}
              canManage={canManageProject(project)}
              onEdit={(p) => setEditingProject(p)}
              onPublish={handlePublish}
              onHold={handleHold}
            />
          ))}
        </div>
      )}

      {/* Create dialog */}
      {canCreateProject && (
        <CreateProjectDialog
          open={isCreateOpen}
          onOpenChange={setIsCreateOpen}
        />
      )}

      {/* Edit dialog — renders only when a project is selected for editing */}
      {editingProject && (
        <EditProjectDialog
          project={editingProject}
          open={!!editingProject}
          onOpenChange={(open) => {
            if (!open) setEditingProject(null);
          }}
        />
      )}
    </div>
  );
}
