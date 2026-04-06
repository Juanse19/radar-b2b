export default function ResultsLoading() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-48 bg-gray-800 rounded animate-pulse" />
      <div className="flex gap-3">
        <div className="h-9 w-60 bg-gray-800 rounded animate-pulse" />
        <div className="h-9 w-48 bg-gray-800 rounded animate-pulse" />
        <div className="h-9 w-32 bg-gray-800 rounded animate-pulse" />
      </div>
      <div className="rounded-xl border border-gray-800 overflow-hidden">
        <div className="px-4 py-3 bg-gray-800/60 border-b border-gray-800 h-10" />
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="px-4 py-4 border-b border-gray-800/50 flex gap-4 animate-pulse">
            <div className="h-4 bg-gray-800 rounded w-40" />
            <div className="h-4 bg-gray-800 rounded w-20" />
            <div className="h-4 bg-gray-800 rounded w-16" />
            <div className="h-4 bg-gray-800 rounded w-28" />
            <div className="h-4 bg-gray-800 rounded w-10 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
