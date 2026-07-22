'use client';

import { useAuth } from '@/store/AuthContext';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuGroup,
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetTrigger, SheetContent } from '@/components/ui/sheet';
import { SidebarNavContent } from '@/components/layout/Sidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useRouter } from 'next/navigation';
import { Search, Menu } from 'lucide-react';
import { toast } from 'sonner';

export function Header() {
  const { user, memberProfile } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST' });
      // Full hard reload to clear all states and caches
      window.location.href = '/login';
    } catch (error) {
      toast.error('Failed to log out');
    }
  };

  const userInitials = memberProfile?.first_name 
    ? `${memberProfile.first_name[0]}${memberProfile.last_name ? memberProfile.last_name[0] : ''}`
    : 'U';

  const roleColor = memberProfile?.organization_role === 'Organization Admin' 
    ? 'text-accent' // Kapuletu Orange for Admin
    : 'text-muted-foreground';

  return (
    <header className="sticky top-0 z-10 flex h-16 flex-shrink-0 items-center gap-x-4 border-b border-border bg-background px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
      {/* Mobile Menu */}
      <Sheet>
        <SheetTrigger render={
          <button type="button" className="-m-2.5 p-2.5 text-muted-foreground lg:hidden">
            <span className="sr-only">Open sidebar</span>
            <Menu className="h-6 w-6" aria-hidden="true" />
          </button>
        } />
        <SheetContent side="left" className="w-64 p-0 bg-secondary text-secondary-foreground border-none">
          <div className="flex flex-col h-full">
            <SidebarNavContent />
          </div>
        </SheetContent>
      </Sheet>

      {/* Separator for mobile */}
      <div className="h-6 w-px bg-border lg:hidden" aria-hidden="true" />

      <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
        <form className="relative flex flex-1" action="#" method="GET">
          <label htmlFor="search-field" className="sr-only">
            Search
          </label>
          <Search
            className="pointer-events-none absolute inset-y-0 left-0 h-full w-5 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            id="search-field"
            className="block h-full w-full border-0 bg-transparent py-0 pl-8 pr-0 text-foreground placeholder:text-muted-foreground focus:ring-0 sm:text-sm"
            placeholder="Search projects, tasks, or members..."
            type="search"
            name="search"
          />
        </form>
        <div className="flex items-center gap-x-4 lg:gap-x-6">
          
          <div className="hidden lg:block lg:h-6 lg:w-px lg:bg-border" aria-hidden="true" />

          {/* Profile dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" className="relative flex items-center gap-x-3 rounded-full hover:bg-muted/50 focus:ring-0 px-2 h-10">
                  <span className="sr-only">Open user menu</span>
                  <Avatar className="h-8 w-8 bg-primary/10">
                    <AvatarFallback className="text-primary font-medium text-xs">{userInitials}</AvatarFallback>
                  </Avatar>
                  <span className="hidden lg:flex lg:items-center">
                    <span className="ml-2 text-sm font-semibold leading-6 text-foreground" aria-hidden="true">
                      {memberProfile?.first_name} {memberProfile?.last_name}
                    </span>
                  </span>
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-56 mt-2">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{memberProfile?.first_name} {memberProfile?.last_name}</p>
                    <p className="text-xs leading-none text-muted-foreground mt-1">{user?.email}</p>
                    <p className={`text-xs font-semibold leading-none mt-2 ${roleColor}`}>
                      {memberProfile?.organization_role || 'Member'}
                    </p>
                  </div>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/workspace/profile')}>
                My Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/workspace/organization')}>
                Organization Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
