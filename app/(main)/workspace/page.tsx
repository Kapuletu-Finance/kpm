'use client';

import { useOrganization, useMembers } from '@/hooks/useOrganization';
import { useAuth } from '@/store/AuthContext';
import { StatCard } from '@/components/dashboard/StatCard';
import { FolderKanban, Users, AlertCircle, IterationCcw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function WorkspaceDashboard() {
  const { memberProfile } = useAuth();
  const { data: organization, isLoading: isLoadingOrg } = useOrganization();
  const { data: members, isLoading: isLoadingMembers } = useMembers();

  if (isLoadingOrg || isLoadingMembers) {
    return <div className="animate-pulse space-y-6">
      <div className="h-8 bg-muted rounded w-1/4"></div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1,2,3,4].map(i => <div key={i} className="h-32 bg-muted rounded-xl"></div>)}
      </div>
    </div>;
  }

  const activeMembers = members?.filter((m: any) => m.status === 'Active')?.length || 0;
  const pendingInvites = members?.filter((m: any) => m.status === 'Invited')?.length || 0;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">
          {organization?.name || 'Workspace'}
        </h2>
        <p className="text-muted-foreground mt-2">
          Welcome back, {memberProfile?.first_name}. Here is an overview of your organization.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Projects"
          value="0"
          icon={FolderKanban}
          description="Projects setup in upcoming modules"
        />
        <StatCard
          title="Active Sprints"
          value="0"
          icon={IterationCcw}
          description="Across all projects"
        />
        <StatCard
          title="Team Members"
          value={activeMembers}
          icon={Users}
          description="Active members in workspace"
          trend={{ value: 12, isPositive: true }}
        />
        <StatCard
          title="Pending Invites"
          value={pendingInvites}
          icon={AlertCircle}
          description="Awaiting email verification"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              Activity timeline will be integrated in Module 18.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center border-t border-border/50 bg-muted/10">
            <p className="text-sm text-muted-foreground">No recent activity found.</p>
          </CardContent>
        </Card>
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Organization Pulse</CardTitle>
            <CardDescription>
              System health and active modules.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] flex flex-col justify-center gap-4 border-t border-border/50 bg-muted/10 p-6">
            <div className="flex items-center gap-4">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <div className="text-sm font-medium">Authentication Module (Active)</div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <div className="text-sm font-medium">Organization Module (Active)</div>
            </div>
            <div className="flex items-center gap-4 opacity-40">
              <div className="w-2 h-2 rounded-full bg-muted-foreground" />
              <div className="text-sm font-medium">Projects Module (Pending)</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
