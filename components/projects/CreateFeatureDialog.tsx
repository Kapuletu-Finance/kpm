import { useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { z } from 'zod';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCreateFeature } from '@/hooks/useFeatures';
import { toast } from 'sonner';

const featureSchema = z.object({
  title: z.string().min(1, 'Feature title is required'),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']),
  status: z.enum(['Idea', 'Requirements', 'Design', 'Development', 'Integration', 'Testing', 'Approval', 'Released']),
});

type FeatureFormValues = z.infer<typeof featureSchema>;

interface CreateFeatureDialogProps {
  projectId: string;
  moduleId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateFeatureDialog({
  projectId,
  moduleId,
  open,
  onOpenChange,
}: CreateFeatureDialogProps) {
  const createMutation = useCreateFeature(projectId, moduleId);

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<FeatureFormValues>({
    resolver: zodResolver(featureSchema),
    defaultValues: {
      title: '',
      priority: 'Medium',
      status: 'Idea',
    }
  });

  useEffect(() => {
    if (open) {
      reset();
    }
  }, [open, reset]);

  const onSubmit = async (data: FeatureFormValues) => {
    try {
      await createMutation.mutateAsync({
        title: data.title,
        priority: data.priority,
        status: data.status,
      });
      toast.success('Feature created successfully');
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to create feature');
    }
  };

  const isPending = createMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Create New Feature</DialogTitle>
            <DialogDescription>
              A feature is a granular engineering task or deliverable inside this module.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Feature Title <span className="text-destructive">*</span></Label>
              <Input
                id="title"
                placeholder="e.g. Implement Google OAuth"
                {...register('title')}
              />
              {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Initial Status</Label>
                <Controller
                  name="status"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Idea">Idea</SelectItem>
                        <SelectItem value="Requirements">Requirements</SelectItem>
                        <SelectItem value="Design">Design</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Controller
                  name="priority"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Low">Low</SelectItem>
                        <SelectItem value="Medium">Medium</SelectItem>
                        <SelectItem value="High">High</SelectItem>
                        <SelectItem value="Critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Creating...' : 'Create Feature'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
