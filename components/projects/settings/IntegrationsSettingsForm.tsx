'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useUpdateProject } from '@/hooks/useProjects';
import { Loader2, GitBranch, PenTool, Link2, Image as ImageIcon } from 'lucide-react';

const integrationsSchema = z.object({
  github_repository: z.string().url().optional().or(z.literal('')),
  swagger_url: z.string().url().optional().or(z.literal('')),
  figma_url: z.string().url().optional().or(z.literal('')),
  cloudinary_folder: z.string().optional(),
});

type IntegrationsFormValues = z.infer<typeof integrationsSchema>;

export function IntegrationsSettingsForm({ project }: { project: any }) {
  const updateMutation = useUpdateProject();
  
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty }
  } = useForm<IntegrationsFormValues>({
    resolver: zodResolver(integrationsSchema),
    defaultValues: {
      github_repository: project.github_repository || '',
      swagger_url: project.swagger_url || '',
      figma_url: project.figma_url || '',
      cloudinary_folder: project.cloudinary_folder || '',
    },
  });

  const onSubmit = (data: IntegrationsFormValues) => {
    updateMutation.mutate({ id: project.id, ...data });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Card>
        <CardHeader>
          <CardTitle>Integrations & Links</CardTitle>
          <CardDescription>
            Connect external tools and platforms to your project workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-2">
            <Label htmlFor="github_repository" className="flex items-center gap-2">
              <GitBranch className="w-4 h-4" /> GitHub Repository
            </Label>
            <Input 
              id="github_repository" 
              {...register('github_repository')} 
              placeholder="https://github.com/organization/repo" 
            />
            {errors.github_repository && <p className="text-sm text-destructive">{errors.github_repository.message}</p>}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="figma_url" className="flex items-center gap-2">
              <PenTool className="w-4 h-4" /> Figma Design URL
            </Label>
            <Input 
              id="figma_url" 
              {...register('figma_url')} 
              placeholder="https://www.figma.com/file/..." 
            />
            {errors.figma_url && <p className="text-sm text-destructive">{errors.figma_url.message}</p>}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="swagger_url" className="flex items-center gap-2">
              <Link2 className="w-4 h-4" /> API Documentation (Swagger)
            </Label>
            <Input 
              id="swagger_url" 
              {...register('swagger_url')} 
              placeholder="https://api.example.com/docs" 
            />
            {errors.swagger_url && <p className="text-sm text-destructive">{errors.swagger_url.message}</p>}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="cloudinary_folder" className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4" /> Cloudinary Asset Folder
            </Label>
            <Input 
              id="cloudinary_folder" 
              {...register('cloudinary_folder')} 
              placeholder="e.g. kpm/projects/dashboard" 
            />
            <p className="text-xs text-muted-foreground">
              Used as the base directory for uploading assets directly inside this project.
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end border-t border-border pt-6 mt-2">
          <Button type="submit" disabled={!isDirty || updateMutation.isPending}>
            {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Integrations
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
