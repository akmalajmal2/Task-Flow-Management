export default function InvitationsLoading() {
  return (
    <div className="container mx-auto max-w-3xl px-6 py-8 animate-in fade-in duration-300">
      <div className="mb-6 h-7 w-28 rounded-lg bg-muted animate-pulse" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border bg-card p-5 animate-pulse"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-5 w-44 rounded bg-muted" />
                <div className="flex items-center gap-2">
                  <div className="h-4 w-16 rounded-full bg-muted/70" />
                  <div className="h-4 w-24 rounded bg-muted/50" />
                </div>
              </div>
              <div className="flex gap-2">
                <div className="h-9 w-20 rounded-md bg-muted" />
                <div className="h-9 w-20 rounded-md bg-muted" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
