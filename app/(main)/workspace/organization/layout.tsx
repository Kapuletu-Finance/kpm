'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Building2, Users, Activity } from 'lucide-react';
import { useAuth } from '@/store/AuthContext';

export default function OrganizationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { memberProfile } = useAuth();
  const isOrgAdmin = memberProfile?.organization_role === 'Organization Admin';

  const tabs = [
    { name: 'Members', href: '/workspace/organization', icon: Users, exact: true },
  ];

  if (isOrgAdmin) {
    tabs.push({ name: 'Recent Activities', href: '/workspace/organization/activity', icon: Activity, exact: false });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
          {isOrgAdmin ? <Building2 className="h-8 w-8 text-primary" /> : <Users className="h-8 w-8 text-primary" />}
          {isOrgAdmin ? 'Organization' : 'People'}
        </h1>
        <p className="text-muted-foreground mt-2">
          {isOrgAdmin 
            ? 'Manage your workspace members and view organization-wide recent activities.'
            : 'View team members and your colleagues across the workspace.'}
        </p>
      </div>

      <div className="flex space-x-1 border-b border-border/50 pb-px overflow-x-auto custom-scrollbar">
        {tabs.map((tab) => {
          const isActive = tab.exact ? pathname === tab.href : pathname?.startsWith(tab.href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.name}
              href={tab.href}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.name}
            </Link>
          );
        })}
      </div>

      <div className="pt-4">
        {children}
      </div>
    </div>
  );
}
