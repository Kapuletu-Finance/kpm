'use client';

import { useOrgDashboard } from '@/hooks/useDashboard';
import { StatCard } from '@/components/dashboard/StatCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FolderKanban, Users, Mail, Activity } from 'lucide-react';
import { format } from 'date-fns';

export function OrganizationOverview() {
  const { data, isLoading, error } = useOrgDashboard();

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1,2,3,4].map(i => <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />)}
        </div>
        <div className="h-64 bg-muted animate-pulse rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-destructive/10 text-destructive rounded-lg">
        Failed to load organization data.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Projects"
          value={data?.stats.totalProjects || 0}
          icon={FolderKanban}
          description={`${data?.stats.activeProjects || 0} currently active`}
        />
        <StatCard
          title="Active Members"
          value={data?.stats.activeMembers || 0}
          icon={Users}
          description="Total users in organization"
        />
        <StatCard
          title="Pending Invites"
          value={data?.stats.pendingInvites || 0}
          icon={Mail}
          description="Awaiting acceptance"
        />
        <StatCard
          title="System Status"
          value="Healthy"
          icon={Activity}
          description="All core modules operational"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organization Portfolio</CardTitle>
          <CardDescription>All projects currently managed under this organization</CardDescription>
        </CardHeader>
        <CardContent>
          {data?.projects?.length === 0 ? (
            <div className="flex justify-center items-center h-32 text-muted-foreground border-t border-border/50">
              No projects created yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-y border-border">
                  <tr>
                    <th className="px-4 py-3 font-medium">Project Name</th>
                    <th className="px-4 py-3 font-medium">Manager</th>
                    <th className="px-4 py-3 font-medium">Priority</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium text-right">Target Completion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {data?.projects?.map((project: any) => (
                    <tr key={project.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{project.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{project.manager_name}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-[10px]">{project.priority}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className="text-[10px]">{project.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground text-xs">
                        {project.end_date ? format(new Date(project.end_date), 'MMM d, yyyy') : 'No date set'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
