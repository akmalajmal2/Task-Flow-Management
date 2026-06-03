export default function MembersLoading() {
  return (
    <div className="container mx-auto max-w-4xl px-6 py-8 animate-in fade-in duration-300">
      <div className="mb-6 flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-28 rounded-lg bg-muted animate-pulse" />
          <div className="h-4 w-20 rounded bg-muted/70 animate-pulse" />
        </div>
        <div className="h-9 w-24 rounded-md bg-muted animate-pulse" />
      </div>
      <div className="rounded-lg border bg-card overflow-hidden animate-pulse">
        <div className="border-b px-6 py-4">
          <div className="h-5 w-20 rounded bg-muted" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between border-b last:border-0 px-6 py-4"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-muted" />
              <div className="space-y-1.5">
                <div className="h-4 w-32 rounded bg-muted" />
                <div className="h-3 w-40 rounded bg-muted/60" />
              </div>
            </div>
            <div className="h-8 w-28 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
