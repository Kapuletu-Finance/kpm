'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useDeleteOrganization } from '@/hooks/useOrganization';
import { useAuth } from '@/store/AuthContext';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

export function DangerZone({ organization }: { organization: any }) {
  const router = useRouter();
  const deleteMutation = useDeleteOrganization();
  const { memberProfile } = useAuth();
  
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [confirmName, setConfirmName] = useState('');

  const isOrgAdmin = memberProfile?.organization_role === 'Organization Admin';

  const handleDelete = async () => {
    if (confirmName !== organization.name) return;
    
    try {
      await deleteMutation.mutateAsync();
      toast.success('Organization deleted successfully');
      
      // Ensure supabase session is cleared locally as well
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      await supabase.auth.signOut();
      
      router.push('/login');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete organization');
    }
  };

  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="text-destructive flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          Danger Zone
        </CardTitle>
        <CardDescription>
          Irreversible actions that affect the entire organization workspace.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center p-4 border border-destructive/20 rounded-lg bg-destructive/5">
          <div>
            <h4 className="font-medium text-foreground">Delete Organization</h4>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl">
              Permanently delete this organization, along with all projects, tasks, comments, and member associations. This cannot be undone.
            </p>
          </div>
          
          <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
            <DialogTrigger className={buttonVariants({ variant: 'destructive' })} disabled={!isOrgAdmin}>
              Delete Organization
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="text-destructive flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Delete Organization
                </DialogTitle>
                <DialogDescription>
                  This action cannot be undone. This will permanently delete the 
                  <span className="font-semibold text-foreground"> {organization.name} </span> 
                  organization and all associated data including projects and tasks.
                </DialogDescription>
              </DialogHeader>

              <div className="my-4 space-y-4">
                <div className="space-y-2">
                  <Label>
                    Please type <span className="font-semibold select-none">{organization.name}</span> to confirm.
                  </Label>
                  <Input 
                    value={confirmName}
                    onChange={(e) => setConfirmName(e.target.value)}
                    placeholder={organization.name}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  variant="destructive" 
                  disabled={confirmName !== organization.name || deleteMutation.isPending}
                  onClick={handleDelete}
                >
                  {deleteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Confirm Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

      </CardContent>
    </Card>
  );
}
