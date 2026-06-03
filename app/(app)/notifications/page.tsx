'use client';

import Link from 'next/link';
import { Bell } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  useListMyNotificationsQuery,
  useMarkAllAsReadMutation,
  useMarkAsReadMutation,
} from '@/features/notifications/notificationApi';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNotificationsRealtime } from '@/hooks/useRealtime';
import { relativeTime } from '@/lib/utils/dates';
import { cn } from '@/lib/utils/cn';

export default function NotificationsPage() {
  const { user } = useCurrentUser();
  useNotificationsRealtime(user?.id);
  const { data: notifications = [], isLoading } = useListMyNotificationsQuery({ limit: 100 });
  const [markAllRead] = useMarkAllAsReadMutation();
  const [markRead] = useMarkAsReadMutation();

  return (
    <div className="container mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Notifications</h1>
        {notifications.some((n) => !n.read_at) && (
          <Button variant="outline" size="sm" onClick={() => markAllRead()}>
            Mark all read
          </Button>
        )}
      </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : notifications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-muted-foreground">
            <Bell className="mb-3 h-10 w-10" />
            <p>No notifications yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const unread = !n.read_at;
            const content = (
              <div
                className={cn(
                  'flex items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-accent/40',
                  unread && 'bg-blue-50/60 dark:bg-blue-950/20'
                )}
              >
                {unread && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{n.title}</p>
                  {n.body && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
                  )}
                  <p className="mt-1 text-[10px] text-muted-foreground">{relativeTime(n.created_at)}</p>
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
              <div
                key={n.id}
                onClick={() => unread && markRead({ notificationId: n.id })}
                className="cursor-pointer"
              >
                {content}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
