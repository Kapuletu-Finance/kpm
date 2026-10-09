'use client';

import { use } from 'react';
import { useProject } from '@/hooks/useProjects';
import { ReportView } from '@/components/reports/ReportView';

export default function ProjectReportsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const { data: project, isLoading } = useProject(projectId);

  if (isLoading) return <div className="h-64 bg-muted/40 rounded-xl animate-pulse" />;
  if (!project?.can_manage) {
    return <div className="p-6 bg-card border rounded-xl text-sm text-muted-foreground">Project reports are available to the project&apos;s managers.</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Project report</h2>
        <p className="text-sm text-muted-foreground">Delivery, contribution and achievements for {project.name}.</p>
      </div>
      <ReportView projectId={projectId} />
    </div>
  );
}
