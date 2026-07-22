import { useEffect } from 'react';

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { z } from 'zod';
import { useForm as useReactHookForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCreateRoadmapPhase, useUpdateRoadmapPhase, RoadmapPhase } from '@/hooks/useRoadmap';
import { toast } from 'sonner';

const phaseSchema = z.object({
  name: z.string().min(1, 'Phase name is required'),
  description: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
});

type PhaseFormValues = z.infer<typeof phaseSchema>;

interface RoadmapPhaseDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phaseToEdit?: RoadmapPhase | null;
  onSuccess?: () => void;
  nextOrderIndex?: number;
}

export function RoadmapPhaseDialog({
  projectId,
  open,
  onOpenChange,
  phaseToEdit,
  onSuccess,
  nextOrderIndex = 0
}: RoadmapPhaseDialogProps) {
  const createMutation = useCreateRoadmapPhase(projectId);
  const updateMutation = useUpdateRoadmapPhase(projectId);

  const { register, handleSubmit, reset, formState: { errors } } = useReactHookForm<PhaseFormValues>({
    resolver: zodResolver(phaseSchema),
    defaultValues: {
      name: '',
      description: '',
      start_date: '',
      end_date: '',
    }
  });

  useEffect(() => {
    if (open) {
      if (phaseToEdit) {
        reset({
          name: phaseToEdit.name,
          description: phaseToEdit.description || '',
          start_date: phaseToEdit.start_date || '',
          end_date: phaseToEdit.end_date || '',
        });
      } else {
        reset({
          name: '',
          description: '',
          start_date: '',
          end_date: '',
        });
      }
    }
  }, [open, phaseToEdit, reset]);

  const onSubmit = async (data: PhaseFormValues) => {
    try {
      if (phaseToEdit) {
        await updateMutation.mutateAsync({
          phaseId: phaseToEdit.id,
          data: {
            name: data.name,
            description: data.description,
            start_date: data.start_date,
            end_date: data.end_date,
          }
        });
        toast.success('Phase updated successfully');
      } else {
        await createMutation.mutateAsync({
          name: data.name,
          description: data.description,
          start_date: data.start_date,
          end_date: data.end_date,
          order_index: nextOrderIndex
        });
        toast.success('Phase created successfully');
      }
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save phase');
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>{phaseToEdit ? 'Edit Phase' : 'Create New Phase'}</DialogTitle>
            <DialogDescription>
              A Phase is a high-level column on your roadmap (e.g., MVP, Scale).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Phase Name <span className="text-destructive">*</span></Label>
              <Input
                id="name"
                placeholder="e.g. Phase 1: MVP"
                {...register('name')}
              />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Briefly describe the goal of this phase..."
                {...register('description')}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Start Date</Label>
                <Input
                  id="start_date"
                  type="date"
                  {...register('start_date')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">Target End Date</Label>
                <Input
                  id="end_date"
                  type="date"
                  {...register('end_date')}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving...' : 'Save Phase'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
