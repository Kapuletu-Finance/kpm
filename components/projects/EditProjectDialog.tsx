'use client';

import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { useUpdateProject } from '@/hooks/useProjects';
import { useMembers } from '@/hooks/useOrganization';
import {
  Loader2,
  Plus,
  Trash2,
  ArrowRight,
  ArrowLeft,
  FolderKanban,
  Target,
  Link as LinkIcon,
  Info,
} from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ---------------------------------------------------------------------------
// Schema — mirrors CreateProjectDialog but adds status field
// ---------------------------------------------------------------------------
const editProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  description: z.string().optional(),
  project_manager_id: z.string().optional(),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']),
  status: z.enum(['Draft', 'Planning', 'Active', 'On Hold', 'Completed', 'Archived']),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  business_goals: z.array(z.object({ value: z.string() })).optional(),
  target_users: z.array(z.object({ value: z.string() })).optional(),
  success_metrics: z.array(z.object({ value: z.string() })).optional(),
  github_repository: z.string().url('Must be a valid URL').or(z.literal('')).optional(),
  figma_url: z.string().url('Must be a valid URL').or(z.literal('')).optional(),
  swagger_url: z.string().url('Must be a valid URL').or(z.literal('')).optional(),
  cloudinary_folder: z.string().optional(),
});

type EditProjectFormValues = z.infer<typeof editProjectSchema>;

interface EditProjectDialogProps {
  project: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a stored string[] (or JSON string) to useFieldArray shape */
function toFieldArray(arr: any): { value: string }[] {
  try {
    const parsed = typeof arr === 'string' ? JSON.parse(arr) : arr;
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((v: any) => ({ value: String(v) }));
    }
  } catch {
    // fall through
  }
  return [{ value: '' }];
}

