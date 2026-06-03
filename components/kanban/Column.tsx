'use client';

import { useDroppable } from '@dnd-kit/core';
import { TaskCard } from './TaskCard';
import { cn } from '@/lib/utils/cn';
import type { BoardColumn, Task } from '@/types/domain';

interface Props {
  column: BoardColumn;
  tasks: Task[];
  boardId: string;
}

export function Column({ column, tasks, boardId }: Props) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { type: 'column' },
  });

  const overLimit = column.wip_limit != null && tasks.length > column.wip_limit;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex h-full w-72 shrink-0 flex-col rounded-md bg-secondary/60 transition-colors',
        isOver && 'ring-2 ring-primary'
      )}
    >
      <div className="flex items-center justify-between rounded-t-md bg-secondary/80 px-3 py-2">
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: column.color ?? 'hsl(var(--muted-foreground))' }}
          />
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {column.name}
          </h3>
        </div>
        <span
          className={cn(
            'rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums',
            overLimit
              ? 'bg-destructive/15 text-destructive'
              : 'bg-background text-muted-foreground'
          )}
        >
          {tasks.length}
          {column.wip_limit != null ? `/${column.wip_limit}` : ''}
        </span>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-2 py-2">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} boardId={boardId} />
        ))}
        {tasks.length === 0 && (
          <div className="rounded-md border border-dashed border-border/60 py-6 text-center text-[11px] text-muted-foreground">
            Drop cards here
          </div>
        )}
      </div>
    </div>
  );
}
