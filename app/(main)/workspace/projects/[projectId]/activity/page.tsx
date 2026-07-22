'use client';

import { use } from 'react';
import { useProjectActivity } from '@/hooks/useActivity';
import { ActivityTimeline } from '@/components/projects/ActivityTimeline';
import { Loader2 } from 'lucide-react';

export default function ProjectActivityPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const { data, isLoading, error } = useProjectActivity(projectId);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-destructive/10 text-destructive rounded-lg">
        Failed to load activity logs: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Project Activity</h2>
        <p className="text-muted-foreground">
          Audit trail of all actions within this project.
        </p>
      </div>

      <div className="bg-background rounded-xl border p-6">
        <ActivityTimeline logs={data?.data || []} />
      </div>
    </div>
  );
}
