import { useState } from 'react';
import { useCreateMeeting } from '@/hooks/useMeetings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Calendar as CalendarIcon, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export function CreateMeetingDialog({ projectId, sprintId }: { projectId: string, sprintId?: string }) {
  const [open, setOpen] = useState(false);
  const mutation = useCreateMeeting(projectId);

  const [title, setTitle] = useState('');
  const [objective, setObjective] = useState('');
  const [type, setType] = useState('Online');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState('60'); // minutes
  const [link, setLink] = useState('');
  const [location, setLocation] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !date || !time) return;

    try {
      const start = new Date(`${date}T${time}`);
      const end = new Date(start.getTime() + parseInt(duration) * 60000);

      await mutation.mutateAsync({
        title,
        objective,
        type: type as 'Online' | 'Physical',
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        meeting_link: type === 'Online' ? link : '',
        location: type === 'Physical' ? location : '',
        sprint_id: sprintId || null,
      });
      
      toast.success('Meeting scheduled');
      setOpen(false);
      reset();
    } catch (error) {
      toast.error('Failed to schedule meeting');
    }
  };

  const reset = () => {
    setTitle('');
    setObjective('');
    setType('Online');
    setDate('');
    setTime('');
    setDuration('60');
    setLink('');
    setLocation('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2">
        <Plus className="w-4 h-4 mr-2" /> Schedule Meeting
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Schedule a Meeting</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Title *</label>
            <Input required value={title} onChange={e => setTitle(e.target.value)} placeholder="E.g., Sprint Planning" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Date *</label>
              <div className="relative">
                <CalendarIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input required type="date" className="pl-9" value={date} onChange={e => setDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Time *</label>
              <div className="relative">
                <Clock className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input required type="time" className="pl-9" value={time} onChange={e => setTime(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Type *</label>
              <Select value={type} onValueChange={(val: string | null) => val && setType(val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Meeting Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Online">Online</SelectItem>
                  <SelectItem value="Physical">Physical / In-Person</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {type === 'Online' ? (
              <div className="space-y-2">
                <label className="text-sm font-medium">Meeting Link</label>
                <Input type="url" value={link} onChange={e => setLink(e.target.value)} placeholder="https://meet.google.com/..." />
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-medium">Location</label>
                <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="E.g., Conference Room A" />
              </div>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Duration (mins)</label>
            <Input type="number" value={duration} onChange={e => setDuration(e.target.value)} min="15" step="15" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Objective</label>
            <Textarea value={objective} onChange={e => setObjective(e.target.value)} placeholder="What is the goal of this meeting?" />
          </div>
          
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : 'Schedule'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
