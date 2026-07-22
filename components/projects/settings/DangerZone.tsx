'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/store/AuthContext';
import { useUpdateProject } from '@/hooks/useProjects';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';

export function DangerZone({ project }: { project: any }) {
  const { memberProfile } = useAuth();
  const updateMutation = useUpdateProject();
  const router = useRouter();
  
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const isOrgAdmin = memberProfile?.organization_role === 'Organization Admin';

  const handleArchiveToggle = () => {
    const newStatus = project.status === 'Archived' ? 'Planning' : 'Archived';
    updateMutation.mutate({ id: project.id, status: newStatus });
  };

  const handleDelete = async () => {
    if (deleteConfirmation !== project.name) return;
    
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/v1/projects/${project.id}`, {
        method: 'DELETE',
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete project');
      }

      toast.success('Project permanently deleted');
      router.push('/workspace/projects');
      router.refresh();
    } catch (error: any) {
      toast.error(error.message);
      setIsDeleting(false);
    }
  };

  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="w-5 h-5" />
          Danger Zone
        </CardTitle>
        <CardDescription>
          Irreversible and destructive actions for this project.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 py-4 border-b border-border/50">
          <div>
            <h4 className="font-semibold text-sm">Archive Project</h4>
            <p className="text-sm text-muted-foreground">
              Mark this project as read-only. It will be hidden from active views but data is retained.
            </p>
          </div>
          <Button 
            variant={project.status === 'Archived' ? 'outline' : 'secondary'} 
            onClick={handleArchiveToggle}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {project.status === 'Archived' ? 'Restore Project' : 'Archive Project'}
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-2">
          <div>
            <h4 className="font-semibold text-sm text-destructive">Delete Project</h4>
            <p className="text-sm text-muted-foreground">
              Permanently delete this project, including all features, sprints, and files. This cannot be undone.
            </p>
          </div>
          
          <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
            <DialogTrigger>
              <Button variant="destructive" disabled={!isOrgAdmin} type="button">
                Delete Project
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="text-destructive flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Absolute Certainty Required
                </DialogTitle>
                <DialogDescription className="pt-4">
                  This action <strong>cannot</strong> be undone. This will permanently delete the <strong>{project.name}</strong> project, roadmap, features, and all associated team assignments.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <p className="text-sm">
                  Please type <strong>{project.name}</strong> to confirm.
                </p>
                <Input 
                  value={deleteConfirmation} 
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  placeholder={project.name}
                />
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>Cancel</Button>
                <Button 
                  variant="destructive" 
                  disabled={deleteConfirmation !== project.name || isDeleting}
                  onClick={handleDelete}
                >
                  {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  I understand the consequences, delete this project
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        
        {!isOrgAdmin && (
          <p className="text-xs text-muted-foreground italic">
            * Project deletion is restricted to Organization Admins.
          </p>
        )}

      </CardContent>
    </Card>
  );
}
