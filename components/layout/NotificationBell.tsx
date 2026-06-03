'use client';

import Link from 'next/link';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  useListMyNotificationsQuery,
  useMarkAsReadMutation,
  useUnreadCountQuery,
  useMarkAllAsReadMutation,
} from '@/features/notifications/notificationApi';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNotificationsRealtime } from '@/hooks/useRealtime';
import { relativeTime } from '@/lib/utils/dates';
import { cn } from '@/lib/utils/cn';

export function NotificationBell() {
  const { user } = useCurrentUser();
  useNotificationsRealtime(user?.id);

  const { data: count = 0 } = useUnreadCountQuery(undefined, { skip: !user });
  const { data: notifications = [] } = useListMyNotificationsQuery({ limit: 10 });
  const [markRead] = useMarkAsReadMutation();
  const [markAllRead] = useMarkAllAsReadMutation();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {count > 9 ? '9+' : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="flex items-center justify-between border-b p-3">
          <span className="text-sm font-semibold">Notifications</span>
          {count > 0 && (
            <button
              onClick={() => markAllRead()}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">No notifications.</p>
          ) : (
            notifications.map((n) => {
              const unread = !n.read_at;
              const content = (
                <div
                  className={cn(
                    'border-b px-3 py-2.5 text-sm transition-colors hover:bg-accent/30',
                    unread && 'bg-blue-50/60 dark:bg-blue-950/20'
                  )}
                >
                  <div className="flex items-start gap-2">
                    {unread && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{n.title}</p>
                      {n.body && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
                      )}
                      <p className="mt-1 text-[10px] text-muted-foreground">{relativeTime(n.created_at)}</p>
                    </div>
                  </div>
                </div>
              );
              return n.link ? (
                <Link
                  key={n.id}
                  href={n.link}
                  onClick={() => unread && markRead({ notificationId: n.id })}
                >
                  {content}
                </Link>
              ) : (
                <div key={n.id} onClick={() => unread && markRead({ notificationId: n.id })}>
                  {content}
                </div>
              );
            })
          )}
        </div>
        <div className="border-t p-2 text-center">
          <Link href="/notifications" className="text-xs text-primary hover:underline">
            View all
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
