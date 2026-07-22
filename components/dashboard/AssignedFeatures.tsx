'use client';

import { DashboardFeature } from '@/hooks/useDashboard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, isPast } from 'date-fns';
import Link from 'next/link';

export function AssignedFeatures({ features }: { features: DashboardFeature[] }) {
  if (!features || features.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Assigned Features</CardTitle>
          <CardDescription>Features currently assigned to you</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-48 border-t border-border/50 bg-muted/10">
          <p className="text-sm text-muted-foreground">No features assigned to you yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Assigned Features</CardTitle>
        <CardDescription>Features currently assigned to you</CardDescription>
      </CardHeader>
      <CardContent className="p-0 border-t border-border/50">
        <div className="divide-y divide-border/50">
          {features.map(feature => {
            const isOverdue = feature.due_date && isPast(new Date(feature.due_date));
            return (
              <Link 
                key={feature.id} 
                href={`/workspace/projects/${feature.project_id}/features/${feature.id}`}
                className="block hover:bg-muted/30 transition-colors p-4"
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="font-medium text-sm text-foreground">{feature.title}</span>
                    <span className="text-xs text-muted-foreground">Project: {feature.project_name}</span>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant="outline" className="text-[10px]">{feature.status}</Badge>
                    {feature.due_date && (
                      <span className={`text-[10px] ${isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                        {isOverdue ? 'Overdue: ' : 'Due: '}
                        {format(new Date(feature.due_date), 'MMM d')}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
