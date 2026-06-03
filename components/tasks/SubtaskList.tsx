'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Check, X, Eye, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  useCreateSubtaskMutation,
  useDeleteSubtaskMutation,
  useUpdateSubtaskStatusMutation,
} from '@/features/tasks/subtaskApi';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useBoardPermissions } from '@/hooks/usePermissions';
import { useConfirm } from '@/components/shared/ConfirmDialog';
import { cn } from '@/lib/utils/cn';
import type { Subtask, SubtaskStatus } from '@/types/domain';

interface Props {
  taskId: string;
  boardId: string;
  subtasks: Subtask[];
}

const STATUS_LABELS: Record<SubtaskStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  in_review: 'In Review',
  done: 'Done',
  rejected: 'Rejected',
};

export function SubtaskList({ taskId, boardId, subtasks }: Props) {
  const { user } = useCurrentUser();
  const perms = useBoardPermissions(boardId);
  const confirm = useConfirm();

  const [create] = useCreateSubtaskMutation();
  const [updateStatus] = useUpdateSubtaskStatusMutation();
  const [deleteSubtask] = useDeleteSubtaskMutation();

  const [newTitle, setNewTitle] = useState('');
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState('');

  const onCreate = async () => {
    if (!newTitle.trim()) return;
    try {
      await create({ taskId, boardId, title: newTitle.trim() }).unwrap();
      setNewTitle('');
    } catch {
      /* toasted */
    }
  };

  const onChangeStatus = async (s: Subtask, status: SubtaskStatus) => {
    await updateStatus({ subtaskId: s.id, taskId, boardId, status }).unwrap();
    toast.success(`Moved to ${STATUS_LABELS[status]}`);
  };

  const onReview = async (s: Subtask, approve: boolean) => {
    await updateStatus({
      subtaskId: s.id,
      taskId,
      boardId,
      status: approve ? 'done' : 'rejected',
      reviewNote: reviewNote.trim() || undefined,
    }).unwrap();
    toast.success(approve ? 'Approved' : 'Rejected');
    setReviewingId(null);
    setReviewNote('');
  };

  const onDelete = async (s: Subtask) => {
    const ok = await confirm({
      title: 'Delete subtask?',
      confirmText: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    await deleteSubtask({ subtaskId: s.id, taskId, boardId }).unwrap();
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">
        Subtasks <span className="text-muted-foreground">({subtasks.length})</span>
      </h3>

      <div className="flex gap-2 rounded-lg border bg-muted/30 p-2">
        <Input
          placeholder="Add a subtask…"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onCreate()}
          className="border-0 bg-transparent focus-visible:ring-0"
        />
        <Button size="sm" onClick={onCreate} disabled={!newTitle.trim()} className="gap-1">
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>

      {subtasks.length === 0 ? (
        <div className="rounded-md border-2 border-dashed py-6 text-center text-sm text-muted-foreground">
          No subtasks yet. Break this task down above.
        </div>
      ) : (
        <ul className="space-y-2">
          {subtasks.map((s) => {
            const isOwn = s.created_by === user?.id || s.assignee_id === user?.id;
            const canReview = perms.isBoardAdmin && s.status === 'in_review' && !isOwn;
            const canSendToReview =
              isOwn && (s.status === 'todo' || s.status === 'in_progress' || s.status === 'rejected');

            return (
              <li key={s.id} className="rounded-md border p-2.5 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className={cn('font-medium', s.status === 'done' && 'line-through text-muted-foreground')}>
                      {s.title}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {STATUS_LABELS[s.status]}
                      {s.review_note && ` — ${s.review_note}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {canSendToReview && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onChangeStatus(s, 'in_review')}
                        className="gap-1"
                      >
                        <Eye className="h-3 w-3" /> Send to review
                      </Button>
                    )}
                    {canReview && reviewingId !== s.id && (
                      <>
                        <Button size="sm" onClick={() => onReview(s, true)} className="gap-1">
                          <Check className="h-3 w-3" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setReviewingId(s.id)}
                          className="gap-1"
                        >
                          <X className="h-3 w-3" /> Reject
                        </Button>
                      </>
                    )}
                    {s.status === 'in_progress' && isOwn && (
                      <Button size="sm" variant="ghost" onClick={() => onDelete(s)}>
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>

                {reviewingId === s.id && (
                  <div className="mt-2 space-y-2 border-t pt-2">
                    <Textarea
                      rows={2}
                      placeholder="Why are you rejecting this?"
                      value={reviewNote}
                      onChange={(e) => setReviewNote(e.target.value)}
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setReviewingId(null);
                          setReviewNote('');
                        }}
                      >
                        Cancel
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => onReview(s, false)}>
                        Confirm reject
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
