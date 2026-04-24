interface RagBadgeProps {
  vectors: number;
}

export function RagBadge({ vectors }: RagBadgeProps) {
  if (vectors <= 0) return null;

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-violet-300/50 bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-700 dark:border-violet-700/50 dark:bg-violet-900/20 dark:text-violet-400"
      aria-label={`${vectors} vectores RAG similares`}
      title={`${vectors} vectores similares usados`}
    >
      🧠 {vectors} similares
    </span>
  );
}
