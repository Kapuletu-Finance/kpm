'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useUpdateProfile } from '@/hooks/useOrganization';
import { useAuth } from '@/store/AuthContext';
import { Loader2, UserCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const profileSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  job_title: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export function PersonalProfileForm() {
  const { memberProfile } = useAuth();
  const updateMutation = useUpdateProfile();
  
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty }
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      first_name: memberProfile?.first_name || '',
      last_name: memberProfile?.last_name || '',
      job_title: memberProfile?.job_title || '',
    },
  });

  const onSubmit = (data: ProfileFormValues) => {
    updateMutation.mutate(data, {
      onSuccess: () => toast.success('Personal profile updated successfully'),
      onError: (err: any) => toast.error(err.message || 'Failed to update profile'),
    });
  };

  if (!memberProfile) return null;

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCircle2 className="w-5 h-5 text-primary" />
            Personal Profile
          </CardTitle>
          <CardDescription>
            Update your personal information and how you appear to others in the organization.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="grid gap-2">
              <Label htmlFor="first_name">First Name</Label>
              <Input id="first_name" {...register('first_name')} />
              {errors.first_name && <p className="text-sm text-destructive">{errors.first_name.message}</p>}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="last_name">Last Name</Label>
              <Input id="last_name" {...register('last_name')} />
              {errors.last_name && <p className="text-sm text-destructive">{errors.last_name.message}</p>}
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="email">Email Address</Label>
            <Input id="email" value={memberProfile.email} disabled />
            <p className="text-xs text-muted-foreground">Email addresses are managed by your identity provider.</p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="job_title">Job Title</Label>
            <Input id="job_title" {...register('job_title')} placeholder="e.g. Senior Frontend Developer" />
          </div>

          <div className="grid gap-2">
            <Label>Organization Role</Label>
            <Input value={memberProfile.organization_role} disabled />
            <p className="text-xs text-muted-foreground">Only Organization Admins can change roles.</p>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end border-t border-border pt-6 mt-2">
          <Button type="submit" disabled={!isDirty || updateMutation.isPending}>
            {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Profile
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
