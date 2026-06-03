'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Trash2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useConfirm } from '@/components/shared/ConfirmDialog';
import {
  useGetBoardQuery,
  useUpdateBoardMutation,
  useDeleteBoardMutation,
  useListBoardMembersQuery,
  useRemoveBoardMemberMutation,
  useAddBoardMemberMutation,
} from '@/features/boards/boardApi';
import { useListWorkspaceMembersQuery } from '@/features/workspaces/workspaceApi';
import { useBoardPermissions } from '@/hooks/usePermissions';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { BOARD_COLORS } from '@/lib/constants';
import { cn } from '@/lib/utils/cn';
import type { Visibility, BoardRole } from '@/types/domain';

interface FormData {
  name: string;
  description: string;
  color: string;
  visibility: Visibility;
}

export default function BoardSettingsPage() {
  const { wsId, boardId } = useParams<{ wsId: string; boardId: string }>();
  const router = useRouter();
  const confirm = useConfirm();
  const perms = useBoardPermissions(boardId);

  const { data: board } = useGetBoardQuery({ boardId });
  const { data: boardMembers = [] } = useListBoardMembersQuery({ boardId });
  const { data: wsMembers = [] } = useListWorkspaceMembersQuery({ workspaceId: wsId });
  const [updateBoard, { isLoading: updating }] = useUpdateBoardMutation();
  const [deleteBoard] = useDeleteBoardMutation();
  const [removeMember] = useRemoveBoardMemberMutation();
  const [addMember] = useAddBoardMemberMutation();

  const { register, handleSubmit, reset, setValue, watch } = useForm<FormData>();

  useEffect(() => {
    if (board) {
      reset({
        name: board.name,
        description: board.description ?? '',
        color: board.color,
        visibility: board.visibility,
      });
    }
  }, [board, reset]);

  if (!perms.isBoardAdmin) {
    return (
      <div className="container mx-auto max-w-2xl px-6 py-8">
        <p className="text-muted-foreground">Only board admins can manage board settings.</p>
      </div>
    );
  }

  const onSave = async (data: FormData) => {
    try {
      await updateBoard({
        boardId,
        input: {
          name: data.name,
          description: data.description || undefined,
          color: data.color,
          visibility: data.visibility,
        },
      }).unwrap();
      toast.success('Board updated');
    } catch { /* toasted */ }
  };

  const onDelete = async () => {
    const ok = await confirm({
      title: `Delete board "${board?.name}"?`,
      description: 'All columns, tasks, subtasks, and comments will be permanently deleted.',
      confirmText: 'Delete board',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteBoard({ boardId }).unwrap();
      toast.success('Board deleted');
      router.push(`/workspaces/${wsId}`);
    } catch { /* toasted */ }
  };

  const onRemoveMember = async (userId: string, name: string) => {
    const ok = await confirm({
      title: `Remove ${name} from this board?`,
      confirmText: 'Remove',
      destructive: true,
    });
    if (!ok) return;
    await removeMember({ boardId, userId }).unwrap();
    toast.success('Member removed');
  };

  const onChangeRole = async (userId: string, role: BoardRole) => {
    await addMember({ boardId, userId, role }).unwrap();
    toast.success('Role updated');
  };

  const selectedColor = watch('color') ?? board?.color ?? '#2563eb';

  // Non-members that can be added
  const memberIds = new Set(boardMembers.map((m) => m.user_id));
  const addableMembers = wsMembers.filter((m) => !memberIds.has(m.user_id));

  return (
    <div className="container mx-auto max-w-2xl space-y-6 px-6 py-8">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push(`/workspaces/${wsId}/boards/${boardId}`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">Board settings</h1>
          <p className="text-sm text-muted-foreground">{board?.name}</p>
        </div>
      </div>

      {/* General settings */}
      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSave)} className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input {...register('name', { required: true, minLength: 1 })} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea rows={3} {...register('description')} />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {BOARD_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setValue('color', c)}
                    className={cn(
                      'h-7 w-7 rounded-md border-2 transition-transform hover:scale-110',
                      selectedColor === c ? 'border-foreground scale-110' : 'border-transparent'
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Visibility</Label>
              <Select
                value={watch('visibility')}
                onValueChange={(v) => setValue('visibility', v as Visibility)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">Private — invite only</SelectItem>
                  <SelectItem value="public">Public — all workspace members</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={updating}>
              {updating ? 'Saving…' : 'Save changes'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Member management */}
      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>
            Manage who has access to this board.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y">
            {boardMembers.map((m) => (
              <li key={m.user_id} className="flex items-center justify-between px-6 py-3">
                <div className="flex items-center gap-3">
                  <UserAvatar name={m.profile.full_name} src={m.profile.avatar_url} />
                  <div>
                    <p className="text-sm font-medium">{m.profile.full_name ?? m.profile.email}</p>
                    <p className="text-xs text-muted-foreground">{m.profile.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={m.role}
                    onValueChange={(v) => onChangeRole(m.user_id, v as BoardRole)}
                  >
                    <SelectTrigger className="w-28 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="member">Member</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => onRemoveMember(m.user_id, m.profile.full_name ?? m.profile.email)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>

          {/* Add member */}
          {addableMembers.length > 0 && (
            <div className="border-t px-6 py-4">
              <p className="mb-3 text-sm font-medium text-muted-foreground">Add workspace member</p>
              <div className="space-y-2">
                {addableMembers.map((m) => (
                  <div key={m.user_id} className="flex items-center justify-between rounded-md border p-2">
                    <div className="flex items-center gap-2">
                      <UserAvatar name={m.profile.full_name} src={m.profile.avatar_url} className="h-7 w-7" />
                      <span className="text-sm">{m.profile.full_name ?? m.profile.email}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        addMember({ boardId, userId: m.user_id, role: 'member' });
                        toast.success(`${m.profile.full_name ?? m.profile.email} added`);
                      }}
                    >
                      Add
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">Danger zone</CardTitle>
          <CardDescription>
            Permanently delete this board and all its data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={onDelete} className="gap-2">
            <Trash2 className="h-4 w-4" /> Delete this board
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
