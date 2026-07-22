'use client';

import { usePathname } from 'next/navigation';
import { use } from 'react';
import Link from 'next/link';
import { useProject } from '@/hooks/useProjects';
import { useAuth } from '@/store/AuthContext';
import { Loader2, ArrowLeft, LayoutDashboard, Users, Route, Settings2, Timer } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const pathname = usePathname();
  const { projectId } = use(params);
  const { data: project, isLoading, error } = useProject(projectId);
  const { memberProfile } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center gap-4">
        <h2 className="text-2xl font-bold">Project Not Found</h2>
        <p className="text-muted-foreground">You may not have access to this project.</p>
        <Link href="/workspace/projects" className={buttonVariants({ variant: "outline" })}>
          Back to Projects
        </Link>
      </div>
    );
  }

  const isManagerOrAdmin = 
    memberProfile?.organization_role === 'Organization Admin' || 
    project.project_manager_id === memberProfile?.id;

  const tabs = [
    { name: 'Overview', href: `/workspace/projects/${project.id}`, icon: LayoutDashboard },
    { name: 'Sprints', href: `/workspace/projects/${project.id}/sprints`, icon: Timer },
    { name: 'Roadmap', href: `/workspace/projects/${project.id}/roadmap`, icon: Route },
    { name: 'Team', href: `/workspace/projects/${project.id}/team`, icon: Users },
  ];

  if (isManagerOrAdmin) {
    tabs.push({ name: 'Settings', href: `/workspace/projects/${project.id}/settings`, icon: Settings2 });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
        <Link href="/workspace/projects" className="hover:text-foreground flex items-center gap-1 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Projects
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">{project.name}</span>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
              {project.status}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-2 max-w-3xl">
            {project.description}
          </p>
        </div>
      </div>

      <div className="border-b border-border">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href;
            const Icon = tab.icon;
            return (
              <Link
                key={tab.name}
                href={tab.href}
                className={`
                  whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors
                  ${isActive 
                    ? 'border-primary text-primary' 
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                {tab.name}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="py-4">
        {children}
      </div>
    </div>
  );
}
