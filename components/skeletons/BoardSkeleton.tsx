// components/skeletons/BoardSkeleton.tsx
// Drop-in replacement for the loading state in Board.tsx

const COLUMN_TASK_COUNTS = [3, 2, 4, 1]; // simulate realistic column fill

export function BoardSkeleton() {
  return (
    <div className="flex h-full gap-3 overflow-x-auto bg-background px-4 py-3 animate-in fade-in duration-300">
      {COLUMN_TASK_COUNTS.map((taskCount, colIndex) => (
        <ColumnSkeleton
          key={colIndex}
          taskCount={taskCount}
          delay={colIndex * 80}
        />
      ))}
    </div>
  );
}

function ColumnSkeleton({ taskCount, delay }: { taskCount: number; delay: number }) {
  return (
    <div
      className="flex w-72 shrink-0 flex-col rounded-xl border bg-muted/30 animate-pulse"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
          <div className="h-4 w-24 rounded bg-muted" />
        </div>
        <div className="h-5 w-5 rounded bg-muted" />
      </div>

      {/* Task cards */}
      <div className="flex flex-col gap-2 p-2">
        {Array.from({ length: taskCount }).map((_, i) => (
          <TaskCardSkeleton key={i} delay={delay + i * 50} />
        ))}
      </div>

      {/* Add task button placeholder */}
      <div className="mx-2 mb-2 mt-auto h-8 rounded-md bg-muted/50" />
    </div>
  );
}

function TaskCardSkeleton({ delay }: { delay: number }) {
  // vary widths so it looks natural
  const titleWidths = ['w-4/5', 'w-3/5', 'w-full', 'w-2/3', 'w-3/4'];
  const titleWidth = titleWidths[delay % titleWidths.length];

  return (
    <div
      className="rounded-lg border bg-card p-3 space-y-2.5 animate-pulse"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Priority + type badges */}
      <div className="flex items-center gap-1.5">
        <div className="h-4 w-12 rounded-full bg-muted" />
        <div className="h-4 w-16 rounded-full bg-muted/60" />
      </div>
      {/* Title */}
      <div className={`h-4 ${titleWidth} rounded bg-muted`} />
      {/* Optional second line (~40% of cards) */}
      {delay % 3 !== 0 && (
        <div className="h-3 w-2/3 rounded bg-muted/50" />
      )}
      {/* Footer row: assignee + due date */}
      <div className="flex items-center justify-between pt-0.5">
        <div className="h-5 w-5 rounded-full bg-muted" />
        <div className="h-3 w-16 rounded bg-muted/50" />
      </div>
    </div>
  );
}
