"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Column } from "./Column";
import { TaskCard } from "./TaskCard";
import { useListBoardColumnsQuery } from "@/features/boards/boardApi";
import {
  useListBoardTasksQuery,
  useMoveTaskMutation,
} from "@/features/tasks/taskApi";
import { useBoardRealtime } from "@/hooks/useRealtime";
import { avgPosition } from "@/lib/utils/slug";
import type { Task } from "@/types/domain";
import { BoardSkeleton } from "@/components/skeletons/BoardSkeleton";

export function Board({ boardId }: { boardId: string }) {
  useBoardRealtime(boardId);

  const { data: columns = [], isLoading: columnsLoading } =
    useListBoardColumnsQuery({ boardId });
  const { data: tasks = [], isLoading: tasksLoading } = useListBoardTasksQuery({
    boardId,
  });
  const [moveTask] = useMoveTaskMutation();
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  // FIX: Add KeyboardSensor for accessibility (screen readers, keyboard nav)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const tasksByColumn = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const col of columns) map.set(col.id, []);
    for (const t of tasks) {
      if (!map.has(t.column_id)) map.set(t.column_id, []);
      map.get(t.column_id)!.push(t);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.position - b.position);
    return map;
  }, [columns, tasks]);

  const onDragStart = (e: DragStartEvent) => {
    const task = tasks.find((t) => t.id === e.active.id);
    if (task) setActiveTask(task);
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = e;
    if (!over) return;
    const dragged = tasks.find((t) => t.id === active.id);
    if (!dragged) return;

    const overType = over.data.current?.type as "column" | "task" | undefined;
    let targetColumnId: string;
    let newPosition: number;

    if (overType === "column") {
      targetColumnId = over.id as string;
      const colTasks = tasksByColumn.get(targetColumnId) ?? [];
      newPosition = avgPosition(
        colTasks[colTasks.length - 1]?.position ?? null,
        null,
      );
    } else if (overType === "task") {
      const overTask = tasks.find((t) => t.id === over.id);
      if (!overTask) return;
      targetColumnId = overTask.column_id;
      const colTasks = tasksByColumn.get(targetColumnId) ?? [];
      const overIndex = colTasks.findIndex((t) => t.id === overTask.id);
      const before = overIndex > 0 ? colTasks[overIndex - 1] : null;
      const after = colTasks[overIndex];
      newPosition = avgPosition(
        before?.position ?? null,
        after?.position ?? null,
      );
    } else {
      return;
    }

    // Skip no-op moves (same column, position close enough)
    if (
      dragged.column_id === targetColumnId &&
      Math.abs(dragged.position - newPosition) < 0.0001
    )
      return;

    moveTask({
      taskId: dragged.id,
      boardId,
      columnId: targetColumnId,
      position: newPosition,
    });
  };

  if (columnsLoading || tasksLoading) {
    return <BoardSkeleton />;
  }

  if (columns.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No columns yet. Add columns in board settings.
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="flex h-full gap-3 overflow-x-auto bg-background px-4 py-3">
        {columns.map((col) => {
          const colTasks = tasksByColumn.get(col.id) ?? [];
          return (
            <SortableContext
              key={col.id}
              items={colTasks.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              <Column column={col} tasks={colTasks} boardId={boardId} />
            </SortableContext>
          );
        })}
      </div>

      <DragOverlay>
        {activeTask ? (
          <div className="rotate-2 opacity-95 shadow-card-drag">
            <TaskCard task={activeTask} boardId={boardId} isDragOverlay />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
