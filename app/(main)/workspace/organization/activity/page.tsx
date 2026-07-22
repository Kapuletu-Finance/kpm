'use client';

import { useOrganizationActivity } from '@/hooks/useActivity';
import { ActivityTimeline } from '@/components/projects/ActivityTimeline';
import { Loader2 } from 'lucide-react';

export default function OrganizationActivityPage() {
  const { data, isLoading, error } = useOrganizationActivity();

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-destructive/10 text-destructive rounded-lg max-w-4xl mx-auto mt-6">
        Failed to load organization activity logs: {error.message}
      </div>
    );
  }

  return (
    <div className="max-w-4xl py-2 space-y-6">

      <div className="bg-background rounded-xl border shadow-sm p-6">
        <ActivityTimeline logs={data?.data || []} />
      </div>
    </div>
  );
}
