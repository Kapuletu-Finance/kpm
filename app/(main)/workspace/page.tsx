'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/store/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MyWorkspace } from '@/components/dashboard/MyWorkspace';
import { ProjectPortfolio } from '@/components/dashboard/ProjectPortfolio';
import { OrganizationOverview } from '@/components/dashboard/OrganizationOverview';

export default function WorkspaceDashboard() {
  const { memberProfile } = useAuth();
  const role = memberProfile?.organization_role;

  const [activeTab, setActiveTab] = useState<string | null>(null);

  // Set the initial tab once role is known, then leave it to user interaction
  useEffect(() => {
    if (role === undefined || activeTab !== null) return;
    if (role === 'Organization Admin') {
      setActiveTab('org-overview');
    } else if (role === 'Project Manager') {
      setActiveTab('portfolio');
    } else {
      setActiveTab('my-workspace');
    }
  }, [role, activeTab]);

  // While role is unknown, fall back to 'my-workspace' so Tabs always has a value
  const tabValue = activeTab ?? 'my-workspace';

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">
          Dashboard
        </h2>
        <p className="text-muted-foreground mt-2">
          Welcome back, {memberProfile?.first_name}. Here is an overview of your workspace.
        </p>
      </div>

      <Tabs value={tabValue} onValueChange={setActiveTab} className="w-full space-y-6">
        <TabsList className="bg-muted border border-border/50">
          {role === 'Organization Admin' && (
            <TabsTrigger value="org-overview">Organization Overview</TabsTrigger>
          )}
          {(role === 'Organization Admin' || role === 'Project Manager') && (
            <TabsTrigger value="portfolio">Project Portfolio</TabsTrigger>
          )}
          <TabsTrigger value="my-workspace">My Workspace</TabsTrigger>
        </TabsList>

        {role === 'Organization Admin' && (
          <TabsContent value="org-overview" className="mt-0 outline-none">
            <OrganizationOverview />
          </TabsContent>
        )}

        {(role === 'Organization Admin' || role === 'Project Manager') && (
          <TabsContent value="portfolio" className="mt-0 outline-none">
            <ProjectPortfolio />
          </TabsContent>
        )}

        <TabsContent value="my-workspace" className="mt-0 outline-none">
          <MyWorkspace />
        </TabsContent>
      </Tabs>
    </div>
  );
}
