'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useUpdateOrganization } from '@/hooks/useOrganization';
import { Loader2, Globe, Building2, MapPin, Clock } from 'lucide-react';
import { toast } from 'sonner';

const generalSchema = z.object({
  name: z.string().min(1, 'Organization name is required'),
  description: z.string().optional(),
  industry: z.string().optional(),
  website: z.string().url().optional().or(z.literal('')),
  country: z.string().optional(),
  timezone: z.string().optional(),
});

type GeneralFormValues = z.infer<typeof generalSchema>;

export function GeneralSettingsForm({ organization }: { organization: any }) {
  const updateMutation = useUpdateOrganization();
  
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty }
  } = useForm<GeneralFormValues>({
    resolver: zodResolver(generalSchema),
    defaultValues: {
      name: organization.name || '',
      description: organization.description || '',
      industry: organization.industry || '',
      website: organization.website || '',
      country: organization.country || '',
      timezone: organization.timezone || '',
    },
  });

  const onSubmit = (data: GeneralFormValues) => {
    updateMutation.mutate(data, {
      onSuccess: () => toast.success('Organization profile updated successfully'),
      onError: (err: any) => toast.error(err.message || 'Failed to update organization'),
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Card>
        <CardHeader>
          <CardTitle>Organization Profile</CardTitle>
          <CardDescription>
            Manage the global identity and details of your organization.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-2">
            <Label htmlFor="name">Organization Name</Label>
            <Input id="name" {...register('name')} placeholder="Acme Corp" />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea 
              id="description" 
              {...register('description')} 
              rows={3}
              placeholder="Briefly describe what your organization does..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="grid gap-2">
              <Label htmlFor="industry" className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-muted-foreground" /> Industry
              </Label>
              <Input id="industry" {...register('industry')} placeholder="Technology" />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="website" className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-muted-foreground" /> Website
              </Label>
              <Input id="website" type="url" {...register('website')} placeholder="https://..." />
              {errors.website && <p className="text-sm text-destructive">{errors.website.message}</p>}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="country" className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground" /> Country
              </Label>
              <Input id="country" {...register('country')} placeholder="United States" />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="timezone" className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" /> Timezone
              </Label>
              <Input id="timezone" {...register('timezone')} placeholder="UTC" />
            </div>
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
