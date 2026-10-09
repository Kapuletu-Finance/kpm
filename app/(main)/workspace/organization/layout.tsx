'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Building2, Users, Activity, ClipboardCheck, BarChart3 } from 'lucide-react';
import { useAuth } from '@/store/AuthContext';

export default function OrganizationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { memberProfile } = useAuth();
  const isOrgAdmin = memberProfile?.organization_role === 'Organization Admin';
  // Oversight tabs: admins see the whole org, Project Managers the projects they manage
  const canOversee = isOrgAdmin || memberProfile?.organization_role === 'Project Manager';

  const tabs = [
    { name: isOrgAdmin ? 'Members' : 'Directory', href: '/workspace/organization', icon: Users, exact: true },
  ];

  if (canOversee) {
    tabs.push({ name: 'Daily Standups', href: '/workspace/organization/standups', icon: ClipboardCheck, exact: false });
    tabs.push({ name: 'Reports', href: '/workspace/organization/reports', icon: BarChart3, exact: false });
  }
  if (isOrgAdmin) {
    tabs.push({ name: 'Audit Trail', href: '/workspace/organization/activity', icon: Activity, exact: false });
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
            ? 'Manage members, follow daily submissions, and report on everything happening across the organization.'
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
