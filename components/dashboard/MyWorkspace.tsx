'use client';

import { useDashboard } from '@/hooks/useDashboard';
import { StatCard } from '@/components/dashboard/StatCard';
import { AssignedFeatures } from '@/components/dashboard/AssignedFeatures';
import { UpcomingMeetings } from '@/components/dashboard/UpcomingMeetings';
import { PendingDeliverables } from '@/components/dashboard/PendingDeliverables';
import { FolderKanban, FileText, CheckSquare, Video } from 'lucide-react';

export function MyWorkspace() {
  const { data, isLoading, error } = useDashboard();

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1,2,3,4].map(i => <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />)}
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="h-64 col-span-2 bg-muted animate-pulse rounded-xl" />
          <div className="h-64 bg-muted animate-pulse rounded-xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-destructive/10 text-destructive rounded-lg">
        Failed to load workspace data.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Projects"
          value={data?.stats.activeProjects || 0}
          icon={FolderKanban}
          description="Projects you are a member of"
        />
        <StatCard
          title="Assigned Features"
          value={data?.stats.assignedFeatures || 0}
          icon={CheckSquare}
          description="Total features assigned to you"
        />
        <StatCard
          title="Pending Deliverables"
          value={data?.stats.pendingDeliverables || 0}
          icon={FileText}
          description="Awaiting submission or review"
        />
        <StatCard
          title="Upcoming Meetings"
          value={data?.stats.upcomingMeetings || 0}
          icon={Video}
          description="Meetings scheduled for your projects"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Main Content Area */}
        <div className="col-span-1 lg:col-span-2 space-y-6">
          <AssignedFeatures features={data?.assignedFeatures || []} />
        </div>

        {/* Sidebar Area */}
        <div className="col-span-1 space-y-6">
          <UpcomingMeetings meetings={data?.upcomingMeetings || []} />
          <PendingDeliverables deliverables={data?.pendingDeliverables || []} />
        </div>
      </div>
    </div>
  );
}
