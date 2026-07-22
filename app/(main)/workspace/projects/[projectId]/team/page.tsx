'use client';

import { use } from 'react';
import { useState } from 'react';
import { useAuth } from '@/store/AuthContext';
import { useProjectTeam, useRemoveProjectMember, useUpdateProjectMember } from '@/hooks/useProjectTeam';
import { AddTeamMemberDialog } from '@/components/projects/AddTeamMemberDialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Plus, ShieldCheck, Shield, Trash2, Edit } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';

export default function ProjectTeamPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const { memberProfile } = useAuth();
  const { data: teamMembers, isLoading } = useProjectTeam(projectId);
  const removeMutation = useRemoveProjectMember(projectId);
  const updateMutation = useUpdateProjectMember(projectId);

  const [isAddOpen, setIsAddOpen] = useState(false);

  if (isLoading) {
    return <div className="animate-pulse space-y-6">
      <div className="h-8 bg-muted rounded w-1/4"></div>
      <div className="h-[400px] bg-muted rounded-xl"></div>
    </div>;
  }

  const isAdmin = memberProfile?.organization_role === 'Organization Admin';
  const isPM = teamMembers?.some((m: any) => m.member_id === memberProfile?.id && m.project_role === 'Project Manager');
  const canManage = isAdmin || isPM;

  const handleRemove = async (memberId: string) => {
    if (confirm('Are you sure you want to remove this member from the project?')) {
      try {
        await removeMutation.mutateAsync(memberId);
        toast.success('Member removed successfully');
      } catch (error: any) {
        toast.error(error.message || 'Failed to remove member');
      }
    }
  };

  const handleToggleReviewAuthority = async (member: any) => {
    try {
      await updateMutation.mutateAsync({
        memberId: member.member_id,
        review_authority: !member.review_authority
      });
      toast.success('Review authority updated');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update review authority');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            Project Team
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage the people assigned to this project and define their responsibilities.
          </p>
        </div>
        
        {canManage && (
          <Button onClick={() => setIsAddOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Add Member
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Team Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teamMembers?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Project Managers</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teamMembers?.filter((m: any) => m.project_role === 'Project Manager').length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Review Authorities</CardTitle>
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teamMembers?.filter((m: any) => m.review_authority).length || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Team Roster</CardTitle>
          <CardDescription>
            A detailed list of everyone assigned to this project and what they are accountable for.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Functional Role & Responsibilities</TableHead>
                <TableHead>Access Level</TableHead>
                <TableHead className="text-center">Reviewer</TableHead>
                {canManage && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamMembers?.map((member: any) => {
                const responsibilities = member.role_responsibilities ? (typeof member.role_responsibilities === 'string' ? JSON.parse(member.role_responsibilities) : member.role_responsibilities) : [];
                
                return (
                  <TableRow key={member.id} className="group">
                    <TableCell>
                      <div className="font-medium">
                        {member.members?.first_name} {member.members?.last_name}
                      </div>
                      <div className="text-sm text-muted-foreground">{member.members?.email}</div>
                      {member.members?.status === 'Invited' && (
                        <Badge variant="outline" className="mt-1 text-[10px] border-accent text-accent">Pending Invite</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-foreground">{member.functional_role || 'General Contributor'}</div>
                      {responsibilities.length > 0 && (
                        <ul className="mt-1 space-y-1 list-none p-0 m-0">
                          {responsibilities.map((resp: string, idx: number) => (
                            <li key={idx} className="text-xs text-muted-foreground flex items-start">
                              <span className="mr-1.5 mt-0.5 text-primary/70">•</span>
                              <span>{resp}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={member.project_role === 'Project Manager' ? 'default' : 'secondary'} className={member.project_role === 'Project Manager' ? 'bg-primary text-primary-foreground' : ''}>
                        {member.project_role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {member.review_authority ? (
                        <ShieldCheck className="w-5 h-5 text-success mx-auto" />
                      ) : (
                        <span className="text-muted-foreground/30">-</span>
                      )}
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleReviewAuthority(member)}
                            disabled={updateMutation.isPending}
                            title={member.review_authority ? 'Revoke Review Authority' : 'Grant Review Authority'}
                          >
                            <ShieldCheck className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemove(member.member_id)}
                            disabled={removeMutation.isPending || (member.project_role === 'Project Manager' && member.member_id === memberProfile?.id)}
                            title="Remove from Project"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
              {teamMembers?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={canManage ? 5 : 4} className="text-center h-32 text-muted-foreground">
                    No team members found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AddTeamMemberDialog 
        projectId={projectId} 
        open={isAddOpen} 
        onOpenChange={setIsAddOpen} 
      />
    </div>
  );
}
