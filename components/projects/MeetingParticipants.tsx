import { useState } from 'react';
import { useMeetingParticipants, useAddMeetingParticipant, useRemoveMeetingParticipant } from '@/hooks/useMeetings';
import { useProjectTeam } from '@/hooks/useProjectTeam';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Trash2, Plus, Users, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function MeetingParticipants({ projectId, meetingId, canManage }: { projectId: string, meetingId: string, canManage: boolean }) {
  const { data: participants, isLoading } = useMeetingParticipants(projectId, meetingId);
  const { data: teamMembers } = useProjectTeam(projectId);
  const addMutation = useAddMeetingParticipant(projectId, meetingId);
  const removeMutation = useRemoveMeetingParticipant(projectId, meetingId);

  const [selectedMember, setSelectedMember] = useState<string>('');

  const handleAdd = async () => {
    if (!selectedMember) return;
    try {
      await addMutation.mutateAsync(selectedMember);
      setSelectedMember('');
      toast.success('Participant added');
    } catch (err) {
      toast.error('Failed to add participant');
    }
  };

  const handleRemove = async (memberId: string) => {
    try {
      await removeMutation.mutateAsync(memberId);
      toast.success('Participant removed');
    } catch (err) {
      toast.error('Failed to remove participant');
    }
  };

  const availableMembers = teamMembers?.filter((tm: any) => !participants?.some(p => p.member_id === tm.member_id)) || [];

  if (isLoading) return <div className="animate-pulse h-24 bg-muted rounded-xl"></div>;

  return (
    <div className="bg-card border rounded-xl shadow-sm overflow-hidden flex flex-col">
      <div className="p-4 border-b bg-muted/20">
        <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground flex items-center justify-between">
          Participants
          <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-xs">
            {participants?.length || 0}
          </span>
        </h3>
      </div>
      
      <div className="p-4 max-h-[300px] overflow-y-auto space-y-3">
        {participants?.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-2">No participants yet.</p>
        ) : (
          participants?.map(p => (
            <div key={p.member_id} className="flex items-center justify-between group">
              <div className="flex items-center gap-3">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={p.members.avatar_url || ''} />
                  <AvatarFallback>{p.members.first_name[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium leading-none">{p.members.first_name} {p.members.last_name}</p>
                  <p className="text-xs text-muted-foreground truncate max-w-[150px]">{p.members.email}</p>
                </div>
              </div>
              {canManage && (
                <button onClick={() => handleRemove(p.member_id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {canManage && availableMembers.length > 0 && (
        <div className="p-4 border-t bg-muted/10 flex gap-2">
          <Select value={selectedMember} onValueChange={(val: string | null) => val && setSelectedMember(val)}>
            <SelectTrigger className="h-9 flex-1 bg-background text-sm">
              <SelectValue placeholder="Add someone..." />
            </SelectTrigger>
            <SelectContent>
              {availableMembers.map((m: any) => (
                <SelectItem key={m.id} value={m.member_id}>
                  {m.members?.first_name} {m.members?.last_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="icon" className="h-9 w-9 shrink-0" onClick={handleAdd} disabled={!selectedMember || addMutation.isPending}>
            {addMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          </Button>
        </div>
      )}
    </div>
  );
}
