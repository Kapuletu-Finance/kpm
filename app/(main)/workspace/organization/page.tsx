'use client';

import { useState } from 'react';
import { useAuth } from '@/store/AuthContext';
import { useMembers, useRemoveMember, useInviteMember, useResendInviteMutation } from '@/hooks/useOrganization';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Building2, Plus, Trash2, MailCheck, Loader2, Send, Users, UserCheck, Clock, UserCog } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

const inviteSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Please enter a valid email address'),
  role: z.enum(['Project Manager', 'Member']),
});

type InviteFormValues = z.infer<typeof inviteSchema>;

export default function OrganizationPage() {
  const { memberProfile } = useAuth();
  const { data: members, isLoading } = useMembers();
  const removeMutation = useRemoveMember();
  const inviteMutation = useInviteMember();
  const resendMutation = useResendInviteMutation();

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      role: 'Member',
    }
  });

  const isOrgAdmin = memberProfile?.organization_role === 'Organization Admin';

  const onInviteSubmit = async (data: InviteFormValues) => {
    try {
      await inviteMutation.mutateAsync(data);
      toast.success('Invitation sent successfully');
      setIsInviteModalOpen(false);
      reset();
    } catch (error: any) {
      toast.error(error.message || 'Failed to send invite');
    }
  };

  const handleResendInvite = async (memberId: string) => {
    try {
      await resendMutation.mutateAsync(memberId);
      toast.success('Invitation resent successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to resend invite');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      await removeMutation.mutateAsync(memberId);
      toast.success('Member removed completely from the organization');
      setMemberToRemove(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove member');
    }
  };

  if (isLoading) {
    return <div className="animate-pulse space-y-6">
      <div className="h-10 bg-muted rounded w-1/4"></div>
      <div className="h-[400px] bg-muted rounded-xl"></div>
    </div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          {/* Header moved to layout */}
        </div>

        {isOrgAdmin && (
          <Dialog open={isInviteModalOpen} onOpenChange={setIsInviteModalOpen}>
            <DialogTrigger render={<Button />}>
              <Plus className="mr-2 h-4 w-4" />
              Invite Member
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Invite a new member</DialogTitle>
                <DialogDescription>
                  Send an email invitation to add someone to your organization.
                </DialogDescription>
              </DialogHeader>
              
              <form onSubmit={handleSubmit(onInviteSubmit)} className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      placeholder="John"
                      {...register('firstName')}
                      className={errors.firstName ? 'border-destructive' : ''}
                    />
                    {errors.firstName && <p className="text-sm text-destructive">{errors.firstName.message}</p>}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      placeholder="Doe"
                      {...register('lastName')}
                      className={errors.lastName ? 'border-destructive' : ''}
                    />
                    {errors.lastName && <p className="text-sm text-destructive">{errors.lastName.message}</p>}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="colleague@company.com"
                    {...register('email')}
                    className={errors.email ? 'border-destructive' : ''}
                  />
                  {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Organization Role</Label>
                  <select
                    id="role"
                    {...register('role')}
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="Member">Member</option>
                    <option value="Project Manager">Project Manager</option>
                  </select>
                  {errors.role && <p className="text-sm text-destructive">{errors.role.message}</p>}
                </div>

                <div className="flex justify-end pt-4 gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsInviteModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <MailCheck className="mr-2 h-4 w-4" />
                        Send Invite
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isOrgAdmin && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Members</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{members?.length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Members</CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{members?.filter((m: any) => m.status === 'Active').length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Invites</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{members?.filter((m: any) => m.status === 'Invited').length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Project Managers</CardTitle>
              <UserCog className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{members?.filter((m: any) => m.organization_role === 'Project Manager').length || 0}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{isOrgAdmin ? 'Members' : 'Directory'}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                {isOrgAdmin && (
                  <>
                    <TableHead>Status</TableHead>
                    <TableHead>Invited</TableHead>
                    <TableHead>Last Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members?.map((member: any) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">
                    {member.first_name} {member.last_name}
                  </TableCell>
                  <TableCell>{member.email}</TableCell>
                  <TableCell>
                    <Badge variant={member.organization_role === 'Organization Admin' ? 'default' : 'secondary'}
                           className={member.organization_role === 'Organization Admin' ? 'bg-primary text-primary-foreground hover:bg-primary/90' : ''}>
                      {member.organization_role}
                    </Badge>
                  </TableCell>
                  {isOrgAdmin && (
                    <>
                      <TableCell>
                        <Badge variant="outline" className={
                          member.status === 'Active' 
                            ? 'border-success text-success bg-success/10' 
                            : 'border-accent text-accent bg-accent/10'
                        }>
                          {member.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {member.invited_at ? new Date(member.invited_at).toLocaleDateString() : '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {member.last_sign_in_at ? new Date(member.last_sign_in_at).toLocaleDateString() : (member.status === 'Active' ? 'Yes' : 'Never')}
                      </TableCell>
                    </>
                  )}
                  {isOrgAdmin && (
                    <TableCell className="text-right space-x-2">
                      {member.status === 'Invited' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-primary hover:text-primary hover:bg-primary/10 gap-1.5"
                          onClick={() => handleResendInvite(member.id)}
                          disabled={resendMutation.isPending}
                        >
                          <Send className="h-4 w-4" />
                          <span className="hidden sm:inline">Resend Invite</span>
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setMemberToRemove(member.id)}
                        disabled={member.id === memberProfile?.id || removeMutation.isPending}
                        title="Remove Member"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {members?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={isOrgAdmin ? 7 : 6} className="h-24 text-center text-muted-foreground">
                    No members found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={!!memberToRemove} onOpenChange={(open) => !open && setMemberToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently remove the member from your organization and completely revoke their authentication access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => memberToRemove && handleRemoveMember(memberToRemove)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={removeMutation.isPending}
            >
              {removeMutation.isPending ? 'Removing...' : 'Remove Member'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
