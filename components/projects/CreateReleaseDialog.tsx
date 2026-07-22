'use client';

import { useState } from 'react';
import { useCreateRelease } from '@/hooks/useReleases';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, Plus, Rocket } from 'lucide-react';
import { toast } from 'sonner';

export function CreateReleaseDialog({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const mutation = useCreateRelease(projectId);

  const [version, setVersion] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!version) return;

    try {
      await mutation.mutateAsync({
        version,
        title,
        release_notes: notes,
      });
      toast.success('Release created successfully');
      setOpen(false);
      setVersion('');
      setTitle('');
      setNotes('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create release');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2">
        <Plus className="w-4 h-4 mr-2" /> New Release
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="w-5 h-5 text-primary" />
            Plan New Release
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Version *</label>
            <Input 
              required 
              value={version} 
              onChange={e => setVersion(e.target.value)} 
              placeholder="e.g., v1.0.0 or 2026-Q3" 
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Title</label>
            <Input 
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              placeholder="e.g., The Alpha Launch" 
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Release Notes Draft</label>
            <Textarea 
              value={notes} 
              onChange={e => setNotes(e.target.value)} 
              placeholder="Brief summary of what this release entails..." 
              className="min-h-[100px]"
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={!version || mutation.isPending}>
              {mutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Release
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
