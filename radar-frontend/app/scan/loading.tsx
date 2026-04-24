export default function ScanLoading() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-56 bg-surface-muted rounded animate-pulse" />
      <div className="h-4 w-72 bg-surface-muted/70 rounded animate-pulse" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-surface p-4 space-y-2 animate-pulse">
            <div className="h-5 w-24 bg-surface-muted rounded" />
            <div className="h-4 w-40 bg-surface-muted rounded" />
            <div className="h-7 w-16 bg-surface-muted rounded mt-3" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-surface p-6 space-y-3 animate-pulse">
        <div className="h-5 w-44 bg-surface-muted rounded" />
        <div className="h-9 w-full bg-surface-muted rounded" />
        <div className="h-9 w-1/3 bg-surface-muted rounded" />
      </div>
    </div>
  );
}
