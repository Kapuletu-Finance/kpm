'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Building2, 
  FolderKanban, 
  Map, 
  IterationCcw, 
  CheckSquare, 
  MessageSquare,
  Settings,
  Bell
} from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';

const navItems = [
  { name: 'Dashboard', href: '/workspace', icon: LayoutDashboard, exact: true },
  { name: 'Organization', href: '/workspace/organization', icon: Building2 },
  { name: 'Projects', href: '/workspace/projects', icon: FolderKanban },
  { name: 'Collaboration', href: '/workspace/collaboration', icon: MessageSquare },
  { name: 'Notifications', href: '/workspace/notifications', icon: Bell },
];

export function SidebarNavContent() {
  const pathname = usePathname();
  const { data: notifications } = useNotifications();
  const unreadCount = notifications?.filter(n => !n.is_read).length || 0;

  return (
    <>
      {/* Logo Area */}
      <div className="flex items-center h-16 flex-shrink-0 px-6 border-b border-white/10">
        <Link href="/workspace">
          <Image
            src="/logos/kpm/kpm-primary-white.svg"
            alt="KPM by Kapuletu"
            width={120}
            height={36}
            priority
          />
        </Link>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 flex flex-col overflow-y-auto mt-4 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive = item.exact 
            ? pathname === item.href 
            : pathname?.startsWith(item.href);

          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                isActive 
                  ? 'bg-primary text-primary-foreground' 
                  : 'text-secondary-foreground/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon 
                className={`mr-3 h-5 w-5 flex-shrink-0 ${
                  isActive ? 'text-primary-foreground' : 'text-secondary-foreground/70 group-hover:text-white'
                }`} 
                aria-hidden="true" 
              />
              {item.name}
              {item.name === 'Notifications' && unreadCount > 0 && (
                <span className="ml-auto inline-block py-0.5 px-2 text-xs font-semibold rounded-full bg-accent text-accent-foreground">
                  {unreadCount}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Bottom Settings */}
      <div className="flex-shrink-0 p-4 border-t border-white/10">
        <Link
          href="/workspace/settings"
          className="group flex items-center px-3 py-2 text-sm font-medium rounded-md text-secondary-foreground/80 hover:bg-white/10 hover:text-white transition-colors"
        >
          <Settings className="mr-3 h-5 w-5 text-secondary-foreground/70 group-hover:text-white" />
          Settings
        </Link>
      </div>
    </>
  );
}

export function Sidebar() {
  return (
    <div className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-secondary text-secondary-foreground">
      <SidebarNavContent />
    </div>
  );
}
