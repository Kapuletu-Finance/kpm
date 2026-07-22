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
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground mt-2">
          Manage your personal profile {isOrgAdmin && 'and workspace configurations'}.
        </p>
      </div>

      <Tabs defaultValue="personal" className="w-full space-y-6">
        <TabsList className="bg-muted border border-border/50">
          <TabsTrigger value="personal" className="gap-2">
            <UserCircle2 className="w-4 h-4" /> Personal Profile
          </TabsTrigger>
          
          {isOrgAdmin && (
            <>
              <TabsTrigger value="general" className="gap-2">
                <Settings className="w-4 h-4" /> Organization Profile
              </TabsTrigger>
              <TabsTrigger value="standards" className="gap-2">
                <ShieldCheck className="w-4 h-4" /> Global Standards
              </TabsTrigger>
              <TabsTrigger value="danger" className="gap-2 text-destructive data-[state=active]:text-destructive">
                <AlertTriangle className="w-4 h-4" /> Danger Zone
              </TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="personal" className="m-0">
          <div className="max-w-4xl">
            <PersonalProfileForm />
          </div>
        </TabsContent>

        {isOrgAdmin && (
          <>
            <TabsContent value="general" className="m-0">
              <div className="max-w-4xl">
                <GeneralSettingsForm organization={organization} />
              </div>
            </TabsContent>

            <TabsContent value="standards" className="m-0">
              <div className="max-w-4xl">
                <StandardsForm standards={standards} />
              </div>
            </TabsContent>

            <TabsContent value="danger" className="m-0">
              <div className="max-w-4xl">
                <DangerZone organization={organization} />
              </div>
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}
