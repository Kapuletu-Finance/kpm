'use client';

import { use } from 'react';
import Link from 'next/link';
import { useMeetings } from '@/hooks/useMeetings';
import { useAuth } from '@/store/AuthContext';
import { useProjectTeam } from '@/hooks/useProjectTeam';
import { CreateMeetingDialog } from '@/components/projects/CreateMeetingDialog';
import { Calendar, Clock, Video, Users, AlertCircle, MapPin } from 'lucide-react';
import { format, isPast, isFuture } from 'date-fns';

export default function MeetingsHubPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const { memberProfile } = useAuth();
  const { data: teamMembers } = useProjectTeam(projectId);
  const { data: meetings, isLoading } = useMeetings(projectId);

  const role = teamMembers?.find((m: any) => m.member_id === memberProfile?.id)?.project_role;
  const isGlobalAdmin = memberProfile?.organization_role === 'Organization Admin';
  const canManage = isGlobalAdmin || role === 'Project Manager';

  if (isLoading) {
    return <div className="p-6 animate-pulse">Loading meetings...</div>;
  }

  const upcoming = meetings?.filter(m => isFuture(new Date(m.start_time))) || [];
  const past = meetings?.filter(m => isPast(new Date(m.start_time))) || [];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Meetings</h1>
          <p className="text-muted-foreground">Schedule and manage team syncs</p>
        </div>
        {canManage && <CreateMeetingDialog projectId={projectId} />}
      </div>

      <div className="space-y-8">
        {/* Upcoming Meetings */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Upcoming
          </h2>
          
          {upcoming.length === 0 ? (
            <div className="bg-muted/50 border rounded-xl p-8 text-center text-muted-foreground flex flex-col items-center">
              <Calendar className="w-12 h-12 mb-4 text-muted-foreground/50" />
              <p>No upcoming meetings scheduled.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {upcoming.map(meeting => (
                <MeetingCard key={meeting.id} projectId={projectId} meeting={meeting} />
              ))}
            </div>
          )}
        </section>

        {/* Past Meetings */}
        <section className="space-y-4 pt-8 border-t">
          <h2 className="text-xl font-semibold flex items-center gap-2 text-muted-foreground">
            <Clock className="w-5 h-5" />
            Past Meetings
          </h2>
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 opacity-80">
            {past.map(meeting => (
              <MeetingCard key={meeting.id} projectId={projectId} meeting={meeting} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function MeetingCard({ projectId, meeting }: { projectId: string, meeting: any }) {
  return (
    <Link href={`/workspace/projects/${projectId}/meetings/${meeting.id}`}>
      <div className="bg-card border rounded-xl p-5 hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer h-full flex flex-col group">
        <div className="flex justify-between items-start mb-4">
          <h3 className="font-semibold text-lg line-clamp-1 group-hover:text-primary transition-colors">{meeting.title}</h3>
        </div>
        
        <div className="space-y-2 text-sm text-muted-foreground mb-6 flex-1">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span>{format(new Date(meeting.start_time), 'MMM d, yyyy')}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            <span>{format(new Date(meeting.start_time), 'h:mm a')}</span>
          </div>
          {meeting.type === 'Online' && meeting.meeting_link && (
            <div className="flex items-center gap-2 text-primary/80">
              <Video className="w-4 h-4 shrink-0" />
              <span className="truncate">{meeting.meeting_link.replace('https://', '')}</span>
            </div>
          )}
          {meeting.type === 'Physical' && meeting.location && (
            <div className="flex items-center gap-2 text-orange-500/80">
              <MapPin className="w-4 h-4 shrink-0" />
              <span className="truncate">{meeting.location}</span>
            </div>
          )}
        </div>

        {meeting.objective && (
          <div className="text-sm bg-muted/50 p-2 rounded border line-clamp-2">
            {meeting.objective}
          </div>
        )}
      </div>
    </Link>
  );
}
