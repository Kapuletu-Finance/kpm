'use client';

import { useState } from 'react';
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from '@/hooks/useNotifications';
import { Bell, Check, Star, CheckCircle2, MessageSquare, Info, Filter } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function NotificationsPage() {
  const [filter, setFilter] = useState('all');
  const [type, setType] = useState('All');

  const { data: notifications, isLoading } = useNotifications(filter, type);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const handleMarkAll = async () => {
    await markAllRead.mutateAsync();
  };

  const getIcon = (t: string | null) => {
    switch (t) {
      case 'Assignment': return <Star className="w-5 h-5 text-orange-500" />;
      case 'Review': return <CheckCircle2 className="w-5 h-5 text-blue-500" />;
      case 'Mention': return <MessageSquare className="w-5 h-5 text-green-500" />;
      default: return <Info className="w-5 h-5 text-muted-foreground" />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Notifications Inbox</h1>
          <p className="text-muted-foreground">Manage your alerts and staying up to date.</p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Select value={filter} onValueChange={(val: string | null) => val && setFilter(val)}>
            <SelectTrigger className="w-[140px]">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4" />
                <SelectValue placeholder="Filter" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="unread">Unread Only</SelectItem>
            </SelectContent>
          </Select>

          <Select value={type} onValueChange={(val: string | null) => val && setType(val)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Types</SelectItem>
              <SelectItem value="Assignment">Assignments</SelectItem>
              <SelectItem value="Review">Reviews</SelectItem>
              <SelectItem value="Mention">Mentions</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={handleMarkAll} disabled={markAllRead.isPending}>
            <Check className="w-4 h-4 mr-2" /> Mark all read
          </Button>
        </div>
      </div>

      <div className="bg-background rounded-xl border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center text-muted-foreground animate-pulse">
            Loading your inbox...
          </div>
        ) : notifications?.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-center text-muted-foreground">
            <div className="bg-muted p-4 rounded-full mb-4">
              <Bell className="w-8 h-8 opacity-50" />
            </div>
            <h3 className="text-lg font-medium text-foreground">You're all caught up!</h3>
            <p className="text-sm mt-1 max-w-sm">
              We couldn't find any notifications matching your filters. When something needs your attention, it will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {notifications?.map(notification => (
              <div 
                key={notification.id} 
                className={`p-6 flex flex-col sm:flex-row gap-4 transition-colors ${!notification.is_read ? 'bg-primary/5' : 'hover:bg-muted/30'}`}
              >
                <div className="mt-1 shrink-0 flex items-start gap-4">
                  <div className="bg-background p-2 border rounded-full shadow-sm">
                    {getIcon(notification.type)}
                  </div>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1">
                    <p className={`text-base ${!notification.is_read ? 'font-semibold text-foreground' : 'font-medium text-foreground/80'}`}>
                      {notification.title}
                    </p>
                    <span className="text-xs font-medium text-muted-foreground whitespace-nowrap bg-muted px-2 py-1 rounded-md">
                      {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  
                  {notification.message && (
                    <p className={`text-sm ${!notification.is_read ? 'text-muted-foreground font-medium' : 'text-muted-foreground/80'}`}>
                      {notification.message}
                    </p>
                  )}
                  
                  {notification.entity_type && (
                    <div className="mt-3 flex items-center gap-2">
                      <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold text-muted-foreground bg-background">
                        {notification.entity_type}
                      </span>
                    </div>
                  )}
                </div>

                {!notification.is_read && (
                  <div className="shrink-0 flex items-center justify-end sm:justify-start mt-4 sm:mt-0">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-muted-foreground hover:text-primary"
                      onClick={() => markRead.mutate(notification.id)}
                      disabled={markRead.isPending}
                    >
                      <Check className="w-4 h-4 mr-2" /> Mark Read
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
