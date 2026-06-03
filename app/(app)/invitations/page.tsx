'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Inbox, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useConfirm } from '@/components/shared/ConfirmDialog';
import {
  useAcceptInvitationMutation,
  useDeclineInvitationMutation,
  useListMyPendingQuery,
} from '@/features/invitations/invitationApi';
import { relativeTime } from '@/lib/utils/dates';
import { ROLE_LABELS } from '@/lib/constants';

export default function InvitationsPage() {
  const router = useRouter();
  const { data: invitations = [], isLoading } = useListMyPendingQuery();
  const [accept, { isLoading: accepting }] = useAcceptInvitationMutation();
  const [decline, { isLoading: declining }] = useDeclineInvitationMutation();
  const confirm = useConfirm();

  const onAccept = async (token: string) => {
    const ok = await confirm({
      title: 'Accept this invitation?',
      description: 'You will be added to the workspace and gain access to its content.',
      confirmText: 'Accept',
    });
    if (!ok) return;
    try {
      const res = await accept({ token }).unwrap();
      toast.success('Invitation accepted');
      if (res.workspace_id) router.push(`/workspaces/${res.workspace_id}`);
    } catch {
      /* toasted */
    }
  };

  const onReject = async (token: string) => {
    const ok = await confirm({
      title: 'Reject this invitation?',
      confirmText: 'Reject',
      destructive: true,
    });
    if (!ok) return;
    await decline({ token }).unwrap();
    toast.success('Invitation rejected');
  };

  return (
    <div className="container mx-auto max-w-3xl px-6 py-8">
      <h1 className="mb-6 text-2xl font-bold">Invitations</h1>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : invitations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-muted-foreground">
            <Inbox className="mb-3 h-10 w-10" />
            <p>No pending invitations.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {invitations.map((inv) => (
            <Card key={inv.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">
                    {inv.workspace_id ? 'Workspace invitation' : 'Board invitation'}
                  </CardTitle>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary">{ROLE_LABELS[inv.role]}</Badge>
                    <span>{relativeTime(inv.created_at)}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => onReject(inv.token)}
                    disabled={declining || accepting}
                    className="gap-1 text-destructive hover:text-destructive"
                  >
                    <X className="h-4 w-4" /> Reject
                  </Button>
                  <Button onClick={() => onAccept(inv.token)} disabled={accepting || declining} className="gap-1">
                    <Check className="h-4 w-4" /> Accept
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
