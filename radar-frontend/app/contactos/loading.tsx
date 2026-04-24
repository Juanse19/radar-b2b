export default function ContactosLoading() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-48 bg-surface-muted rounded animate-pulse" />
      <div className="h-4 w-64 bg-surface-muted/70 rounded animate-pulse" />
      <div className="flex gap-2 flex-wrap">
        <div className="h-9 w-56 bg-surface-muted rounded animate-pulse" />
        <div className="h-9 w-40 bg-surface-muted rounded animate-pulse" />
        <div className="h-9 w-32 bg-surface-muted rounded animate-pulse" />
      </div>
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 bg-surface-muted/60 border-b border-border h-10" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="px-4 py-4 border-b border-border/50 flex gap-4 animate-pulse">
            <div className="h-4 bg-surface-muted rounded w-36" />
            <div className="h-4 bg-surface-muted rounded w-28" />
            <div className="h-4 bg-surface-muted rounded w-24" />
            <div className="h-4 bg-surface-muted rounded w-20 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
