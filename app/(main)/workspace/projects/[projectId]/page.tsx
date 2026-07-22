'use client';

import { useProject } from '@/hooks/useProjects';
import { useProjectTeam } from '@/hooks/useProjectTeam';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Target, Users, TrendingUp, FileText, Image as ImageIcon, ExternalLink, Calendar, Flag, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const Github = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

import { use } from 'react';
import Link from 'next/link';

export default function ProjectOverviewPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const { data: project, isLoading } = useProject(projectId);
  const { data: teamMembers } = useProjectTeam(projectId);

  if (isLoading || !project) return null;

  const hasGoals = project.business_goals?.length > 0;
  const hasUsers = project.target_users?.length > 0;
  const hasMetrics = project.success_metrics?.length > 0;

  const renderEmptyState = (message: string) => (
    <div className="flex items-center justify-center h-32 border border-dashed border-border rounded-lg bg-muted/5">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      
      {/* Metrics & Operational Data */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Timeline</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              {project.start_date ? new Date(project.start_date).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : 'TBD'} 
              {' - '} 
              {project.end_date ? new Date(project.end_date).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : 'TBD'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Expected delivery window</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Priority</CardTitle>
            <Flag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{project.priority}</div>
            <p className="text-xs text-muted-foreground mt-1">Current project priority</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Project Owner</CardTitle>
            <ShieldCheck className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold mt-1">Organization</div>
            <p className="text-xs text-muted-foreground mt-1">Executive Authority</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Project Manager</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-medium shrink-0">
                {project.project_manager?.first_name?.[0]}{project.project_manager?.last_name?.[0]}
              </div>
              <div className="overflow-hidden">
                <div className="text-sm font-medium truncate">{project.project_manager?.first_name} {project.project_manager?.last_name}</div>
                <div className="text-xs text-muted-foreground truncate">{project.project_manager?.email}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        
        {/* Strategic Data */}
        <div className="space-y-6 md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                Business Goals
              </CardTitle>
              <CardDescription>The strategic objectives driving this project.</CardDescription>
            </CardHeader>
            <CardContent>
              {hasGoals ? (
                <ul className="space-y-3">
                  {project.business_goals.map((goal: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-3">
                      <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                      <span className="text-sm leading-relaxed">{goal}</span>
                    </li>
                  ))}
                </ul>
              ) : renderEmptyState('No business goals defined.')}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Target Users
              </CardTitle>
              <CardDescription>Who are we building this for?</CardDescription>
            </CardHeader>
            <CardContent>
              {hasUsers ? (
                <div className="flex flex-wrap gap-2">
                  {project.target_users.map((user: string, idx: number) => (
                    <Badge key={idx} variant="secondary" className="px-3 py-1 text-sm font-medium">
                      {user}
                    </Badge>
                  ))}
                </div>
              ) : renderEmptyState('No target users defined.')}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Success Metrics
              </CardTitle>
              <CardDescription>How we will measure the success of this project.</CardDescription>
            </CardHeader>
            <CardContent>
              {hasMetrics ? (
                <ul className="space-y-3">
                  {project.success_metrics.map((metric: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-muted/10 border border-border/50">
                      <div className="mt-1 w-2 h-2 rounded bg-success shrink-0" />
                      <span className="text-sm font-medium">{metric}</span>
                    </li>
                  ))}
                </ul>
              ) : renderEmptyState('No success metrics defined.')}
            </CardContent>
          </Card>
        </div>

        {/* Resources Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>External Resources</CardTitle>
              <CardDescription>Quick links to project assets.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              
              <a 
                href={project.github_repository || '#'} 
                target="_blank"
                rel="noreferrer"
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${project.github_repository ? 'hover:bg-muted/50 border-border group' : 'opacity-50 pointer-events-none border-dashed'}`}
              >
                <div className="p-2 rounded bg-muted">
                  <Github className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium">GitHub Repository</div>
                  <div className="text-xs text-muted-foreground line-clamp-1">{project.github_repository || 'Not linked'}</div>
                </div>
                {project.github_repository && <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />}
              </a>

              <a 
                href={project.figma_url || '#'} 
                target="_blank"
                rel="noreferrer"
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${project.figma_url ? 'hover:bg-muted/50 border-border group' : 'opacity-50 pointer-events-none border-dashed'}`}
              >
                <div className="p-2 rounded bg-muted">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium">Figma Designs</div>
                  <div className="text-xs text-muted-foreground line-clamp-1">{project.figma_url || 'Not linked'}</div>
                </div>
                {project.figma_url && <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />}
              </a>

              <a 
                href={project.swagger_url || '#'} 
                target="_blank"
                rel="noreferrer"
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${project.swagger_url ? 'hover:bg-muted/50 border-border group' : 'opacity-50 pointer-events-none border-dashed'}`}
              >
                <div className="p-2 rounded bg-muted">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium">API Documentation</div>
                  <div className="text-xs text-muted-foreground line-clamp-1">{project.swagger_url || 'Not linked'}</div>
                </div>
                {project.swagger_url && <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />}
              </a>

            </CardContent>
          </Card>
        {/* Team Members */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  Team
                </CardTitle>
                <CardDescription>
                  {teamMembers?.length ?? 0} member{teamMembers?.length !== 1 ? 's' : ''} assigned
                </CardDescription>
              </div>
              <Link
                href={`/workspace/projects/${projectId}/team`}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                Manage <ExternalLink className="w-3 h-3" />
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {!teamMembers || teamMembers.length === 0 ? (
                <div className="px-6 pb-4 text-sm text-muted-foreground italic">
                  No team members assigned yet.
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {teamMembers.map((member: any) => (
                    <div key={member.id} className="flex items-center justify-between px-6 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Avatar */}
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs shrink-0">
                          {member.members?.first_name?.[0]}{member.members?.last_name?.[0]}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">
                            {member.members?.first_name} {member.members?.last_name}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {member.functional_role || 'General Contributor'}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {member.review_authority && (
                          <span title="Review Authority">
                            <ShieldCheck className="w-3.5 h-3.5 text-success" />
                          </span>
                        )}
                        <Badge
                          variant={member.project_role === 'Project Manager' ? 'default' : 'secondary'}
                          className="text-[10px] px-1.5 py-0"
                        >
                          {member.project_role}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

        </div>

      </div>
    </div>
  );
}
