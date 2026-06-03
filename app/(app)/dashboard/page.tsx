'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Briefcase, Plus, ArrowRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  useCreateWorkspaceMutation,
  useListMyWorkspacesQuery,
} from '@/features/workspaces/workspaceApi';
import { useListMyPendingQuery } from '@/features/invitations/invitationApi';
import { ROLE_LABELS } from '@/lib/constants';
import { cn } from '@/lib/utils/cn';

export default function DashboardPage() {
  const router = useRouter();
  const { data: workspaces = [], isLoading } = useListMyWorkspacesQuery();
  const { data: invitations = [] } = useListMyPendingQuery();
  const [create, { isLoading: creating }] = useCreateWorkspaceMutation();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const onCreate = async () => {
    if (!name.trim()) return;
    try {
      const ws = await create({ name: name.trim(), description: description.trim() || undefined }).unwrap();
      toast.success('Workspace created');
      setOpen(false);
      setName('');
      setDescription('');
      router.push(`/workspaces/${ws.id}`);
    } catch {
      /* toasted */
    }
  };

  return (
    <div className="container mx-auto max-w-5xl px-6 py-8">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Workspaces
          </p>
          <h1 className="mt-1 text-2xl font-bold">Your workspaces</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {workspaces.length} workspace{workspaces.length === 1 ? '' : 's'}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 shadow-sm">
              <Plus className="h-4 w-4" />
              New workspace
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create workspace</DialogTitle>
              <DialogDescription>
                A workspace is a shared space for your team. You'll be its owner.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  placeholder="Acme Corp"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label>Description (optional)</Label>
                <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={onCreate} disabled={creating || !name.trim()}>
                {creating ? 'Creating…' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {invitations.length > 0 && (
        <Card className="mb-6 border-l-4 border-l-primary bg-accent/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 py-4">
            <div>
              <CardTitle className="text-base">Pending invitations</CardTitle>
              <CardDescription>{invitations.length} waiting for your response</CardDescription>
            </div>
            <Button asChild variant="outline" size="sm" className="gap-1">
              <Link href="/invitations">
                Review <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
        </Card>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : workspaces.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-muted-foreground">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent">
              <Briefcase className="h-7 w-7 text-primary" />
            </div>
            <p className="mb-4 text-sm">No workspaces yet.</p>
            <Button onClick={() => setOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Create your first workspace
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((w) => (
            <Link key={w.id} href={`/workspaces/${w.id}`}>
              <Card
                className={cn(
                  'group h-full overflow-hidden transition-all',
                  'hover:-translate-y-0.5 hover:shadow-card-hover'
                )}
              >
                <div className="h-1 w-full bg-primary" />
                <CardHeader className="p-4">
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded bg-accent text-primary">
                      <Briefcase className="h-4 w-4" />
                    </div>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                      {ROLE_LABELS[w.role]}
                    </span>
                  </div>
                  <CardTitle className="mt-2 text-base">{w.name}</CardTitle>
                  {w.description && (
                    <CardDescription className="line-clamp-2 text-xs">{w.description}</CardDescription>
                  )}
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
