export default function DashboardLoading() {
  return (
    <div className="container mx-auto max-w-5xl px-6 py-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="mb-8 flex items-end justify-between">
        <div className="space-y-2">
          <div className="h-2.5 w-24 rounded-full bg-muted animate-pulse" />
          <div className="h-8 w-48 rounded-lg bg-muted animate-pulse" />
          <div className="h-4 w-32 rounded-md bg-muted/70 animate-pulse" />
        </div>
        <div className="h-9 w-36 rounded-md bg-muted animate-pulse" />
      </div>
      {/* Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border bg-card overflow-hidden animate-pulse"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="h-1 w-full bg-primary/30" />
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-9 w-9 rounded bg-muted" />
                <div className="h-5 w-16 rounded-full bg-muted" />
              </div>
              <div className="h-5 w-3/4 rounded bg-muted" />
              <div className="h-3 w-full rounded bg-muted/60" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
