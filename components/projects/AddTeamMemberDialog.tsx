'use client';

import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, Mail, Users } from 'lucide-react';
import { useAuth } from '@/store/AuthContext';
import { useMembers } from '@/hooks/useOrganization';
import { useAddProjectMember } from '@/hooks/useProjectTeam';

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';

const addMemberSchema = z.object({
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  member_id: z.string().optional(),
  project_role: z.enum(['Project Manager', 'Member']),
  functional_role: z.string().min(1, 'Functional role is required'),
  role_responsibilities: z.array(z.object({ value: z.string() })).min(1, 'Add at least one responsibility'),
  review_authority: z.boolean(),
});

type AddMemberFormValues = z.infer<typeof addMemberSchema>;

interface AddTeamMemberDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddTeamMemberDialog({ projectId, open, onOpenChange }: AddTeamMemberDialogProps) {
  const { memberProfile } = useAuth();
  const { data: orgMembers } = useMembers();
  const addMutation = useAddProjectMember(projectId);
  
  const isAdmin = memberProfile?.organization_role === 'Organization Admin';
  const [tab, setTab] = useState(isAdmin ? 'existing' : 'invite');

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<AddMemberFormValues>({
    resolver: zodResolver(addMemberSchema),
    defaultValues: {
      project_role: 'Member',
      functional_role: '',
      role_responsibilities: [{ value: '' }],
      review_authority: false,
    },
  });

  const { fields, append, remove } = useFieldArray({
    name: 'role_responsibilities',
    control,
  });

  const projectRoleValue = watch('project_role');
  const reviewAuthorityValue = watch('review_authority');
  const memberIdValue = watch('member_id');

  const onSubmit = async (data: AddMemberFormValues) => {
    try {
      if (tab === 'existing' && !data.member_id) {
        toast.error('Please select a member');
        return;
      }
      if (tab === 'invite' && !data.email) {
        toast.error('Please provide an email address');
        return;
      }

      const payload = {
        email: tab === 'invite' ? data.email : undefined,
        member_id: tab === 'existing' ? data.member_id : undefined,
        project_role: data.project_role,
        functional_role: data.functional_role,
        role_responsibilities: data.role_responsibilities.map(r => r.value).filter(Boolean),
        review_authority: data.review_authority,
      };

      await addMutation.mutateAsync(payload);
      toast.success('Team member added successfully');
      reset();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to add team member');
    }
  };

  const renderFormContent = () => (
    <div className="space-y-6 pt-4 animate-in fade-in">
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
        {!isAdmin && <p className="text-xs text-muted-foreground">Only Admins can assign Project Managers.</p>}
      </div>

      <div className="flex flex-row items-center justify-between rounded-lg border p-4">
        <div className="space-y-0.5">
          <Label className="text-base">Review Authority</Label>
          <p className="text-sm text-muted-foreground">
            Allow this member to approve/reject Deliverables.
          </p>
        </div>
        <Switch
          checked={reviewAuthorityValue}
          onCheckedChange={(checked) => setValue('review_authority', checked)}
        />
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
  );

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (!val) reset();
      onOpenChange(val);
    }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <div className="px-6 pt-6 pb-4 border-b border-border/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <Users className="text-primary w-6 h-6" /> Add Team Member
            </DialogTitle>
            <DialogDescription>
              Assign an organization member to this project and define their specific role.
            </DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-4">
            
            {isAdmin ? (
              <Tabs value={tab} onValueChange={setTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="existing">Select Existing Member</TabsTrigger>
                  <TabsTrigger value="invite">Invite New via Email</TabsTrigger>
                </TabsList>
                
                <TabsContent value="existing" className="mt-4 space-y-4">
                  <div className="space-y-2">
                    <Label>Organization Member</Label>
                    <Select 
                      value={memberIdValue} 
                      onValueChange={(val: any) => setValue('member_id', val)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a member" />
                      </SelectTrigger>
                      <SelectContent>
                        {orgMembers?.map((m: any) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.first_name} {m.last_name} ({m.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {renderFormContent()}
                </TabsContent>

                <TabsContent value="invite" className="mt-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address <span className="text-destructive">*</span></Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input 
                        id="email" 
                        type="email" 
                        placeholder="colleague@company.com" 
                        className="pl-9"
                        {...register('email')} 
                      />
                    </div>
                    {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
                    <p className="text-xs text-muted-foreground">If they aren't in the organization yet, an invite will be sent.</p>
                  </div>
                  {renderFormContent()}
                </TabsContent>
              </Tabs>
            ) : (
              <div className="space-y-4 mt-2">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address <span className="text-destructive">*</span></Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="email" 
                      type="email" 
                      placeholder="colleague@company.com" 
                      className="pl-9"
                      {...register('email')} 
                    />
                  </div>
                  {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
                  <p className="text-xs text-muted-foreground">Type the email of the person you want to add to this project.</p>
                </div>
                {renderFormContent()}
              </div>
            )}
            
          </div>

          <div className="flex items-center justify-end p-6 border-t border-border/50 bg-muted/20">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="mr-2">
              Cancel
            </Button>
            <Button type="submit" disabled={addMutation.isPending}>
              {addMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {tab === 'invite' || !isAdmin ? 'Invite & Assign Member' : 'Assign Member'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
