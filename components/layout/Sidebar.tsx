'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Building2, 
  FolderKanban, 
  MessageSquare,
  Settings,
  Bell,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { Button } from '@/components/ui/button';

const navItems = [
  { name: 'Dashboard', href: '/workspace', icon: LayoutDashboard, exact: true },
  { name: 'Organization', href: '/workspace/organization', icon: Building2 },
  { name: 'Projects', href: '/workspace/projects', icon: FolderKanban },
  { name: 'Collaboration', href: '/workspace/collaboration', icon: MessageSquare },
  { name: 'Notifications', href: '/workspace/notifications', icon: Bell },
];

export function SidebarNavContent({ isCollapsed = false }: { isCollapsed?: boolean }) {
  const pathname = usePathname();
  const { data: notifications } = useNotifications();
  const unreadCount = notifications?.filter(n => !n.is_read).length || 0;

  return (
    <>
      {/* Logo Area */}
      <div className={`flex items-center h-16 flex-shrink-0 border-b border-white/10 ${isCollapsed ? 'justify-center px-2' : 'px-6'}`}>
        <Link href="/workspace" className="flex items-center">
          {isCollapsed ? (
            <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center font-bold text-primary-foreground">
              K
            </div>
          ) : (
            <Image
              src="/logos/kpm/kpm-primary-white.svg"
              alt="KPM by Kapuletu"
              width={120}
              height={36}
              priority
            />
          )}
        </Link>
      </div>

      {/* Navigation Links */}
      <div className={`flex-1 flex flex-col overflow-y-auto mt-4 space-y-1 ${isCollapsed ? 'px-2' : 'px-3'}`}>
        {navItems.map((item) => {
          const isActive = item.exact 
            ? pathname === item.href 
            : pathname?.startsWith(item.href);

          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              title={isCollapsed ? item.name : undefined}
              className={`group flex items-center py-2 text-sm font-medium rounded-md transition-colors ${
                isCollapsed ? 'justify-center px-0' : 'px-3'
              } ${
                isActive 
                  ? 'bg-primary text-primary-foreground' 
                  : 'text-secondary-foreground/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon 
                className={`flex-shrink-0 h-5 w-5 ${
                  isActive ? 'text-primary-foreground' : 'text-secondary-foreground/70 group-hover:text-white'
                } ${!isCollapsed && 'mr-3'}`} 
                aria-hidden="true" 
              />
              {!isCollapsed && <span>{item.name}</span>}
              {!isCollapsed && item.name === 'Notifications' && unreadCount > 0 && (
                <span className="ml-auto inline-block py-0.5 px-2 text-xs font-semibold rounded-full bg-accent text-accent-foreground">
                  {unreadCount}
                </span>
              )}
              {isCollapsed && item.name === 'Notifications' && unreadCount > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-accent rounded-full"></span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Bottom Settings */}
      <div className={`flex-shrink-0 border-t border-white/10 ${isCollapsed ? 'p-2' : 'p-4'}`}>
        <Link
          href="/workspace/settings"
          title={isCollapsed ? 'Settings' : undefined}
          className={`group flex items-center py-2 text-sm font-medium rounded-md text-secondary-foreground/80 hover:bg-white/10 hover:text-white transition-colors ${
            isCollapsed ? 'justify-center px-0' : 'px-3'
          }`}
        >
          <Settings className={`flex-shrink-0 h-5 w-5 text-secondary-foreground/70 group-hover:text-white ${!isCollapsed && 'mr-3'}`} />
          {!isCollapsed && 'Settings'}
        </Link>
      </div>
    </>
  );
}

interface SidebarProps {
  isCollapsed?: boolean;
  onToggle?: () => void;
}

export function Sidebar({ isCollapsed = false, onToggle }: SidebarProps) {
  return (
    <div className={`hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 bg-secondary text-secondary-foreground transition-all duration-300 ${isCollapsed ? 'lg:w-20' : 'lg:w-64'}`}>
      <SidebarNavContent isCollapsed={isCollapsed} />
      
      {/* Collapse Toggle Button */}
      {onToggle && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="absolute -right-4 top-20 h-8 w-8 rounded-full border shadow-sm bg-background hover:bg-muted text-foreground z-50"
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      )}
    </div>
  );
}
