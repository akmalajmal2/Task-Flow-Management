export default function NotificationsLoading() {
  return (
    <div className="container mx-auto max-w-3xl px-6 py-8 animate-in fade-in duration-300">
      <div className="mb-6 flex items-center justify-between">
        <div className="h-7 w-36 rounded-lg bg-muted animate-pulse" />
        <div className="h-8 w-28 rounded bg-muted animate-pulse" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-start gap-3 rounded-lg border p-4 animate-pulse"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <div className="mt-1 h-2 w-2 rounded-full bg-muted shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-2/3 rounded bg-muted" />
              <div className="h-3 w-full rounded bg-muted/60" />
              <div className="h-3 w-16 rounded bg-muted/40" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
