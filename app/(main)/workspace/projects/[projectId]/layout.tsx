'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { use } from 'react';
import Link from 'next/link';
import { useProject, useUpdateProject } from '@/hooks/useProjects';
import { useAuth } from '@/store/AuthContext';
import { Loader2, ArrowLeft, Map, Users, Route, Settings2, Timer, MessageSquare, Video, FolderOpen, Rocket, Activity, Pencil, PauseCircle } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EditProjectDialog } from '@/components/projects/EditProjectDialog';
import { toast } from 'sonner';

export default function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const pathname = usePathname();
  const { projectId } = use(params);
  const { data: project, isLoading, error } = useProject(projectId);
  const { memberProfile } = useAuth();
  const updateMutation = useUpdateProject();

  const [isEditOpen, setIsEditOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center gap-4">
        <h2 className="text-2xl font-bold">Project Not Found</h2>
        <p className="text-muted-foreground">You may not have access to this project.</p>
        <Link href="/workspace/projects" className={buttonVariants({ variant: "outline" })}>
          Back to Projects
        </Link>
      </div>
    );
  }

  const isManagerOrAdmin =
    memberProfile?.organization_role === 'Organization Admin' ||
    project.project_manager_id === memberProfile?.id;

  // Lifecycle actions available based on current status
  const canPublish = isManagerOrAdmin && (project.status === 'Draft' || project.status === 'Planning');
  const canPutOnHold = isManagerOrAdmin && project.status === 'Active';
  const canReactivate = isManagerOrAdmin && project.status === 'On Hold';

  const handlePublish = () => {
    updateMutation.mutate(
      { id: project.id, status: 'Active' },
      {
        onSuccess: () => toast.success(`${project.name} is now live`),
        onError: (err: any) => toast.error(err.message || 'Failed to publish project'),
      }
    );
  };

  const handleHold = () => {
    updateMutation.mutate(
      { id: project.id, status: 'On Hold' },
      {
        onSuccess: () => toast.success(`${project.name} has been put on hold`),
        onError: (err: any) => toast.error(err.message || 'Failed to update project'),
      }
    );
  };

  const tabs = [
    { name: 'Overview', href: `/workspace/projects/${project.id}`, icon: Map },
    { name: 'Sprints', href: `/workspace/projects/${project.id}/sprints`, icon: Timer },
    { name: 'Roadmap', href: `/workspace/projects/${project.id}/roadmap`, icon: Route },
    { name: 'Standups', href: `/workspace/projects/${project.id}/standups`, icon: MessageSquare },
    { name: 'Meetings', href: `/workspace/projects/${project.id}/meetings`, icon: Video },
    { name: 'Documents', href: `/workspace/projects/${project.id}/documents`, icon: FolderOpen },
    { name: 'Releases', href: `/workspace/projects/${project.id}/releases`, icon: Rocket },
    { name: 'Activity', href: `/workspace/projects/${project.id}/activity`, icon: Activity },
    { name: 'Team', href: `/workspace/projects/${project.id}/team`, icon: Users },
  ];

  if (isManagerOrAdmin) {
    tabs.push({ name: 'Settings', href: `/workspace/projects/${project.id}/settings`, icon: Settings2 });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
        <Link href="/workspace/projects" className="hover:text-foreground flex items-center gap-1 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Projects
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">{project.name}</span>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
              {project.status}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-2 max-w-3xl">
            {project.description}
          </p>
        </div>

        {/* Manager / Admin action buttons */}
        {isManagerOrAdmin && (
          <div className="flex flex-wrap items-center gap-2 shrink-0 w-full md:w-auto">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setIsEditOpen(true)}
            >
              <Pencil className="w-4 h-4" />
              Edit
            </Button>

            {canPublish && (
              <Button
                size="sm"
                className="gap-2"
                disabled={updateMutation.isPending}
                onClick={handlePublish}
              >
                {updateMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Rocket className="w-4 h-4" />
                )}
                Publish Project
              </Button>
            )}

            {canPutOnHold && (
              <Button
                variant="secondary"
                size="sm"
                className="gap-2"
                disabled={updateMutation.isPending}
                onClick={handleHold}
              >
                {updateMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <PauseCircle className="w-4 h-4" />
                )}
                Put on Hold
              </Button>
            )}

            {canReactivate && (
              <Button
                size="sm"
                className="gap-2"
                disabled={updateMutation.isPending}
                onClick={handlePublish}
              >
                {updateMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Rocket className="w-4 h-4" />
                )}
                Reactivate
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="border-b border-border">
        <nav className="-mb-px flex space-x-4 md:space-x-8 overflow-x-auto pb-1 scrollbar-thin" aria-label="Tabs">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href;
            const Icon = tab.icon;
            return (
              <Link
                key={tab.name}
                href={tab.href}
                className={`
                  whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors
                  ${isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                {tab.name}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="py-4">
        {children}
      </div>

      {/* Edit dialog mounted at layout level so it works across all sub-pages */}
      {isEditOpen && (
        <EditProjectDialog
          project={project}
          open={isEditOpen}
          onOpenChange={setIsEditOpen}
        />
      )}
    </div>
  );
}
