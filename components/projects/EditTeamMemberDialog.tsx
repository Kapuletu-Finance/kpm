'use client';

import { useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, Edit } from 'lucide-react';
import { useAuth } from '@/store/AuthContext';
import { useUpdateProjectMember } from '@/hooks/useProjectTeam';

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const editMemberSchema = z.object({
  project_role: z.enum(['Project Manager', 'Member']),
  functional_role: z.string().min(1, 'Functional role is required'),
  role_responsibilities: z.array(z.object({ value: z.string() })).min(1, 'Add at least one responsibility'),
});

type EditMemberFormValues = z.infer<typeof editMemberSchema>;

interface EditTeamMemberDialogProps {
  projectId: string;
  member: any; // The member object to edit
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditTeamMemberDialog({ projectId, member, open, onOpenChange }: EditTeamMemberDialogProps) {
  const { memberProfile } = useAuth();
  const updateMutation = useUpdateProjectMember(projectId);
  
  const isAdmin = memberProfile?.organization_role === 'Organization Admin';

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<EditMemberFormValues>({
    resolver: zodResolver(editMemberSchema),
    defaultValues: {
      project_role: 'Member',
      functional_role: '',
      role_responsibilities: [{ value: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    name: 'role_responsibilities',
    control,
  });

  const projectRoleValue = watch('project_role');

  // Load existing data when modal opens
  useEffect(() => {
    if (open && member) {
      let responsibilities = [{ value: '' }];
      
      if (member.role_responsibilities) {
        let parsed = member.role_responsibilities;
        if (typeof parsed === 'string') {
          try {
            parsed = JSON.parse(parsed);
          } catch (e) {
            parsed = [];
          }
        }
        if (Array.isArray(parsed) && parsed.length > 0) {
          responsibilities = parsed.map((r: string) => ({ value: r }));
        }
      }

      reset({
        project_role: (member.project_role as any) || 'Member',
        functional_role: member.functional_role || '',
        role_responsibilities: responsibilities,
      });
    }
  }, [open, member, reset]);

  const onSubmit = async (data: EditMemberFormValues) => {
    try {
      const payload = {
        memberId: member.member_id,
        project_role: data.project_role,
        functional_role: data.functional_role,
        role_responsibilities: data.role_responsibilities.map(r => r.value).filter(Boolean),
      };

      await updateMutation.mutateAsync(payload);
      toast.success('Team member updated successfully');
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update team member');
    }
  };

  if (!member) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <div className="px-6 pt-6 pb-4 border-b border-border/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <Edit className="text-primary w-6 h-6" /> Edit Team Member
            </DialogTitle>
            <DialogDescription>
              Update the role and responsibilities for {member.members?.first_name} {member.members?.last_name}.
            </DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
            
            <div className="space-y-2">
              <Label>Access Level (Project Role)</Label>
              <Select 
                value={projectRoleValue} 
                onValueChange={(val: any) => setValue('project_role', val)}
                disabled={!isAdmin} // PMs can only add Members
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Member">Member</SelectItem>
                  {isAdmin && <SelectItem value="Project Manager">Project Manager</SelectItem>}
                </SelectContent>
              </Select>
              {!isAdmin && <p className="text-xs text-muted-foreground">Only Admins can change Access Level.</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="functional_role">Job Title (Functional Role) <span className="text-destructive">*</span></Label>
              <Input 
                id="functional_role" 
                placeholder="e.g., Lead UX Designer, Senior Developer" 
                {...register('functional_role')} 
              />
              {errors.functional_role && <p className="text-sm text-destructive">{errors.functional_role.message}</p>}
            </div>

            <div className="space-y-3">
              <div>
                <Label className="text-base">Key Responsibilities <span className="text-destructive">*</span></Label>
                <p className="text-sm text-muted-foreground">
                  Define what this person is accountable for in this project.
                </p>
              </div>
              <div className="space-y-2">
                {fields.map((field, index) => (
                  <div key={field.id} className="flex items-center gap-2">
                    <Input
                      placeholder="e.g., Designing user journeys and wireframes"
                      {...register(`role_responsibilities.${index}.value` as const)}
                      className="flex-1"
                    />
                    {fields.length > 1 && (
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => remove(index)} 
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
                {errors.role_responsibilities && <p className="text-sm text-destructive">{errors.role_responsibilities.message}</p>}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ value: '' })}
                  className="mt-2 text-xs h-8"
                >
                  <Plus className="w-3 h-3 mr-2" /> Add Responsibility
                </Button>
              </div>
            </div>
            
          </div>

          <div className="flex items-center justify-end p-6 border-t border-border/50 bg-muted/20">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="mr-2">
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
