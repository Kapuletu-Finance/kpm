  'use client';

import { use } from 'react';
import Link from 'next/link';
import { useReleases } from '@/hooks/useReleases';
import { useAuth } from '@/store/AuthContext';
import { useProjectTeam } from '@/hooks/useProjectTeam';
import { CreateReleaseDialog } from '@/components/projects/CreateReleaseDialog';
import { Rocket, Package, Calendar, Activity, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

export default function ReleasesHubPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const { memberProfile } = useAuth();
  const { data: teamMembers } = useProjectTeam(projectId);
  const { data: releases, isLoading } = useReleases(projectId);

  const role = teamMembers?.find((m: any) => m.member_id === memberProfile?.id)?.project_role;
  const isGlobalAdmin = memberProfile?.organization_role === 'Organization Admin';
  const canManage = isGlobalAdmin || role === 'Project Manager';

  if (isLoading) {
    return <div className="p-6 animate-pulse">Loading Releases...</div>;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Planned': return 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border-blue-500/20';
      case 'Staging': return 'bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 border-orange-500/20';
      case 'Released': return 'bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/20';
      case 'Rolled Back': return 'bg-red-500/10 text-red-500 hover:bg-red-500/20 border-red-500/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Releases</h1>
          <p className="text-muted-foreground max-w-2xl">
            Group completed features into deployable versions and track their rollout status.
          </p>
        </div>
        {canManage && <CreateReleaseDialog projectId={projectId} />}
      </div>

      {releases?.length === 0 ? (
        <div className="border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center text-center">
          <div className="bg-primary/10 p-4 rounded-full mb-4">
            <Rocket className="w-12 h-12 text-primary" />
          </div>
          <h2 className="text-xl font-bold mb-2">No Releases Planned</h2>
          <p className="text-muted-foreground mb-6 max-w-md">
            Start planning your first major rollout by grouping features into a deployable version.
          </p>
          {canManage && <CreateReleaseDialog projectId={projectId} />}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {releases?.map((release) => (
            <Link key={release.id} href={`/workspace/projects/${projectId}/releases/${release.id}`}>
              <div className="bg-card border rounded-xl p-5 hover:shadow-md transition-all hover:border-primary/50 group h-full flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 p-2.5 rounded-lg text-primary">
                      <Package className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{release.version}</h3>
                      {release.title && <p className="text-sm text-muted-foreground">{release.title}</p>}
                    </div>
                  </div>
                  <Badge variant="outline" className={getStatusColor(release.status)}>
                    {release.status}
                  </Badge>
                </div>
                
                {release.release_notes && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4 flex-1">
                    {release.release_notes}
                  </p>
                )}

                <div className="mt-auto pt-4 border-t flex items-center justify-between text-sm">
                  <div className="flex items-center gap-4 text-muted-foreground">
                    <div className="flex items-center gap-1.5" title="Features included">
                      <Activity className="w-4 h-4" />
                      <span>{release.features?.length || 0} features</span>
                    </div>
                    {release.release_date && (
                      <div className="flex items-center gap-1.5" title="Release Date">
                        <Calendar className="w-4 h-4" />
                        <span>{format(new Date(release.release_date), 'MMM d, yy')}</span>
                      </div>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
