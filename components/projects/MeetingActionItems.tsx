import { useState } from 'react';
import { useMeetingActionItems, useCreateActionItem, useUpdateActionItem, useDeleteActionItem } from '@/hooks/useMeetings';
import { useProjectTeam } from '@/hooks/useProjectTeam';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Trash2, Plus, Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function MeetingActionItems({ projectId, meetingId, canManage }: { projectId: string, meetingId: string, canManage: boolean }) {
  const { data: actionItems, isLoading } = useMeetingActionItems(projectId, meetingId);
  const { data: teamMembers } = useProjectTeam(projectId);
  const createMutation = useCreateActionItem(projectId, meetingId);
  const updateMutation = useUpdateActionItem(projectId, meetingId);
  const deleteMutation = useDeleteActionItem(projectId, meetingId);

  const [newTask, setNewTask] = useState('');
  const [newAssignee, setNewAssignee] = useState<string>('none');
  const [newDate, setNewDate] = useState('');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.trim()) return;
    try {
      await createMutation.mutateAsync({
        description: newTask,
        assigned_to: newAssignee === 'none' ? null : newAssignee,
        due_date: newDate || null,
        status: 'Pending'
      });
      setNewTask('');
      setNewAssignee('none');
      setNewDate('');
      toast.success('Action item added');
    } catch (err) {
      toast.error('Failed to add action item');
    }
  };

  const handleToggleStatus = async (item: any) => {
    const newStatus = item.status === 'Completed' ? 'Pending' : 'Completed';
    try {
      await updateMutation.mutateAsync({ id: item.id, status: newStatus });
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this action item?')) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast.success('Deleted');
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  if (isLoading) return <div className="animate-pulse h-32 bg-muted rounded-xl"></div>;

  return (
    <div className="bg-card border rounded-xl shadow-sm overflow-hidden flex flex-col max-h-[500px]">
      <div className="p-4 border-b bg-muted/20">
        <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground flex items-center justify-between">
          Action Items
          <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-xs">
            {actionItems?.filter(a => a.status === 'Completed').length || 0} / {actionItems?.length || 0}
          </span>
        </h3>
      </div>
      
      <div className="p-4 overflow-y-auto flex-1 space-y-3">
        {actionItems?.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-4">No action items assigned yet.</p>
        ) : (
          actionItems?.map(item => (
            <div key={item.id} className="flex items-start gap-3 p-3 border rounded-lg hover:border-primary/50 transition-colors group">
              <Checkbox 
                checked={item.status === 'Completed'} 
                onCheckedChange={() => handleToggleStatus(item)}
                className="mt-1 text-primary"
              />
              <div className="flex-1 space-y-2">
                <p className={`text-sm ${item.status === 'Completed' ? 'line-through text-muted-foreground' : 'text-foreground font-medium'}`}>
                  {item.description}
                </p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    {item.members ? (
                      <div className="flex items-center gap-1.5 bg-muted px-2 py-1 rounded-full">
                        <Avatar className="w-4 h-4">
                          <AvatarImage src={item.members.avatar_url || ''} />
                          <AvatarFallback>{item.members.first_name[0]}</AvatarFallback>
                        </Avatar>
                        <span>{item.members.first_name} {item.members.last_name}</span>
                      </div>
                    ) : (
                      <span className="bg-muted px-2 py-1 rounded-full text-[10px] uppercase">Unassigned</span>
                    )}
                    {item.due_date && (
                      <span className="flex items-center text-destructive">
                        <CalendarIcon className="w-3 h-3 mr-1" /> {item.due_date}
                      </span>
                    )}
                  </div>
                  {canManage && (
                    <button onClick={() => handleDelete(item.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive/80">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {canManage && (
        <form onSubmit={handleAdd} className="p-4 border-t bg-muted/10 space-y-3">
          <Input 
            placeholder="New action item..." 
            value={newTask}
            onChange={e => setNewTask(e.target.value)}
            className="text-sm bg-background"
          />
          <div className="grid grid-cols-2 gap-2">
            <Select value={newAssignee} onValueChange={(val: string | null) => val && setNewAssignee(val)}>
              <SelectTrigger className="h-8 text-xs bg-background">
                <SelectValue placeholder="Assignee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {teamMembers?.map((member: any) => (
                  <SelectItem key={member.id} value={member.member_id}>
                    {member.members?.first_name} {member.members?.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input 
              type="date" 
              className="h-8 text-xs bg-background"
              value={newDate}
              onChange={e => setNewDate(e.target.value)}
            />
          </div>
          <Button type="submit" size="sm" className="w-full" disabled={!newTask.trim() || createMutation.isPending}>
            {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 mr-2" /> Add Item</>}
          </Button>
        </form>
      )}
    </div>
  );
}
