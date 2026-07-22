'use client';

import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { useCreateProject } from '@/hooks/useProjects';
import { useMembers } from '@/hooks/useOrganization';
import { useAuth } from '@/store/AuthContext';
import { Loader2, Plus, Trash2, ArrowRight, ArrowLeft, Target, Link as LinkIcon, FolderKanban, Info } from 'lucide-react';

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const projectSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  description: z.string().optional(),
  project_manager_id: z.string().optional(),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']),
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

type ProjectFormValues = z.infer<typeof projectSchema>;

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateProjectDialog({ open, onOpenChange }: CreateProjectDialogProps) {
  const [step, setStep] = useState(1);
  const [isValidating, setIsValidating] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const createMutation = useCreateProject();
  const { data: members } = useMembers();
  const { memberProfile } = useAuth();

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
    reset,
    trigger,
    setValue,
    watch,
    getValues,
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      priority: 'Medium',
      business_goals: [{ value: '' }],
      target_users: [{ value: '' }],
      success_metrics: [{ value: '' }],
    },
    mode: 'onChange',
  });

  const { fields: goalFields, append: appendGoal, remove: removeGoal } = useFieldArray({
    name: 'business_goals',
    control,
  });

  const { fields: userFields, append: appendUser, remove: removeUser } = useFieldArray({
    name: 'target_users',
    control,
  });

  const { fields: metricFields, append: appendMetric, remove: removeMetric } = useFieldArray({
    name: 'success_metrics',
    control,
  });

  const priorityValue = watch('priority');
  const pmIdValue = watch('project_manager_id') || memberProfile?.id;

  // Resolve PM display name from loaded members or the current user (default PM)
  const pmDisplayName = (() => {
    if (!pmIdValue) return null;
    const fromList = members?.find((m: any) => m.id === pmIdValue);
    if (fromList) return `${fromList.first_name} ${fromList.last_name}${fromList.id === memberProfile?.id ? ' (You)' : ''}`;
    // Fallback: current user is the default PM before members list loads
    if (pmIdValue === memberProfile?.id && memberProfile) {
      return `${memberProfile.first_name} ${memberProfile.last_name} (You)`;
    }
    return null;
  })();

  const onNext = async () => {
    if (isValidating || isTransitioning) return;
    setIsValidating(true);
    try {
      let isValid = false;
      if (step === 1) {
        isValid = await trigger(['name', 'description', 'priority', 'start_date', 'end_date']);
      } else if (step === 2) {
        isValid = await trigger(['business_goals', 'target_users', 'success_metrics']);
      }

      if (isValid) {
        setIsTransitioning(true);
        setStep(step + 1);
        setTimeout(() => setIsTransitioning(false), 400);
      }
    } finally {
      setIsValidating(false);
    }
  };

  const onBack = () => {
    setStep(step - 1);
  };

  const doCreate = async (data: ProjectFormValues) => {
    const payload = {
      ...data,
      business_goals: data.business_goals?.map((g) => g.value).filter(Boolean),
      target_users: data.target_users?.map((u) => u.value).filter(Boolean),
      success_metrics: data.success_metrics?.map((m) => m.value).filter(Boolean),
    };

    await createMutation.mutateAsync(payload);
    toast.success('Project created successfully');
    reset();
    setStep(1);
    onOpenChange(false);
  };

  const onSubmit = async (data: ProjectFormValues) => {
    try {
      await doCreate(data);
    } catch (error: any) {
      toast.error(error.message || 'Failed to create project');
    }
  };

  // "Create without links" — skips link validation, creates with current values
  const onCreateWithoutLinks = async () => {
    try {
      const data = getValues();
      // Clear any link fields so there are no URL validation errors
      data.github_repository = '';
      data.figma_url = '';
      data.swagger_url = '';
      await doCreate(data);
    } catch (error: any) {
      toast.error(error.message || 'Failed to create project');
    }
  };

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

  // Render Step 1
  const renderStep1 = () => (
    <div className="space-y-6 py-6 animate-in fade-in slide-in-from-right-4">
      <div className="space-y-2">
        <Label htmlFor="name">Project Name <span className="text-destructive">*</span></Label>
        <Input id="name" placeholder="e.g., Q3 Platform Refresh" {...register('name')} />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Short Description</Label>
        <Textarea
          id="description"
          placeholder="Briefly describe the purpose of this project..."
          {...register('description')}
          className="resize-none"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {memberProfile?.organization_role === 'Organization Admin' && (
          <div className="space-y-2">
            <Label htmlFor="project_manager_id">Project Manager</Label>
          <Select
            value={pmIdValue}
            onValueChange={(val: any) => setValue('project_manager_id', val)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a manager">
                {pmDisplayName}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {members?.filter((m: any) => m.organization_role !== 'Member').map((m: any) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.first_name} {m.last_name} {m.id === memberProfile?.id ? '(You)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        )}

        <div className={`space-y-2 ${memberProfile?.organization_role !== 'Organization Admin' ? 'col-span-2' : ''}`}>
          <Label htmlFor="priority">Priority</Label>
          <Select value={priorityValue} onValueChange={(val: any) => setValue('priority', val)}>
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
          <Label htmlFor="start_date">Start Date</Label>
          <Input id="start_date" type="date" {...register('start_date')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="end_date">End Date</Label>
          <Input id="end_date" type="date" {...register('end_date')} />
        </div>
      </div>
    </div>
  );

  // Render Step 2 (Dynamic Lists)
  const renderDynamicList = (
    title: string,
    description: string,
    fields: any[],
    append: any,
    remove: any,
    registerName: 'business_goals' | 'target_users' | 'success_metrics',
    placeholder: string
  ) => (
    <div className="space-y-3">
      <div>
        <Label className="text-base">{title}</Label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-2">
        {fields.map((field, index) => (
          <div key={field.id} className="flex items-center gap-2">
            <Input
              placeholder={placeholder}
              {...register(`${registerName}.${index}.value` as const)}
              className="flex-1"
            />
            {fields.length > 1 && (
              <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ value: '' })}
          className="mt-2 text-xs h-8"
        >
          <Plus className="w-3 h-3 mr-2" /> Add {title.slice(0, -1)}
        </Button>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-8 py-6 animate-in fade-in slide-in-from-right-4">
      {renderDynamicList(
        'Business Goals',
        'What strategic outcomes does this project aim to achieve?',
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

  // Render Step 3
  const renderStep3 = () => (
    <div className="space-y-6 py-6 animate-in fade-in slide-in-from-right-4">

      {/* Helper callout — reassures user links are optional and editable later */}
      <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <p>
          All links are <strong>optional</strong> and can be added or changed at any time from{' '}
          <strong>Project Settings → Integrations</strong>.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="github_repository">GitHub Repository URL</Label>
        <Input id="github_repository" type="text" placeholder="https://github.com/..." {...register('github_repository')} />
        {errors.github_repository && <p className="text-sm text-destructive">{errors.github_repository.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="figma_url">Figma Design URL</Label>
        <Input id="figma_url" type="text" placeholder="https://figma.com/..." {...register('figma_url')} />
        {errors.figma_url && <p className="text-sm text-destructive">{errors.figma_url.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="swagger_url">Swagger/API Docs URL</Label>
        <Input id="swagger_url" type="text" placeholder="https://..." {...register('swagger_url')} />
        {errors.swagger_url && <p className="text-sm text-destructive">{errors.swagger_url.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="cloudinary_folder">Cloudinary Folder (Assets)</Label>
        <Input id="cloudinary_folder" placeholder="e.g., project_alpha_assets" {...register('cloudinary_folder')} />
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (!val) {
        reset();
        setStep(1);
      }
      onOpenChange(val);
    }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <div className="px-6 pt-6 pb-4 border-b border-border/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              {step === 1 && <><FolderKanban className="text-primary w-6 h-6" /> Basics</>}
              {step === 2 && <><Target className="text-primary w-6 h-6" /> Strategy</>}
              {step === 3 && <><LinkIcon className="text-primary w-6 h-6" /> Resources</>}
            </DialogTitle>
            <DialogDescription>
              Step {step} of 3.{' '}
              {step === 1 && "Let's start with the operational details."}
              {step === 2 && 'Define the purpose and scope of the project.'}
              {step === 3 && 'Optionally link external tools and repositories.'}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/*
          onKeyDown guard: prevents the browser's implicit form submission when
          the user presses Enter on any text field in steps 1 or 2.
          Without this, pressing Enter in a URL input on step 3 (or any input on
          earlier steps that triggers submit) fires onSubmit prematurely.
        */}
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

          <div className="flex items-center justify-between p-6 border-t border-border/50 bg-muted/20">
            {step > 1 ? (
              <Button type="button" variant="outline" onClick={onBack}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
            ) : (
              <div /> // Spacer
            )}

            <div className="flex items-center gap-3">
              {/* Step 3: allow skipping link entry — create immediately without links */}
              {step === 3 && (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={createMutation.isPending || isTransitioning}
                  onClick={onCreateWithoutLinks}
                  className="text-muted-foreground text-sm"
                >
                  Skip & Create
                </Button>
              )}

              {step < 3 ? (
                <Button type="button" onClick={onNext} disabled={isValidating || isTransitioning}>
                  {(isValidating || isTransitioning) ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Next <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button type="submit" disabled={createMutation.isPending || isTransitioning}>
                  {(createMutation.isPending || isTransitioning) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Create Project
                </Button>
              )}
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}