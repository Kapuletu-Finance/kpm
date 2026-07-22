'use client';

import { useState } from 'react';
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Bell, Check, CheckCircle2, MessageSquare, Info, Star } from 'lucide-react';
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from '@/hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';

export function NotificationsPopover() {
  const { data: notifications, isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const [open, setOpen] = useState(false);

  const unreadCount = notifications?.filter(n => !n.is_read).length || 0;

  const handleMarkAll = async () => {
    if (unreadCount === 0) return;
    await markAllRead.mutateAsync();
  };

  const getIcon = (type: string | null) => {
    switch (type) {
      case 'Assignment': return <Star className="w-4 h-4 text-orange-500" />;
      case 'Review': return <CheckCircle2 className="w-4 h-4 text-blue-500" />;
      case 'Mention': return <MessageSquare className="w-4 h-4 text-green-500" />;
      default: return <Info className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="relative flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-full h-10 w-10 outline-none">
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-accent border-2 border-background" />
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-0 rounded-xl shadow-lg border-border/50">
        <div className="flex items-center justify-between p-4 border-b">
          <h4 className="font-semibold text-sm">Notifications</h4>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-xs h-8 text-muted-foreground hover:text-primary"
              onClick={handleMarkAll}
              disabled={markAllRead.isPending}
            >
              <Check className="w-3 h-3 mr-1" /> Mark all as read
            </Button>
          )}
        </div>
        
        <div className="max-h-[400px] overflow-y-auto">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground animate-pulse">
              Loading notifications...
            </div>
          ) : notifications?.length === 0 ? (
            <div className="p-8 flex flex-col items-center justify-center text-center text-muted-foreground">
              <Bell className="w-8 h-8 mb-3 opacity-20" />
              <p className="text-sm">You're all caught up!</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications?.map(notification => (
                <div 
                  key={notification.id} 
                  className={`p-4 flex gap-3 transition-colors ${!notification.is_read ? 'bg-primary/5' : 'hover:bg-muted/30'}`}
                >
                  <div className="mt-0.5 shrink-0">
                    <div className="bg-background p-1.5 border rounded-full shadow-sm">
                      {getIcon(notification.type)}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${!notification.is_read ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground'}`}>
                      {notification.title}
                    </p>
                    {notification.message && (
                      <p className={`text-sm mt-1 line-clamp-2 ${!notification.is_read ? 'text-muted-foreground' : 'text-muted-foreground/70'}`}>
                        {notification.message}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground/60 mt-2">
                      {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  {!notification.is_read && (
                    <div className="shrink-0 flex items-start">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 text-muted-foreground/50 hover:text-primary rounded-full"
                        title="Mark as read"
                        onClick={(e) => {
                          e.stopPropagation();
                          markRead.mutate(notification.id);
                        }}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
