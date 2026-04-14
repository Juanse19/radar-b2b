export default function ScheduleLoading() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-56 bg-surface-muted rounded animate-pulse" />
      <div className="h-4 w-72 bg-surface-muted/70 rounded animate-pulse" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-surface p-5 space-y-3 animate-pulse">
            <div className="h-5 w-32 bg-surface-muted rounded" />
            <div className="h-4 w-full bg-surface-muted rounded" />
            <div className="h-9 w-full bg-surface-muted rounded" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-surface p-6 space-y-3 animate-pulse">
        <div className="h-5 w-48 bg-surface-muted rounded" />
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-20 bg-surface-muted rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}
