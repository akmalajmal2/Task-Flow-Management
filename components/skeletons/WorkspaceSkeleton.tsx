// components/skeletons/WorkspaceSkeleton.tsx
// Drop-in replacement for the loading state in WorkspacePage

export function WorkspaceSkeleton() {
  return (
    <div className="container mx-auto max-w-6xl px-6 py-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-2.5 w-20 rounded-full bg-muted animate-pulse" />
          <div className="h-7 w-48 rounded-lg bg-muted animate-pulse" />
          <div className="h-4 w-72 rounded-md bg-muted/70 animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-28 rounded-md bg-muted animate-pulse" />
          <div className="h-9 w-9 rounded-md bg-muted animate-pulse" />
        </div>
      </div>

      {/* Board cards grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <BoardCardSkeleton key={i} delay={i * 60} />
        ))}
      </div>
    </div>
  );
}

function BoardCardSkeleton({ delay }: { delay: number }) {
  return (
    <div
      className="rounded-lg border bg-card overflow-hidden animate-pulse"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Color bar */}
      <div className="h-1 w-full bg-muted" />
      <div className="p-4 space-y-3">
        {/* Badge row */}
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded bg-muted" />
          <div className="h-4 w-14 rounded bg-muted" />
          <div className="h-4 w-12 rounded bg-muted/60" />
        </div>
        {/* Title */}
        <div className="h-5 w-3/4 rounded bg-muted" />
        {/* Description */}
        <div className="space-y-1.5">
          <div className="h-3 w-full rounded bg-muted/60" />
          <div className="h-3 w-2/3 rounded bg-muted/60" />
        </div>
      </div>
    </div>
  );
}
