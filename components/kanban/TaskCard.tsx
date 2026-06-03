'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CheckSquare, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { PriorityBadge } from '@/components/shared/Badges';
import { StarRating } from '@/components/shared/StarRating';
import { ActionMenu } from '@/components/shared/ActionMenu';
import { IssueTypeIcon } from '@/components/shared/IssueTypeIcon';
import { useDeleteTaskMutation } from '@/features/tasks/taskApi';
import { useBoardPermissions } from '@/hooks/usePermissions';
import { useConfirm } from '@/components/shared/ConfirmDialog';
import { useAppDispatch } from '@/hooks/useAppStore';
import { setSelectedTask } from '@/features/tasks/kanbanSlice';
import { isOverdue, shortDate } from '@/lib/utils/dates';
import { cn } from '@/lib/utils/cn';
import { PRIORITY_HEX } from '@/lib/constants';
import type { Task } from '@/types/domain';

interface Props {
  task: Task;
  boardId: string;
  isDragOverlay?: boolean;
}

export function TaskCard({ task, boardId, isDragOverlay }: Props) {
  const dispatch = useAppDispatch();
  const perms = useBoardPermissions(boardId);
  const confirm = useConfirm();
  const [deleteTask] = useDeleteTaskMutation();

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'task' },
    disabled: isDragOverlay,
  });

  const style = isDragOverlay
    ? { ['--strip-color' as string]: PRIORITY_HEX[task.priority] }
    : {
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        ['--strip-color' as string]: PRIORITY_HEX[task.priority],
      };

  const subtaskTotal = task.subtasks?.length ?? 0;
  const subtaskDone = task.subtasks?.filter((s) => s.status === 'done').length ?? 0;
  const overdue = isOverdue(task.due_date);

  const onDelete = async () => {
    const ok = await confirm({
      title: `Delete task "${task.title}"?`,
      description: 'All subtasks and comments on this task will also be deleted.',
      confirmText: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteTask({ taskId: task.id, boardId }).unwrap();
      toast.success('Task deleted');
    } catch {
      /* toasted */
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => dispatch(setSelectedTask(task.id))}
      className={cn(
        'card-strip group relative cursor-pointer rounded-md border border-border bg-card p-2.5 shadow-card transition-all',
        'hover:border-primary/30 hover:shadow-card-hover',
        overdue && 'ring-1 ring-destructive/40'
      )}
    >
      {/* Drag surface */}
      <div
        {...attributes}
        {...listeners}
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        aria-hidden
      />

      {/* Title */}
      <p className="pointer-events-none relative line-clamp-2 text-sm font-medium leading-snug text-card-foreground">
        {task.title}
      </p>

      {/* Meta row 1: type + key + stars */}
      <div className="pointer-events-none relative mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <IssueTypeIcon type="task" />
        <span className="font-mono text-[11px]">#{task.seq_number}</span>
        {task.weight_stars > 0 && (
          <div className="ml-auto">
            <StarRating value={task.weight_stars} readOnly size={10} />
          </div>
        )}
      </div>

      {/* Meta row 2: priority + subtask count + due + assignees + menu */}
      <div className="relative mt-2 flex items-center justify-between gap-2">
        <div className="pointer-events-none flex items-center gap-1.5">
          <PriorityBadge priority={task.priority} />
          {subtaskTotal > 0 && (
            <span className="flex items-center gap-0.5 text-[11px] tabular-nums text-muted-foreground">
              <CheckSquare className="h-3 w-3" />
              {subtaskDone}/{subtaskTotal}
            </span>
          )}
          {task.due_date && (
            <span
              className={cn(
                'text-[10px] tabular-nums',
                overdue ? 'font-semibold text-destructive' : 'text-muted-foreground'
              )}
            >
              {shortDate(task.due_date)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <div className="pointer-events-none flex -space-x-1.5">
            {(task.assignees ?? []).slice(0, 3).map((a) => (
              <UserAvatar
                key={a.user_id}
                name={a.profile?.full_name}
                src={a.profile?.avatar_url}
                className="h-5 w-5 border border-card"
              />
            ))}
          </div>
          {!isDragOverlay && (
            <div className="relative z-10 opacity-0 transition-opacity group-hover:opacity-100">
              <ActionMenu
                items={[
                  {
                    label: 'Open',
                    icon: Pencil,
                    onSelect: () => dispatch(setSelectedTask(task.id)),
                  },
                  {
                    label: 'Delete',
                    icon: Trash2,
                    destructive: true,
                    separatorBefore: true,
                    onSelect: onDelete,
                  },
                ]}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
