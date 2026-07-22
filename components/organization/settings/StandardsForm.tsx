'use client';

import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useUpdateOrganizationStandards } from '@/hooks/useOrganization';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const standardsSchema = z.object({
  engineering_standards: z.array(z.object({ value: z.string() })).optional(),
  coding_standards: z.array(z.object({ value: z.string() })).optional(),
  definition_of_done: z.array(z.object({ value: z.string() })).optional(),
  branch_naming_rules: z.string().optional(),
});

type StandardsFormValues = z.infer<typeof standardsSchema>;

export function StandardsForm({ standards }: { standards: any }) {
  const updateMutation = useUpdateOrganizationStandards();
  
  const toFieldArray = (arr: any) => {
    try {
      const parsed = typeof arr === 'string' ? JSON.parse(arr) : arr;
      return Array.isArray(parsed) ? parsed.map((v: string) => ({ value: v })) : [];
    } catch {
      return [];
    }
  };

  const {
    register,
    handleSubmit,
    control,
    formState: { isDirty }
  } = useForm<StandardsFormValues>({
    resolver: zodResolver(standardsSchema),
    defaultValues: {
      engineering_standards: toFieldArray(standards?.engineering_standards),
      coding_standards: toFieldArray(standards?.coding_standards),
      definition_of_done: toFieldArray(standards?.definition_of_done),
      branch_naming_rules: standards?.branch_naming_rules || '',
    },
  });

  const { fields: esFields, append: esAppend, remove: esRemove } = useFieldArray({ control, name: "engineering_standards" });
  const { fields: csFields, append: csAppend, remove: csRemove } = useFieldArray({ control, name: "coding_standards" });
  const { fields: dodFields, append: dodAppend, remove: dodRemove } = useFieldArray({ control, name: "definition_of_done" });

  const onSubmit = (data: StandardsFormValues) => {
    const payload = {
      engineering_standards: data.engineering_standards?.map(i => i.value).filter(Boolean) || [],
      coding_standards: data.coding_standards?.map(i => i.value).filter(Boolean) || [],
      definition_of_done: data.definition_of_done?.map(i => i.value).filter(Boolean) || [],
      branch_naming_rules: data.branch_naming_rules,
    };
    
    updateMutation.mutate(payload, {
      onSuccess: () => toast.success('Global standards updated successfully'),
      onError: (err: any) => toast.error(err.message || 'Failed to update standards'),
    });
  };

  const renderDynamicList = (title: string, description: string, fields: any[], append: any, remove: any, name: any, placeholder: string) => (
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
          <div className="text-sm text-muted-foreground italic bg-muted/30 p-3 rounded-md">No standards defined yet.</div>
        )}
        {fields.map((field, index) => (
          <div key={field.id} className="flex gap-2 items-center">
            <Input
              {...register(`${name}.${index}.value` as any)}
              placeholder={placeholder}
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
          <CardTitle>Global Standards</CardTitle>
          <CardDescription>
            Define the default engineering and workflow rules for all projects in this organization.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {renderDynamicList(
            "Engineering Standards", 
            "Core architectural and engineering principles.", 
            esFields, esAppend, esRemove, "engineering_standards", 
            "e.g., Must have 80% test coverage"
          )}
          
          <div className="border-t border-border" />
          
          {renderDynamicList(
            "Coding Standards", 
            "Style guides and code quality expectations.", 
            csFields, csAppend, csRemove, "coding_standards", 
            "e.g., Use Prettier and ESLint"
          )}
          
          <div className="border-t border-border" />
          
          {renderDynamicList(
            "Definition of Done (DoD)", 
            "Checklist items required before a feature is considered complete.", 
            dodFields, dodAppend, dodRemove, "definition_of_done", 
            "e.g., Code reviewed by at least 1 peer"
          )}

          <div className="border-t border-border" />

          <div className="space-y-4">
            <div>
              <Label className="text-base">Branch Naming Rules</Label>
              <p className="text-sm text-muted-foreground">Standardized convention for Git branch names.</p>
            </div>
            <Input 
              {...register('branch_naming_rules')} 
              placeholder="e.g., type/issue-number/description (feat/123/login)" 
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-end border-t border-border pt-6 mt-2">
          <Button type="submit" disabled={!isDirty || updateMutation.isPending}>
            {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Standards
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
