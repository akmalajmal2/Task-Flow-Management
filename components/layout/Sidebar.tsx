'use client';

import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Settings,
  Inbox,
  Star,
  Plus,
  Bug,
  Briefcase,
  ChevronRight,
} from 'lucide-react';
import { useListMyWorkspacesQuery } from '@/features/workspaces/workspaceApi';
import { useListBoardsQuery } from '@/features/boards/boardApi';
import { cn } from '@/lib/utils/cn';

export function Sidebar() {
  const pathname = usePathname();
  const params = useParams<{ wsId?: string; boardId?: string }>();
  const wsId = params.wsId;
  const boardId = params.boardId;

  const { data: workspaces = [] } = useListMyWorkspacesQuery();
  const { data: boards = [] } = useListBoardsQuery({ workspaceId: wsId ?? '' }, { skip: !wsId });

  const starredBoards = boards.filter((b) => b.is_starred);
  const activeWs = workspaces.find((w) => w.id === wsId);

  return (
    <aside className="flex w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
      {/* Brand bar — matches the dark navy */}
      <div className="flex h-12 items-center gap-2 border-b border-white/10 px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded bg-sidebar-active text-white shadow-sm">
          <Briefcase className="h-4 w-4" />
        </div>
        <span className="text-sm font-bold tracking-tight">TaskFlow</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <SidebarLink
          href="/dashboard"
          icon={LayoutDashboard}
          label="Dashboard"
          active={pathname === '/dashboard'}
        />
        <SidebarLink
          href="/invitations"
          icon={Inbox}
          label="Invitations"
          active={pathname === '/invitations'}
        />

        {activeWs && (
          <>
            <SectionHeader>{activeWs.name}</SectionHeader>
            <div className="space-y-0.5">
              <SidebarLink
                href={`/workspaces/${wsId}/members`}
                icon={Users}
                label="Members"
                active={pathname === `/workspaces/${wsId}/members`}
              />
              <SidebarLink
                href={`/workspaces/${wsId}/settings`}
                icon={Settings}
                label="Settings"
                active={pathname === `/workspaces/${wsId}/settings`}
              />
            </div>

            {starredBoards.length > 0 && (
              <>
                <SectionHeader icon={Star}>Starred</SectionHeader>
                <div className="space-y-0.5">
                  {starredBoards.map((b) => (
                    <SidebarLink
                      key={b.id}
                      href={`/workspaces/${wsId}/boards/${b.id}`}
                      label={b.name}
                      color={b.color}
                      active={boardId === b.id}
                    />
                  ))}
                </div>
              </>
            )}

            <div className="mt-4 mb-1 flex items-center justify-between px-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-sidebar-muted">
                Boards
              </span>
              <Link
                href={`/workspaces/${wsId}/boards/new`}
                className="rounded p-0.5 text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground"
                aria-label="New board"
              >
                <Plus className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="space-y-0.5">
              {boards.length === 0 ? (
                <p className="px-2 py-1.5 text-xs text-sidebar-muted">No boards yet.</p>
              ) : (
                boards.map((b) => (
                  <SidebarLink
                    key={b.id}
                    href={`/workspaces/${wsId}/boards/${b.id}`}
                    label={b.name}
                    color={b.color}
                    active={boardId === b.id}
                  />
                ))
              )}
            </div>

            {boardId && (
              <>
                <SectionHeader>Board</SectionHeader>
                <div className="space-y-0.5">
                  <SidebarLink
                    href={`/workspaces/${wsId}/boards/${boardId}`}
                    icon={ChevronRight}
                    label="Kanban"
                    active={pathname === `/workspaces/${wsId}/boards/${boardId}`}
                  />
                  <SidebarLink
                    href={`/workspaces/${wsId}/boards/${boardId}/bugs`}
                    icon={Bug}
                    label="Bugs"
                    active={pathname.endsWith('/bugs')}
                  />
                  <SidebarLink
                    href={`/workspaces/${wsId}/boards/${boardId}/settings`}
                    icon={Settings}
                    label="Board settings"
                    active={pathname.endsWith('/settings') && pathname.includes('/boards/')}
                  />
                </div>
              </>
            )}
          </>
        )}
      </nav>

      <div className="border-t border-white/10 p-2 text-[10px] text-sidebar-muted">
        v0.1 · {workspaces.length} workspace{workspaces.length === 1 ? '' : 's'}
      </div>
    </aside>
  );
}

function SectionHeader({
  children,
  icon: Icon,
}: {
  children: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="mt-4 mb-1 flex items-center gap-1.5 px-2 text-[10px] font-bold uppercase tracking-widest text-sidebar-muted">
      {Icon && <Icon className="h-3 w-3" />}
      {children}
    </div>
  );
}

function SidebarLink({
  href,
  icon: Icon,
  label,
  active,
  color,
}: {
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  color?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
        active
          ? 'bg-sidebar-active text-white font-medium shadow-sm'
          : 'text-sidebar-foreground/85 hover:bg-sidebar-hover hover:text-white'
      )}
    >
      {color ? (
        <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: color }} />
      ) : Icon ? (
        <Icon className="h-4 w-4 shrink-0" />
      ) : null}
      <span className="truncate">{label}</span>
    </Link>
  );
}
