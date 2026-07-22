'use client';

import { DashboardMeeting } from '@/hooks/useDashboard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import Link from 'next/link';
import { Video, Calendar } from 'lucide-react';

export function UpcomingMeetings({ meetings }: { meetings: DashboardMeeting[] }) {
  if (!meetings || meetings.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Upcoming Meetings</CardTitle>
          <CardDescription>Scheduled project meetings</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center h-48 border-t border-border/50 bg-muted/10">
          <Calendar className="w-8 h-8 text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">No upcoming meetings.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Upcoming Meetings</CardTitle>
        <CardDescription>Scheduled project meetings</CardDescription>
      </CardHeader>
      <CardContent className="p-0 border-t border-border/50">
        <div className="divide-y divide-border/50">
          {meetings.map(meeting => (
            <Link 
              key={meeting.id} 
              href={`/workspace/projects/${meeting.project_id}/meetings`}
              className="block hover:bg-muted/30 transition-colors p-4"
            >
              <div className="flex justify-between items-start gap-4">
                <div className="flex gap-3">
                  <div className="bg-primary/10 w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0">
                    <Video className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-medium text-sm text-foreground">{meeting.title}</span>
                    <span className="text-xs text-muted-foreground">{meeting.project_name}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end whitespace-nowrap">
                  <span className="text-sm font-medium text-foreground">
                    {format(new Date(`${meeting.date}T${meeting.start_time}`), 'h:mm a')}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(meeting.date), 'MMM d, yyyy')}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
