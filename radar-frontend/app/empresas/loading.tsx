export default function EmpresasLoading() {
  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-8 w-56 bg-surface-muted rounded animate-pulse" />
          <div className="h-4 w-72 bg-surface-muted rounded animate-pulse" />
        </div>
        <div className="h-9 w-36 bg-surface-muted rounded animate-pulse" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-8 w-24 bg-surface-muted rounded-lg animate-pulse" />
        ))}
      </div>
      <div className="h-9 w-64 bg-surface-muted rounded animate-pulse" />
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-2.5 bg-surface-muted/60 border-b border-border h-10" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-4 px-4 py-3 border-b border-border/50 animate-pulse">
            <div className="h-4 bg-surface-muted rounded flex-1" />
            <div className="h-4 bg-surface-muted rounded w-20" />
            <div className="h-4 bg-surface-muted rounded w-32" />
            <div className="h-4 bg-surface-muted rounded w-24" />
            <div className="h-4 bg-surface-muted rounded w-16" />
            <div className="h-4 bg-surface-muted rounded w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
