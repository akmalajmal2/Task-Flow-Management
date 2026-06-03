'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ChevronDown, LogOut, User as UserIcon, Bell as BellIcon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { NotificationBell } from './NotificationBell';
import { useListMyWorkspacesQuery } from '@/features/workspaces/workspaceApi';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { createClient } from '@/lib/supabase/client';

export function Header() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const { data: workspaces = [] } = useListMyWorkspacesQuery();
  const { wsId } = useParams<{ wsId?: string }>();
  const currentWs = workspaces.find((w) => w.id === wsId);

  const onLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b bg-card px-4">
      <div className="flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="-ml-2 h-8 gap-1.5 text-sm font-semibold">
              <span>{currentWs?.name ?? 'Select workspace'}</span>
              <ChevronDown className="h-3.5 w-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[16rem]">
            <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Switch workspace
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {workspaces.map((w) => (
              <DropdownMenuItem key={w.id} asChild>
                <Link href={`/workspaces/${w.id}`}>
                  <span className="flex-1 truncate">{w.name}</span>
                  <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase">
                    {w.role}
                  </span>
                </Link>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/dashboard" className="text-primary">+ New workspace</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-1">
        <ThemeToggle />
        <NotificationBell />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
              <UserAvatar name={user?.full_name} src={user?.avatar_url} className="h-7 w-7" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[14rem]">
            <DropdownMenuLabel className="flex flex-col">
              <span className="text-sm">{user?.full_name ?? 'User'}</span>
              <span className="text-[11px] font-normal text-muted-foreground">{user?.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/account" className="gap-2">
                <UserIcon className="h-4 w-4" /> Account
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/notifications" className="gap-2">
                <BellIcon className="h-4 w-4" /> All notifications
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={onLogout}
              className="gap-2 text-destructive focus:text-destructive"
            >
              <LogOut className="h-4 w-4" /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
