'use client';

import { useEffect, useState } from 'react';
import { ROLE_LABELS } from '@/lib/constants'; // or wherever it's defined
import type { WorkspaceRole } from '@/types';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  useAcceptInvitationMutation,
  useDeclineInvitationMutation,
} from '@/features/invitations/invitationApi';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useConfirm } from '@/components/shared/ConfirmDialog';
import { createClient } from '@/lib/supabase/client';

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { user, isLoading } = useCurrentUser();
  const [accept] = useAcceptInvitationMutation();
  const [decline] = useDeclineInvitationMutation();
  const confirm = useConfirm();

  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errMsg, setErrMsg] = useState('');
  const [details, setDetails] = useState<{
    role: string;
    email: string;
    workspaceName?: string;
  } | null>(null);

  useEffect(() => {
    if (isLoading || !user) return;
    (async () => {
      const sb = createClient();
      const { data: inv } = await sb
        .from('invitations')
        .select('role, email, status, workspace_id')
        .eq('token', token)
        .maybeSingle();
      if (!inv) {
        setState('error');
        setErrMsg('Invitation not found or expired.');
        return;
      }
      if (inv.status !== 'pending') {
        setState('error');
        setErrMsg(`This invitation was already ${inv.status}.`);
        return;
      }
      let workspaceName: string | undefined;
      if (inv.workspace_id) {
        const { data } = await sb
          .from('workspaces')
          .select('name')
          .eq('id', inv.workspace_id)
          .maybeSingle();
        workspaceName = data?.name;
      }
      setDetails({ role: inv.role, email: inv.email, workspaceName });
      setState('ready');
    })();
  }, [user, isLoading, token]);

  const onAccept = async () => {
    const ok = await confirm({
      title: 'Accept this invitation?',
      description: `Join ${details?.workspaceName ?? 'this workspace'} as ${details?.role ? (ROLE_LABELS[details.role as unknown as WorkspaceRole] ?? details.role) : ''}.`,
      confirmText: 'Accept',
    });
    if (!ok) return;
    try {
      const res = await accept({ token }).unwrap();
      toast.success('Invitation accepted');
      router.push(
        res.workspace_id ? `/workspaces/${res.workspace_id}` : '/dashboard'
      );
    } catch (e: any) {
      toast.error(e.message ?? 'Could not accept');
    }
  };

  const onReject = async () => {
    const ok = await confirm({
      title: 'Reject this invitation?',
      confirmText: 'Reject',
      destructive: true,
    });
    if (!ok) return;
    await decline({ token }).unwrap();
    toast.success('Invitation rejected');
    router.push('/dashboard');
  };

  if (isLoading) return null;

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Sign in to continue</CardTitle>
            <CardDescription>
              You need a TaskFlow account to respond to this invitation.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button asChild className="flex-1">
              <Link href={`/login?next=/invite/${token}`}>Sign in</Link>
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <Link href={`/signup?next=/invite/${token}`}>Sign up</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <Card className="w-full max-w-md">
        {state === 'loading' && (
          <CardHeader>
            <CardTitle>Loading…</CardTitle>
          </CardHeader>
        )}
        {state === 'ready' && details && (
          <>
            <CardHeader>
              <CardTitle>You've been invited</CardTitle>
              <CardDescription>
                Join{' '}
                <span className="font-medium text-foreground">
                  {details.workspaceName ?? 'this team'}
                </span>
                .
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Role</span>
                  <Badge>
                    {ROLE_LABELS[details.role as unknown as WorkspaceRole] ??
                      details.role}
                  </Badge>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-muted-foreground">Invited email</span>
                  <span>{details.email}</span>
                </div>
              </div>
              {details.email.toLowerCase() !== user.email.toLowerCase() && (
                <p className="text-xs text-amber-600">
                  This invitation was sent to{' '}
                  <span className="font-mono">{details.email}</span> but you're
                  signed in as <span className="font-mono">{user.email}</span>.
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 gap-2 text-destructive"
                  onClick={onReject}
                >
                  <X className="h-4 w-4" /> Reject
                </Button>
                <Button className="flex-1 gap-2" onClick={onAccept}>
                  <Check className="h-4 w-4" /> Accept
                </Button>
              </div>
            </CardContent>
          </>
        )}
        {state === 'error' && (
          <>
            <CardHeader>
              <CardTitle>Cannot process invitation</CardTitle>
              <CardDescription>{errMsg}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link href="/dashboard">Go to dashboard</Link>
              </Button>
            </CardContent>
          </>
        )}
      </Card>
    </main>
  );
}
