'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  MemberOrEmailCombobox,
  type RecipientChip,
} from '@/components/shared/MemberOrEmailCombobox';
import { useCreateBoardMutation } from '@/features/boards/boardApi';
import { useListWorkspaceMembersQuery } from '@/features/workspaces/workspaceApi';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { BOARD_COLORS } from '@/lib/constants';
import { cn } from '@/lib/utils/cn';
import type { Visibility } from '@/types/domain';

export default function NewBoardPage() {
  const { wsId } = useParams<{ wsId: string }>();
  const router = useRouter();
  const { user } = useCurrentUser();
  const [create, { isLoading }] = useCreateBoardMutation();
  const { data: wsMembers = [] } = useListWorkspaceMembersQuery({ workspaceId: wsId });

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(BOARD_COLORS[0]!);
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [recipients, setRecipients] = useState<RecipientChip[]>([]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const memberIds = recipients
      .filter((r): r is Extract<RecipientChip, { kind: 'member' }> => r.kind === 'member')
      .map((r) => r.userId);
    const adminIds = recipients
      .filter((r) => r.kind === 'member' && r.isAdmin)
      .map((r) => (r as Extract<RecipientChip, { kind: 'member' }>).userId);

    try {
      const board = await create({
        workspaceId: wsId,
        input: {
          name: name.trim(),
          description: description.trim() || undefined,
          color,
          visibility,
          initial_member_ids: memberIds,
          initial_admin_ids: adminIds,
        },
      }).unwrap();
      toast.success('Board created');

      // If any invite chips exist, send them via batch endpoint
      const inviteChips = recipients.filter(
        (r): r is Extract<RecipientChip, { kind: 'invite' }> => r.kind === 'invite'
      );
      if (inviteChips.length) {
        const res = await fetch('/api/invitations/send-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            boardId: board.id,
            invites: inviteChips.map((i) => ({
              email: i.email,
              role: i.isAdmin ? 'admin' : 'member',
            })),
          }),
        });
        if (res.ok) {
          const { warnings } = await res.json();
          if (Array.isArray(warnings) && warnings.length > 0) {
            toast.warning('Some invitations were not emailed', {
              description: warnings.join('\n'),
              duration: 10_000,
            });
          }
        }
      }

      router.push(`/workspaces/${wsId}/boards/${board.id}`);
    } catch {
      /* toasted */
    }
  };

  return (
    <div className="container mx-auto max-w-2xl px-6 py-8">
      <Card>
        <CardHeader>
          <CardTitle>New board</CardTitle>
          <CardDescription>
            A board has its own kanban columns, labels, tasks, and bugs. Default columns will be created automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Website Redesign" />
            </div>

            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2">
                {BOARD_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={cn(
                      'h-7 w-7 rounded-md border-2 transition-transform hover:scale-110',
                      color === c ? 'border-foreground' : 'border-transparent'
                    )}
                    style={{ backgroundColor: c }}
                    aria-label={`Color ${c}`}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Visibility</Label>
              <Select value={visibility} onValueChange={(v) => setVisibility(v as Visibility)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">Private — invite-only</SelectItem>
                  <SelectItem value="public">Public — all workspace members</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {visibility === 'private'
                  ? 'Only people you add can see this board.'
                  : 'Everyone in the workspace can see this board. Viewers get read-only.'}
              </p>
            </div>

            {visibility === 'private' && (
              <div className="space-y-2">
                <Label>Team members</Label>
                <MemberOrEmailCombobox
                  existingMembers={wsMembers.map((m) => ({ user_id: m.user_id, profile: m.profile }))}
                  excludeUserIds={user ? [user.id] : []}
                  value={recipients}
                  onChange={setRecipients}
                  placeholder="Add teammates by name or email…"
                />
                <p className="text-xs text-muted-foreground">
                  You'll be added as admin automatically. Click Member/Admin on a chip to promote.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading || !name.trim()}>
                {isLoading ? 'Creating…' : 'Create board'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
