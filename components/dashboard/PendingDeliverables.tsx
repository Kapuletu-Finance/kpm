'use client';

import { DashboardDeliverable } from '@/hooks/useDashboard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, isPast } from 'date-fns';
import { FileText } from 'lucide-react';

export function PendingDeliverables({ deliverables }: { deliverables: DashboardDeliverable[] }) {
  if (!deliverables || deliverables.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Pending Deliverables</CardTitle>
          <CardDescription>Deliverables awaiting your submission or review</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center h-48 border-t border-border/50 bg-muted/10">
          <FileText className="w-8 h-8 text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">All caught up!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Pending Deliverables</CardTitle>
        <CardDescription>Deliverables awaiting your submission or review</CardDescription>
      </CardHeader>
      <CardContent className="p-0 border-t border-border/50">
        <div className="divide-y divide-border/50">
          {deliverables.map(deliverable => {
            const isOverdue = deliverable.due_date && isPast(new Date(deliverable.due_date));
            return (
              <div 
                key={deliverable.id} 
                className="flex justify-between items-start gap-4 p-4 hover:bg-muted/30 transition-colors"
              >
                <div className="flex flex-col gap-1">
                  <span className="font-medium text-sm text-foreground flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    {deliverable.title}
                  </span>
                  <span className="text-xs text-muted-foreground ml-6">For: {deliverable.entity_type}</span>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge variant="outline" className="text-[10px]">{deliverable.status}</Badge>
                  {deliverable.due_date && (
                    <span className={`text-[10px] ${isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                      {isOverdue ? 'Overdue: ' : 'Due: '}
                      {format(new Date(deliverable.due_date), 'MMM d')}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
