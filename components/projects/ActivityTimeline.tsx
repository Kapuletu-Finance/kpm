'use client';

import { ActivityLog } from '@/hooks/useActivity';
import { formatDistanceToNow } from 'date-fns';
import { 
  Plus, 
  Pencil, 
  Trash2, 
  UserPlus, 
  CheckSquare, 
  Rocket, 
  Activity,
  FileText
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

function getActionIcon(action: string, entityType: string) {
  if (action === 'Created') return <Plus className="w-4 h-4 text-green-500" />;
  if (action === 'Updated') return <Pencil className="w-4 h-4 text-blue-500" />;
  if (action === 'Deleted') return <Trash2 className="w-4 h-4 text-red-500" />;
  if (action === 'Assigned') return <UserPlus className="w-4 h-4 text-orange-500" />;
  if (action === 'Reviewed') return <CheckSquare className="w-4 h-4 text-purple-500" />;
  if (entityType === 'Release') return <Rocket className="w-4 h-4 text-indigo-500" />;
  if (entityType === 'Deliverable') return <FileText className="w-4 h-4 text-teal-500" />;
  
  return <Activity className="w-4 h-4 text-muted-foreground" />;
}

function getInitials(firstName?: string, lastName?: string) {
  if (!firstName && !lastName) return '??';
  return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
}

export function ActivityTimeline({ logs }: { logs: ActivityLog[] }) {
  if (!logs || logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border rounded-xl bg-muted/20 border-dashed">
        <Activity className="w-10 h-10 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">No activity yet</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          When actions are taken in this workspace, they will be recorded here for auditing.
        </p>
      </div>
    );
  }

  return (
    <div className="relative border-l border-border ml-4 space-y-8 py-4">
      {logs.map((log) => (
        <div key={log.id} className="relative pl-8 group">
          {/* Timeline Dot/Icon */}
          <div className="absolute -left-4 top-1 w-8 h-8 rounded-full bg-background border flex items-center justify-center shadow-sm">
            {getActionIcon(log.action, log.entity_type)}
          </div>
          
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-1">
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={log.member?.avatar_url || ''} alt={log.member?.first_name || 'User'} />
                <AvatarFallback className="text-[10px]">{getInitials(log.member?.first_name, log.member?.last_name)}</AvatarFallback>
              </Avatar>
              <span className="font-semibold text-sm">
                {log.member?.first_name} {log.member?.last_name}
              </span>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="bg-muted px-2 py-0.5 rounded-md text-xs font-medium border border-border/50">
                {log.action}
              </span>
              <span>{log.entity_type}</span>
              <span className="text-xs ml-auto sm:ml-2">
                {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
              </span>
            </div>
          </div>

          <div className="bg-muted/30 border border-border/50 rounded-lg p-3 mt-2 text-sm text-foreground/80">
            {log.description || `${log.action} ${log.entity_type}`}
            
            {log.project && (
              <div className="mt-2 text-xs font-medium text-muted-foreground flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-primary/40 inline-block mr-1"></span>
                Project: {log.project.name}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
