import { useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { z } from 'zod';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCreateRoadmapModule, useUpdateRoadmapModule, RoadmapModule } from '@/hooks/useRoadmap';
import { toast } from 'sonner';

const moduleSchema = z.object({
  name: z.string().min(1, 'Module name is required'),
  description: z.string().optional(),
  objectives: z.string().min(1, 'Objectives are required'),
  status: z.enum(['Not Started', 'In Progress', 'Completed']),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']),
});

type ModuleFormValues = z.infer<typeof moduleSchema>;

interface RoadmapModuleDialogProps {
  projectId: string;
  roadmapId: string | null; // The phase this module belongs to
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moduleToEdit?: RoadmapModule | null;
  onSuccess?: () => void;
  nextOrderIndex?: number;
}

export function RoadmapModuleDialog({
  projectId,
  roadmapId,
  open,
  onOpenChange,
  moduleToEdit,
  onSuccess,
  nextOrderIndex = 0
}: RoadmapModuleDialogProps) {
  const createMutation = useCreateRoadmapModule(projectId);
  const updateMutation = useUpdateRoadmapModule(projectId);

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<ModuleFormValues>({
    resolver: zodResolver(moduleSchema),
    defaultValues: {
      name: '',
      description: '',
      objectives: '',
      status: 'Not Started',
      priority: 'Medium',
    }
  });

  useEffect(() => {
    if (open) {
      if (moduleToEdit) {
        reset({
          name: moduleToEdit.name,
          description: moduleToEdit.description || '',
          objectives: moduleToEdit.objectives || '',
          status: moduleToEdit.status,
          priority: moduleToEdit.priority,
        });
      } else {
        reset({
          name: '',
          description: '',
          objectives: '',
          status: 'Not Started',
          priority: 'Medium',
        });
      }
    }
  }, [open, moduleToEdit, reset]);

  const onSubmit = async (data: ModuleFormValues) => {
    try {
      if (moduleToEdit) {
        await updateMutation.mutateAsync({
          moduleId: moduleToEdit.id,
          data: {
            name: data.name,
            description: data.description,
            objectives: data.objectives,
            status: data.status,
            priority: data.priority,
          }
        });
        toast.success('Module updated successfully');
      } else {
        if (!roadmapId) {
          toast.error('Missing Phase ID');
          return;
        }
        await createMutation.mutateAsync({
          roadmap_id: roadmapId,
          name: data.name,
          description: data.description,
          objectives: data.objectives,
          status: data.status,
          priority: data.priority,
          order_index: nextOrderIndex
        });
        toast.success('Module created successfully');
      }
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save module');
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>{moduleToEdit ? 'Edit Module' : 'Create New Module'}</DialogTitle>
            <DialogDescription>
              A Module is a functional block of the product (e.g., Authentication, Payments).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Module Name <span className="text-destructive">*</span></Label>
              <Input
                id="name"
                placeholder="e.g. Authentication System"
                {...register('name')}
              />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="objectives">Primary Objectives <span className="text-destructive">*</span></Label>
              <Textarea
                id="objectives"
                placeholder="What exactly must this module achieve?"
                className="h-20"
                {...register('objectives')}
              />
              {errors.objectives && <p className="text-sm text-destructive">{errors.objectives.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Technical Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Any technical context or architectural notes..."
                {...register('description')}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Controller
                  name="status"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Not Started">Not Started</SelectItem>
                        <SelectItem value="In Progress">In Progress</SelectItem>
                        <SelectItem value="Completed">Completed</SelectItem>
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
              {isPending ? 'Saving...' : 'Save Module'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
