"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateTaskMutation } from "@/features/tasks/taskApi";
import { useListAssignableMembersQuery } from "@/features/boards/boardApi";
import { AssigneeCombobox } from "@/components/shared/AssigneeCombobox";
import { TASK_PRIORITIES } from "@/lib/constants";
import type { TaskPriority } from "@/types/domain";

interface Props {
  boardId: string;
}

export function TaskForm({ boardId }: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState("");

  // Fetch all members who can be assigned on this board.
  // For public boards → all workspace members (excl. viewers).
  // For private boards → explicit board_members only.
  const { data: members = [], isLoading: membersLoading } =
    useListAssignableMembersQuery({ boardId });

  const [createTask, { isLoading }] = useCreateTaskMutation();

  const reset = () => {
    setTitle("");
    setDescription("");
    setPriority("medium");
    setAssigneeIds([]);
    setDueDate("");
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    setOpen(next);
  };

  const submit = async () => {
    if (!title.trim()) return;
    try {
      await createTask({
        board_id: boardId,
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        due_date: dueDate || undefined,
        assignee_ids: assigneeIds.length > 0 ? assigneeIds : undefined,
      }).unwrap();
      toast.success("Task created");
      reset();
      setOpen(false);
    } catch {
      // Error already toasted by listenerMiddleware
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" /> New task
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create task</DialogTitle>
          <DialogDescription>
            Task will be added to the first column of this board.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="task-title">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="task-desc">Description</Label>
            <Textarea
              id="task-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional details…"
              className="resize-none"
            />
          </div>

          {/* Priority + Due date */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as TaskPriority)}
              >
                <SelectTrigger>
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

            <div className="space-y-1.5">
              <Label htmlFor="task-due">Due date</Label>
              <Input
                id="task-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          {/* Assignees — multi-select combobox */}
          <div className="space-y-1.5">
            <Label>
              Assignees{" "}
              {members.length === 0 && !membersLoading && (
                <span className="text-xs font-normal text-muted-foreground">
                  (invite members to assign tasks)
                </span>
              )}
            </Label>
            <AssigneeCombobox
              members={members}
              value={assigneeIds}
              onChange={setAssigneeIds}
              placeholder={
                membersLoading ? "Loading members…" : "Search and assign…"
              }
              disabled={membersLoading || members.length === 0}
            />
            {members.length > 0 && (
              <p className="text-[11px] text-muted-foreground">
                Press{" "}
                <kbd className="rounded border border-border px-1 py-0.5 font-mono text-[10px]">
                  ⌫
                </kbd>{" "}
                to remove the last assignee
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isLoading || !title.trim()}>
            {isLoading ? "Creating…" : "Create task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
