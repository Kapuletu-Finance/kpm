'use client';

import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMeeting, useUpdateMeeting, useDeleteMeeting } from '@/hooks/useMeetings';
import { useAuth } from '@/store/AuthContext';
import { useProjectTeam } from '@/hooks/useProjectTeam';
import { MeetingActionItems } from '@/components/projects/MeetingActionItems';
import { MeetingParticipants } from '@/components/projects/MeetingParticipants';
import { CommentsSection } from '@/components/projects/CommentsSection';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Calendar, Clock, Video, FileText, CheckSquare, Save, Loader2, Trash2, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function MeetingWorkspacePage({ params }: { params: Promise<{ projectId: string, meetingId: string }> }) {
  const { projectId, meetingId } = use(params);
  const router = useRouter();
  const { memberProfile } = useAuth();
  const { data: teamMembers } = useProjectTeam(projectId);
  const { data: meeting, isLoading } = useMeeting(projectId, meetingId);
  const updateMutation = useUpdateMeeting(projectId, meetingId);
  const deleteMutation = useDeleteMeeting(projectId);

  const [minutes, setMinutes] = useState('');
  const [decisions, setDecisions] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (meeting) {
      setMinutes(meeting.minutes || '');
      setDecisions(meeting.decisions || '');
    }
  }, [meeting]);

  const role = teamMembers?.find((m: any) => m.member_id === memberProfile?.id)?.project_role;
  const isGlobalAdmin = memberProfile?.organization_role === 'Organization Admin';
  const canManage = isGlobalAdmin || role === 'Project Manager' || meeting?.created_by === memberProfile?.id;

  const handleSaveNotes = async () => {
    setIsSaving(true);
    try {
      await updateMutation.mutateAsync({ minutes, decisions });
      toast.success('Notes saved successfully');
    } catch (err) {
      toast.error('Failed to save notes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this meeting? This will delete all action items and notes forever.')) return;
    try {
      await deleteMutation.mutateAsync(meetingId);
      toast.success('Meeting deleted');
      router.push(`/workspace/projects/${projectId}/meetings`);
    } catch (err) {
      toast.error('Failed to delete meeting');
    }
  };

  if (isLoading || !meeting) {
    return <div className="p-6 animate-pulse">Loading workspace...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 border-b pb-4">
        <Link href={`/workspace/projects/${projectId}/meetings`}>
          <Button variant="ghost" size="icon" className="shrink-0"><ArrowLeft className="w-5 h-5" /></Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{meeting.title}</h1>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
            <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> {format(new Date(meeting.start_time), 'EEEE, MMM d, yyyy')}</span>
            <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> {format(new Date(meeting.start_time), 'h:mm a')} - {format(new Date(meeting.end_time), 'h:mm a')}</span>
            {meeting.type === 'Online' && meeting.meeting_link && (
              <a href={meeting.meeting_link} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-primary hover:underline">
                <Video className="w-4 h-4" /> Join Call
              </a>
            )}
            {meeting.type === 'Physical' && meeting.location && (
              <span className="flex items-center gap-1.5 text-orange-500">
                <MapPin className="w-4 h-4" /> {meeting.location}
              </span>
            )}
          </div>
        </div>
        {canManage && (
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            <Trash2 className="w-4 h-4 mr-2" /> Delete
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Workspace */}
        <div className="lg:col-span-2 space-y-8">
          
          {meeting.objective && (
            <section className="bg-muted/30 p-5 rounded-xl border">
              <h3 className="font-semibold mb-2">Objective</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{meeting.objective}</p>
            </section>
          )}
          
          <section className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" /> Meeting Minutes
              </h2>
              {canManage && (
                <Button size="sm" variant="outline" onClick={handleSaveNotes} disabled={isSaving}>
                  {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Save Notes
                </Button>
              )}
            </div>
            
            <div className="grid gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Discussion Notes</label>
                <Textarea 
                  value={minutes} 
                  onChange={e => setMinutes(e.target.value)} 
                  placeholder="Take live notes here..." 
                  className="min-h-[200px] font-mono text-sm leading-relaxed"
                  disabled={!canManage}
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Formal Decisions</label>
                <Textarea 
                  value={decisions} 
                  onChange={e => setDecisions(e.target.value)} 
                  placeholder="Record definitive decisions made..." 
                  className="min-h-[120px] font-mono text-sm bg-primary/5 border-primary/20"
                  disabled={!canManage}
                />
              </div>
            </div>
          </section>

          <hr />
          
          <section>
            <CommentsSection projectId={projectId} entityType="Meeting" entityId={meetingId} canManage={canManage} />
          </section>

        </div>

        {/* Right Column: Meta */}
        <div className="space-y-6">
          <MeetingParticipants projectId={projectId} meetingId={meetingId} canManage={canManage} />
          <MeetingActionItems projectId={projectId} meetingId={meetingId} canManage={canManage} />
        </div>
      </div>
    </div>
  );
}
