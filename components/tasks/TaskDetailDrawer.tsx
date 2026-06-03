"use client";

import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PriorityBadge } from "@/components/shared/Badges";
import { StarRating } from "@/components/shared/StarRating";
import { AssigneeCombobox } from "@/components/shared/AssigneeCombobox";
import { useConfirm } from "@/components/shared/ConfirmDialog";
import { SubtaskList } from "./SubtaskList";
import { CommentThread } from "@/components/comments/CommentThread";
import {
  useDeleteTaskMutation,
  useGetTaskQuery,
  useRateTaskMutation,
  useSetAssigneesMutation,
  useUpdateTaskMutation,
} from "@/features/tasks/taskApi";
import { useListAssignableMembersQuery } from "@/features/boards/boardApi";
import { useBoardPermissions } from "@/hooks/usePermissions";
import { TASK_PRIORITIES } from "@/lib/constants";
import { shortDate } from "@/lib/utils/dates";
import type { TaskPriority } from "@/types/domain";

interface Props {
  boardId: string;
  taskId: string | null;
  onClose: () => void;
}

export function TaskDetailDrawer({ boardId, taskId, onClose }: Props) {
  const { data: task } = useGetTaskQuery(
    { taskId: taskId! },
    { skip: !taskId },
  );
  const { data: members = [] } = useListAssignableMembersQuery({ boardId });
  const [updateTask] = useUpdateTaskMutation();
  const [setAssignees] = useSetAssigneesMutation();
  const [rateTask] = useRateTaskMutation();
  const [deleteTask] = useDeleteTaskMutation();
  const perms = useBoardPermissions(boardId);
  const confirm = useConfirm();

  const currentAssigneeIds = (task?.assignees ?? []).map((a) => a.user_id);

  const onPriorityChange = async (p: TaskPriority) => {
    if (!task) return;
    await updateTask({
      taskId: task.id,
      boardId,
      input: { priority: p },
    }).unwrap();
  };

  // Multi-assignee: called whenever the combobox selection changes
  const onAssigneesChange = async (userIds: string[]) => {
    if (!task) return;
    await setAssignees({ taskId: task.id, boardId, userIds }).unwrap();
    toast.success(
      userIds.length === 0 ? "Assignees removed" : "Assignees updated",
    );
  };

  const onDelete = async () => {
    if (!task) return;
    const ok = await confirm({
      title: `Delete "${task.title}"?`,
      description: "Subtasks and comments will be permanently deleted.",
      confirmText: "Delete",
      destructive: true,
    });
    if (!ok) return;
    await deleteTask({ taskId: task.id, boardId }).unwrap();
    toast.success("Task deleted");
    onClose();
  };

  return (
    <Sheet open={!!taskId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="space-y-4 overflow-y-auto">
        {!task ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <SheetHeader>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">#{task.seq_number}</span>
                <PriorityBadge priority={task.priority} />
                {task.due_date && (
                  <Badge variant="outline">{shortDate(task.due_date)}</Badge>
                )}
              </div>
              <SheetTitle>{task.title}</SheetTitle>
              {task.description && (
                <SheetDescription className="whitespace-pre-wrap">
                  {task.description}
                </SheetDescription>
              )}
            </SheetHeader>

            <div className="space-y-3 rounded-lg border p-4 text-sm">
              {/* Priority */}
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Priority</p>
                <Select
                  value={task.priority}
                  onValueChange={(v) => onPriorityChange(v as TaskPriority)}
                  disabled={!perms.canWrite}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p} className="capitalize">
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Assignees — now multi-select */}
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Assignees</p>
                <AssigneeCombobox
                  members={members}
                  value={currentAssigneeIds}
                  onChange={onAssigneesChange}
                  placeholder="Unassigned"
                  disabled={!perms.canWrite}
                />
              </div>

              {/* Rating */}
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Rating</p>
                <StarRating
                  value={task.weight_stars}
                  readOnly={!perms.canWrite}
                  onChange={(s) =>
                    rateTask({ taskId: task.id, stars: s, boardId })
                  }
                />
              </div>
            </div>

            <SubtaskList
              taskId={task.id}
              boardId={boardId}
              subtasks={task.subtasks ?? []}
            />

            <CommentThread parentType="task" parentId={task.id} />

            {(perms.canDeleteAnyTask || currentAssigneeIds.length > 0) && (
              <div className="border-t pt-4">
                <Button
                  variant="ghost"
                  onClick={onDelete}
                  className="gap-2 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" /> Delete task
                </Button>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
