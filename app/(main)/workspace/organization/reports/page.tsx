'use client';

import { useAuth } from '@/store/AuthContext';
import { ReportView } from '@/components/reports/ReportView';
import { Download } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';

export default function OrganizationReportsPage() {
  const { memberProfile } = useAuth();
  const isOrgAdmin = memberProfile?.organization_role === 'Organization Admin';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Reports</h2>
          <p className="text-sm text-muted-foreground">
            {isOrgAdmin
              ? 'Delivery, contribution and achievements across the organization.'
              : 'Delivery, contribution and achievements on the projects you manage.'}
          </p>
        </div>
        {isOrgAdmin && (
          <a href="/api/v1/organization/export" className={buttonVariants({ variant: 'outline', size: 'sm' })} download>
            <Download className="w-4 h-4 mr-2" /> Export all data (JSON)
          </a>
        )}
      </div>
      <ReportView />
    </div>
  );
}
