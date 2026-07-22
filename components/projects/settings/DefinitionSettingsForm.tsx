'use client';

import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useUpdateProject } from '@/hooks/useProjects';
import { Loader2, Plus, Trash2 } from 'lucide-react';

const definitionSchema = z.object({
  business_goals: z.array(z.object({ value: z.string() })).optional(),
  target_users: z.array(z.object({ value: z.string() })).optional(),
  success_metrics: z.array(z.object({ value: z.string() })).optional(),
});

type DefinitionFormValues = z.infer<typeof definitionSchema>;

export function DefinitionSettingsForm({ project }: { project: any }) {
  const updateMutation = useUpdateProject();
  
  // Convert array of strings to array of objects for useFieldArray
  const toFieldArray = (arr: any) => {
    try {
      const parsed = typeof arr === 'string' ? JSON.parse(arr) : arr;
      return Array.isArray(parsed) ? parsed.map(v => ({ value: v })) : [];
    } catch {
      return [];
    }
  };

  const {
    register,
    handleSubmit,
    control,
    formState: { isDirty }
  } = useForm<DefinitionFormValues>({
    resolver: zodResolver(definitionSchema),
    defaultValues: {
      business_goals: toFieldArray(project.business_goals),
      target_users: toFieldArray(project.target_users),
      success_metrics: toFieldArray(project.success_metrics),
    },
  });

  const { fields: bgFields, append: bgAppend, remove: bgRemove } = useFieldArray({ control, name: "business_goals" });
  const { fields: tuFields, append: tuAppend, remove: tuRemove } = useFieldArray({ control, name: "target_users" });
  const { fields: smFields, append: smAppend, remove: smRemove } = useFieldArray({ control, name: "success_metrics" });

  const onSubmit = (data: DefinitionFormValues) => {
    // Transform back to simple string arrays
    const payload = {
      id: project.id,
      business_goals: data.business_goals?.map(g => g.value).filter(Boolean) || [],
      target_users: data.target_users?.map(u => u.value).filter(Boolean) || [],
      success_metrics: data.success_metrics?.map(m => m.value).filter(Boolean) || [],
    };
    updateMutation.mutate(payload);
  };

  const renderDynamicList = (title: string, description: string, fields: any[], append: any, remove: any, name: "business_goals" | "target_users" | "success_metrics") => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-base">{title}</Label>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => append({ value: '' })}>
          <Plus className="h-4 w-4 mr-2" />
          Add
        </Button>
      </div>
      <div className="space-y-3">
        {fields.length === 0 && (
          <div className="text-sm text-muted-foreground italic bg-muted/30 p-3 rounded-md">No entries added yet.</div>
        )}
        {fields.map((field, index) => (
          <div key={field.id} className="flex gap-2 items-center">
            <Input
              {...register(`${name}.${index}.value` as const)}
              placeholder={`Enter ${title.toLowerCase().slice(0, -1)}...`}
              className="flex-1"
            />
            <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Card>
        <CardHeader>
          <CardTitle>Project Definition</CardTitle>
          <CardDescription>
            Define the core objectives, audience, and success criteria for this project.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {renderDynamicList("Business Goals", "What business problems does this project solve?", bgFields, bgAppend, bgRemove, "business_goals")}
          <div className="border-t border-border" />
          {renderDynamicList("Target Users", "Who is the primary audience or user base?", tuFields, tuAppend, tuRemove, "target_users")}
          <div className="border-t border-border" />
          {renderDynamicList("Success Metrics", "How will we measure the success of this project?", smFields, smAppend, smRemove, "success_metrics")}
        </CardContent>
        <CardFooter className="flex justify-end border-t border-border pt-6 mt-2">
          <Button type="submit" disabled={!isDirty || updateMutation.isPending}>
            {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Definitions
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
