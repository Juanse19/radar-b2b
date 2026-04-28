'use client';

import { useState, useEffect } from 'react';
import { Tag, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KeywordResult {
  id:               number;
  sub_linea_nombre: string;
  palabra:          string;
  tipo:             string;
  peso:             number;
}

interface Props {
  linea:    string;
  sublinea?: string;
}

const TIPO_STYLES: Record<string, string> = {
  senal:    'bg-blue-50  text-blue-700  border-blue-200  dark:bg-blue-950  dark:text-blue-300  dark:border-blue-800',
  producto: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800',
  sector:   'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
};

const MAX_DISPLAY = 20;

export function KeywordChips({ linea, sublinea }: Props) {
  const [open,     setOpen]     = useState(false);
  const [keywords, setKeywords] = useState<KeywordResult[]>([]);
  const [loading,  setLoading]  = useState(false);

  useEffect(() => {
    if (!linea || linea === 'ALL') {
      setKeywords([]);
      return;
    }

    const params = new URLSearchParams({ linea });
    if (sublinea) params.set('sublinea', sublinea);

    setLoading(true);
    fetch(`/api/comercial/keywords?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data: KeywordResult[]) => setKeywords(Array.isArray(data) ? data : []))
      .catch(() => setKeywords([]))
      .finally(() => setLoading(false));
  }, [linea, sublinea]);

  // Nothing to show when linea is not specific
  if (!linea || linea === 'ALL') return null;

  const visible  = keywords.slice(0, MAX_DISPLAY);
  const overflow = keywords.length - MAX_DISPLAY;

  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
      {/* Header — toggle */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <Tag size={12} />
        <span>
          Palabras clave
          {!loading && keywords.length > 0 && (
            <span className="ml-1 font-normal">({keywords.length})</span>
          )}
        </span>
        <span className="ml-auto">
          {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </span>
      </button>

      {/* Collapsible body */}
      {open && (
        <div className="mt-2">
          {loading ? (
            /* Skeleton pills */
            <div className="flex flex-wrap gap-1.5">
              {[60, 80, 50].map((w) => (
                <span
                  key={w}
                  className="inline-block h-5 animate-pulse rounded-full bg-muted"
                  style={{ width: w }}
                />
              ))}
            </div>
          ) : keywords.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Sin keywords registradas para esta selección
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {visible.map((kw) => (
                <span
                  key={kw.id}
                  className={cn(
                    'inline-flex items-center rounded-full border px-2 py-0.5 text-xs',
                    TIPO_STYLES[kw.tipo] ?? 'bg-muted text-muted-foreground border-border',
                  )}
                >
                  {kw.palabra}
                </span>
              ))}
              {overflow > 0 && (
                <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                  +{overflow} más
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