/** Build the reset/default values from a project object */
function projectDefaults(project: any): EditProjectFormValues {
  return {
    name: project.name || '',
    description: project.description || '',
    project_manager_id: project.project_manager_id || '',
    priority: project.priority || 'Medium',
    status: project.status || 'Draft',
    start_date: project.start_date || '',
    end_date: project.end_date || '',
    business_goals: toFieldArray(project.business_goals),
    target_users: toFieldArray(project.target_users),
    success_metrics: toFieldArray(project.success_metrics),
    github_repository: project.github_repository || '',
    figma_url: project.figma_url || '',
    swagger_url: project.swagger_url || '',
    cloudinary_folder: project.cloudinary_folder || '',
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function EditProjectDialog({ project, open, onOpenChange }: EditProjectDialogProps) {
  const [step, setStep] = useState(1);
  const updateMutation = useUpdateProject();
  const { data: members } = useMembers();

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
    reset,
    trigger,
    setValue,
    watch,
  } = useForm<EditProjectFormValues>({
    resolver: zodResolver(editProjectSchema),
    defaultValues: projectDefaults(project),
    mode: 'onChange',
  });

  // Field arrays for dynamic lists
  const { fields: goalFields, append: appendGoal, remove: removeGoal } = useFieldArray({ control, name: 'business_goals' });
  const { fields: userFields, append: appendUser, remove: removeUser } = useFieldArray({ control, name: 'target_users' });
  const { fields: metricFields, append: appendMetric, remove: removeMetric } = useFieldArray({ control, name: 'success_metrics' });

  const priorityValue = watch('priority');
  const statusValue = watch('status');
  const pmValue = watch('project_manager_id');

  // Resolve the PM display name so SelectValue shows a name instead of raw UUID
  // while the members list is still loading or hasn't been fetched yet.
  const pmDisplayName = (() => {
    if (!pmValue) return null;
    // Try from the loaded members list first
    const fromList = members?.find((m: any) => m.id === pmValue);
    if (fromList) return `${fromList.first_name} ${fromList.last_name}`;
    // Fall back to the project_manager object already embedded in the project response
    if (project.project_manager) {
      return `${project.project_manager.first_name} ${project.project_manager.last_name}`;
    }
    return null;
  })();

  // ------------------------------------------------------------------
  // Navigation
  // ------------------------------------------------------------------
  const onNext = async () => {
    let valid = false;
    if (step === 1) {
      valid = await trigger(['name', 'description', 'priority', 'status', 'start_date', 'end_date']);
    } else if (step === 2) {
      valid = await trigger(['business_goals', 'target_users', 'success_metrics']);
    }
    if (valid) setStep(step + 1);
  };

  const onBack = () => setStep(step - 1);

  // Block ALL Enter-key form submissions unless the user is explicitly
  // pressing Enter on the submit button. This covers:
  //   • Text/date inputs on steps 1 & 2
  //   • URL inputs on step 3 (browser autocomplete pick via Enter would
  //     otherwise fire form submit)
  const handleFormKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key !== 'Enter') return;
    const target = e.target as HTMLElement;
    const isSubmitButton =
      target.tagName === 'BUTTON' &&
      (target as HTMLButtonElement).type === 'submit';
    if (!isSubmitButton) {
      e.preventDefault();
    }
  };

  // ------------------------------------------------------------------
  // Submit
  // ------------------------------------------------------------------
  const onSubmit = async (data: EditProjectFormValues) => {
    try {
      const payload = {
        ...data,
        // Keep existing value if the field is empty (user didn't change it)
        github_repository: data.github_repository || project.github_repository || '',
        figma_url: data.figma_url || project.figma_url || '',
        swagger_url: data.swagger_url || project.swagger_url || '',
        cloudinary_folder: data.cloudinary_folder || project.cloudinary_folder || '',
        business_goals: data.business_goals?.map((g) => g.value).filter(Boolean),
        target_users: data.target_users?.map((u) => u.value).filter(Boolean),
        success_metrics: data.success_metrics?.map((m) => m.value).filter(Boolean),
      };

      await updateMutation.mutateAsync({ id: project.id, ...payload });
      toast.success('Project updated successfully');
      setStep(1);
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update project');
    }
  };

  // ------------------------------------------------------------------
  // Close / Cancel — always resets to original project values
  // ------------------------------------------------------------------
  const handleOpenChange = (val: boolean) => {
    if (!val) {
      reset(projectDefaults(project));
      setStep(1);
    }
    onOpenChange(val);
  };

  // Block Enter-key implicit submission on steps 1 & 2
  const handleFormKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'Enter' && step < 3) {
      e.preventDefault();
    }
  };

  // ------------------------------------------------------------------
  // Step renderers
  // ------------------------------------------------------------------

  const renderStep1 = () => (
    <div className="space-y-6 py-6 animate-in fade-in slide-in-from-right-4">
      <div className="space-y-2">
        <Label htmlFor="edit-name">
          Project Name <span className="text-destructive">*</span>
        </Label>
        <Input id="edit-name" {...register('name')} />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="edit-description">Short Description</Label>
        <Textarea
          id="edit-description"
          {...register('description')}
          className="resize-none"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Project Manager</Label>
          <Select
            value={pmValue || ''}
            onValueChange={(val) => setValue('project_manager_id', val ?? undefined, { shouldDirty: true })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a manager">
                {pmDisplayName}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {members?.filter((m: any) => m.organization_role !== 'Member').map((m: any) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.first_name} {m.last_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Priority</Label>
          <Select
            value={priorityValue}
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
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Status</Label>
          <Select
            value={statusValue}
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

        <div className="space-y-2" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="edit-start">Start Date</Label>
          <Input id="edit-start" type="date" {...register('start_date')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-end">Target End Date</Label>
          <Input id="edit-end" type="date" {...register('end_date')} />
        </div>
      </div>
    </div>
  );

  const renderDynamicList = (
    title: string,
    description: string,
    fields: any[],
    append: any,
    remove: any,
    name: 'business_goals' | 'target_users' | 'success_metrics',
    placeholder: string
  ) => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-base">{title}</Label>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => append({ value: '' })}>
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>
      <div className="space-y-2">
        {fields.length === 0 && (
          <div className="text-sm text-muted-foreground italic bg-muted/30 p-3 rounded-md">
            No entries. Click Add to create one.
          </div>
        )}
        {fields.map((field, index) => (
          <div key={field.id} className="flex items-center gap-2">
            <Input
              {...register(`${name}.${index}.value` as const)}
              placeholder={placeholder}
              className="flex-1"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => remove(index)}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-8 py-6 animate-in fade-in slide-in-from-right-4">
      {renderDynamicList(
        'Business Goals',
        'Strategic outcomes this project aims to achieve.',
        goalFields, appendGoal, removeGoal, 'business_goals',
        'e.g., Increase conversion rate by 15%'
      )}
      <hr className="border-border/50" />
      {renderDynamicList(
        'Target Users',
        'Who are we building this for?',
        userFields, appendUser, removeUser, 'target_users',
        'e.g., Internal Support Team'
      )}
      <hr className="border-border/50" />
      {renderDynamicList(
        'Success Metrics',
        'How will we measure success?',
        metricFields, appendMetric, removeMetric, 'success_metrics',
        'e.g., < 1s API response time'
      )}
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6 py-6 animate-in fade-in slide-in-from-right-4">
      <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <p>
          Existing links are pre-filled. Leave a field <strong>unchanged</strong> to keep the current
          value. Clear a field to remove the link.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="edit-github">GitHub Repository URL</Label>
        <Input
          id="edit-github"
          type="text"
          placeholder="https://github.com/..."
          {...register('github_repository')}
        />
        {errors.github_repository && (
          <p className="text-sm text-destructive">{errors.github_repository.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="edit-figma">Figma Design URL</Label>
        <Input
          id="edit-figma"
          type="text"
          placeholder="https://figma.com/..."
          {...register('figma_url')}
        />
        {errors.figma_url && (
          <p className="text-sm text-destructive">{errors.figma_url.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="edit-swagger">Swagger / API Docs URL</Label>
        <Input
          id="edit-swagger"
          type="text"
          placeholder="https://..."
          {...register('swagger_url')}
        />
        {errors.swagger_url && (
          <p className="text-sm text-destructive">{errors.swagger_url.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="edit-cloudinary">Cloudinary Folder (Assets)</Label>
        <Input
          id="edit-cloudinary"
          placeholder="e.g., kpm/projects/my-project"
          {...register('cloudinary_folder')}
        />
        <p className="text-xs text-muted-foreground">
          Base directory for uploading project assets.
        </p>
      </div>
    </div>
  );

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              {step === 1 && <><FolderKanban className="text-primary w-6 h-6" /> Basics</>}
              {step === 2 && <><Target className="text-primary w-6 h-6" /> Strategy</>}
              {step === 3 && <><LinkIcon className="text-primary w-6 h-6" /> Resources</>}
            </DialogTitle>
            <DialogDescription>
              Step {step} of 3.{' '}
              {step === 1 && 'Update the project details and status.'}
              {step === 2 && 'Edit the strategic scope and success criteria.'}
              {step === 3 && 'Update external tool links and integrations.'}
            </DialogDescription>
          </DialogHeader>

          {/* Step progress dots */}
          <div className="flex items-center gap-2 mt-4">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  s <= step ? 'bg-primary' : 'bg-muted'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Form — Enter guard prevents implicit submit on steps 1 & 2 */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          onKeyDown={handleFormKeyDown}
          className="flex flex-col flex-1 overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto px-6">
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
          </div>

          {/* Footer navigation */}
          <div className="flex items-center justify-between p-6 border-t border-border/50 bg-muted/20">
            <div className="flex items-center gap-2">
              {step > 1 ? (
                <Button type="button" variant="outline" onClick={onBack}>
                  <ArrowLeft className="w-4 h-4 mr-2" /> Back
                </Button>
              ) : (
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                  Cancel
                </Button>
              )}
            </div>

            <div className="flex items-center gap-3">
              {step < 3 ? (
                <Button type="button" onClick={onNext}>
                  Next <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save All Changes
                </Button>
              )}
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
