'use client';

import { useAuth } from '@/store/AuthContext';
import { useOrganization, useOrganizationStandards } from '@/hooks/useOrganization';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GeneralSettingsForm } from '@/components/organization/settings/GeneralSettingsForm';
import { StandardsForm } from '@/components/organization/settings/StandardsForm';
import { PersonalProfileForm } from '@/components/organization/settings/PersonalProfileForm';
import { DangerZone } from '@/components/organization/settings/DangerZone';
import { Settings, ShieldCheck, UserCircle2, AlertTriangle, Loader2 } from 'lucide-react';

export default function WorkspaceSettingsPage() {
  const { memberProfile } = useAuth();
  const { data: organization, isLoading: isLoadingOrg } = useOrganization();
  const { data: standards, isLoading: isLoadingStandards } = useOrganizationStandards();

  if (isLoadingOrg || isLoadingStandards) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const isOrgAdmin = memberProfile?.organization_role === 'Organization Admin';

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Settings</h2>
        <p className="text-muted-foreground mt-2">
          Manage your personal profile {isOrgAdmin && 'and workspace configurations'}.
        </p>
      </div>

      <Tabs defaultValue="personal" className="w-full space-y-6">
        <TabsList className={`bg-muted border border-border/50 grid w-full ${isOrgAdmin ? 'grid-cols-4' : 'grid-cols-1'} md:w-fit md:flex`}>
          <TabsTrigger value="personal" className="flex items-center gap-2">
            <UserCircle2 className="w-4 h-4" />
            <span className="hidden sm:inline">Personal Profile</span>
          </TabsTrigger>
          
          {isOrgAdmin && (
            <>
              <TabsTrigger value="general" className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Organization Profile</span>
              </TabsTrigger>
              <TabsTrigger value="standards" className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                <span className="hidden sm:inline">Global Standards</span>
              </TabsTrigger>
              <TabsTrigger value="danger" className="flex items-center gap-2 text-destructive data-[state=active]:text-destructive">
                <AlertTriangle className="w-4 h-4" />
                <span className="hidden sm:inline">Danger Zone</span>
              </TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="personal" className="m-0 outline-none">
          <PersonalProfileForm />
        </TabsContent>

        {isOrgAdmin && (
          <>
            <TabsContent value="general" className="m-0 outline-none">
              <GeneralSettingsForm organization={organization} />
            </TabsContent>

            <TabsContent value="standards" className="m-0 outline-none">
              <StandardsForm standards={standards} />
            </TabsContent>

            <TabsContent value="danger" className="m-0 outline-none">
              <DangerZone organization={organization} />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}
