'use client';

import { use } from 'react';
import { useProject } from '@/hooks/useProjects';
import { useAuth } from '@/store/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Settings2, FileText, Link2, AlertTriangle } from 'lucide-react';
import { GeneralSettingsForm } from '@/components/projects/settings/GeneralSettingsForm';
import { DefinitionSettingsForm } from '@/components/projects/settings/DefinitionSettingsForm';
import { IntegrationsSettingsForm } from '@/components/projects/settings/IntegrationsSettingsForm';
import { DangerZone } from '@/components/projects/settings/DangerZone';

export default function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const { data: project, isLoading, error } = useProject(projectId);
  const { memberProfile } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="p-6 bg-destructive/10 text-destructive rounded-lg">
        Failed to load project settings.
      </div>
    );
  }

  // Only Org Admins or the assigned Project Manager can see settings
  const canManageSettings = 
    memberProfile?.organization_role === 'Organization Admin' || 
    project.project_manager_id === memberProfile?.id;

  if (!canManageSettings) {
    return (
      <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-border rounded-xl bg-muted/10">
        <AlertTriangle className="h-10 w-10 text-muted-foreground mb-4" />
        <h3 className="text-xl font-semibold mb-2">Access Denied</h3>
        <p className="text-muted-foreground text-center max-w-md">
          Only Organization Admins and the designated Project Manager can modify project settings.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Project Settings</h2>
        <p className="text-muted-foreground">
          Manage configuration, integrations, and lifecycle for {project.name}.
        </p>
      </div>

      <Tabs defaultValue="general" className="w-full space-y-6">
        <TabsList className="bg-muted border border-border/50 grid w-full grid-cols-4 md:w-fit md:flex">
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Settings2 className="w-4 h-4" />
            <span className="hidden sm:inline">General</span>
          </TabsTrigger>
          <TabsTrigger value="definition" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Definition</span>
          </TabsTrigger>
          <TabsTrigger value="integrations" className="flex items-center gap-2">
            <Link2 className="w-4 h-4" />
            <span className="hidden sm:inline">Integrations</span>
          </TabsTrigger>
          <TabsTrigger value="danger" className="flex items-center gap-2 text-destructive data-[state=active]:text-destructive">
            <AlertTriangle className="w-4 h-4" />
            <span className="hidden sm:inline">Danger Zone</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-0 outline-none">
          <GeneralSettingsForm project={project} />
        </TabsContent>

        <TabsContent value="definition" className="mt-0 outline-none">
          <DefinitionSettingsForm project={project} />
        </TabsContent>

        <TabsContent value="integrations" className="mt-0 outline-none">
          <IntegrationsSettingsForm project={project} />
        </TabsContent>

        <TabsContent value="danger" className="mt-0 outline-none">
          <DangerZone project={project} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
