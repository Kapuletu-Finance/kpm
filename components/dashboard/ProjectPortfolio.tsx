'use client';

import { useManagerDashboard } from '@/hooks/useDashboard';
import { StatCard } from '@/components/dashboard/StatCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FolderKanban, AlertCircle, Clock, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export function ProjectPortfolio() {
  const { data, isLoading, error } = useManagerDashboard();

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1,2,3].map(i => <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />)}
        </div>
        <div className="h-64 bg-muted animate-pulse rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-destructive/10 text-destructive rounded-lg">
        Failed to load project portfolio data.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Managed Projects"
          value={data?.stats.managedProjects || 0}
          icon={FolderKanban}
          description="Projects under your supervision"
        />
        <StatCard
          title="Action Needed"
          value={data?.stats.actionNeededFeatures || 0}
          icon={AlertCircle}
          description="Features in review or blocked"
        />
        <StatCard
          title="Pending Reviews"
          value={data?.stats.pendingReviews || 0}
          icon={CheckCircle2}
          description="Deliverables awaiting manager approval"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>My Projects</CardTitle>
            <CardDescription>Status overview of projects you manage</CardDescription>
          </CardHeader>
          <CardContent className="p-0 border-t border-border/50">
            {data?.managedProjects?.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                You are not managing any projects yet.
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {data?.managedProjects?.map((project: any) => (
                  <Link 
                    key={project.id}
                    href={`/workspace/projects/${project.id}`}
                    className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors block"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="font-medium text-sm">{project.name}</span>
                      <Badge variant="outline" className="w-fit text-[10px]">{project.priority}</Badge>
                    </div>
                    <Badge variant="secondary" className="text-xs">{project.status}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Needs Attention</CardTitle>
            <CardDescription>Blocked or In Review Features</CardDescription>
          </CardHeader>
          <CardContent className="p-0 border-t border-border/50">
            {data?.actionNeededFeatures?.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No features currently blocked or in review.
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {data?.actionNeededFeatures?.map((feature: any) => (
                  <Link 
                    key={feature.id}
                    href={`/workspace/projects/${feature.project_id}/features/${feature.id}`}
                    className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors block"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="font-medium text-sm flex items-center gap-2">
                        {feature.status === 'Blocked' ? <AlertCircle className="w-4 h-4 text-destructive" /> : <Clock className="w-4 h-4 text-orange-500" />}
                        {feature.title}
                      </span>
                      <span className="text-xs text-muted-foreground">{feature.project_name}</span>
                    </div>
                    <Badge variant={feature.status === 'Blocked' ? 'destructive' : 'outline'} className="text-[10px]">
                      {feature.status}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
