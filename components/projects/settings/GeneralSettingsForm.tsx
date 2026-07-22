'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useUpdateProject } from '@/hooks/useProjects';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const generalSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  description: z.string().optional(),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']),
  status: z.enum(['Draft', 'Planning', 'Active', 'On Hold', 'Completed', 'Archived']),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
});

type GeneralFormValues = z.infer<typeof generalSchema>;

export function GeneralSettingsForm({ project }: { project: any }) {
  const updateMutation = useUpdateProject();
  
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isDirty }
  } = useForm<GeneralFormValues>({
    resolver: zodResolver(generalSchema),
    defaultValues: {
      name: project.name || '',
      description: project.description || '',
      priority: project.priority || 'Medium',
      status: project.status || 'Draft',
      start_date: project.start_date || '',
      end_date: project.end_date || '',
    },
  });

  const onSubmit = (data: GeneralFormValues) => {
    updateMutation.mutate(
      { id: project.id, ...data },
      {
        onSuccess: () => toast.success('Project settings saved'),
        onError: (err: any) => toast.error(err.message || 'Failed to save settings'),
      }
    );
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Card>
        <CardHeader>
          <CardTitle>General Settings</CardTitle>
          <CardDescription>
            Update your project's basic information and status.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-2">
            <Label htmlFor="name">Project Name</Label>
            <Input id="name" {...register('name')} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea 
              id="description" 
              {...register('description')} 
              rows={4}
              placeholder="What is this project about?"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="grid gap-2">
              <Label>Priority</Label>
              <Select 
                value={watch('priority')} 
                onValueChange={(v: any) => setValue('priority', v, { shouldDirty: true })}
              >
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
            </div>

            <div className="grid gap-2">
              <Label>Status</Label>
              <Select 
                value={watch('status')} 
                onValueChange={(v: any) => setValue('status', v, { shouldDirty: true })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Draft">Draft</SelectItem>
                  <SelectItem value="Planning">Planning</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="On Hold">On Hold</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="start_date">Start Date</Label>
              <Input type="date" id="start_date" {...register('start_date')} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="end_date">Target End Date</Label>
              <Input type="date" id="end_date" {...register('end_date')} />
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end border-t border-border pt-6 mt-2">
          <Button type="submit" disabled={!isDirty || updateMutation.isPending}>
            {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
