'use client';

import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ComercialCompany } from '@/lib/comercial/types';

interface Props {
  line:     string;
  selected: ComercialCompany[];
  onChange: (companies: ComercialCompany[]) => void;
  maxSelect?: number;
}

export function CompanySelector({ line, selected, onChange, maxSelect = 20 }: Props) {
  const [all, setAll]         = useState<ComercialCompany[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch]   = useState('');

  const fetchCompanies = useCallback(async () => {
    if (!line) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ linea: line, limit: '200' });
      if (search) params.set('q', search);
      const res = await fetch(`/api/comercial/companies?${params}`);
      if (res.ok) setAll(await res.json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [line, search]);

  useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

  const toggle = (c: ComercialCompany) => {
    const isSelected = selected.some(s => s.id === c.id);
    if (isSelected) {
      onChange(selected.filter(s => s.id !== c.id));
    } else if (selected.length < maxSelect) {
      onChange([...selected, c]);
    }
  };

  const selectAll = () => onChange(all.slice(0, maxSelect));
  const clearAll  = () => onChange([]);

  const selectedIds = new Set(selected.map(s => s.id));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Input
          placeholder="Buscar empresa..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-8 text-sm"
        />
        <div className="flex gap-1.5 shrink-0">
          <Button variant="outline" size="sm" onClick={selectAll} disabled={!all.length}>
            Todos
          </Button>
          <Button variant="outline" size="sm" onClick={clearAll} disabled={!selected.length}>
            Limpiar
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Cargando empresas...</p>
      ) : all.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No hay empresas para {line}
        </p>
      ) : (
        <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
          {all.map(c => {
            const active = selectedIds.has(c.id);
            return (
              <button
                key={c.id}
                onClick={() => toggle(c)}
                disabled={!active && selected.length >= maxSelect}
                className={cn(
                  'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors',
                  'border-b border-border/50 last:border-0',
                  active
                    ? 'bg-primary/10 text-foreground'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                  !active && selected.length >= maxSelect && 'cursor-not-allowed opacity-40'
                )}
              >
                <span className="truncate font-medium">{c.name}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {c.country && (
                    <span className="text-xs text-muted-foreground">{c.country}</span>
                  )}
                  {c.tier && (
                    <Badge variant={c.tier === 'ORO' ? 'default' : 'secondary'} className="h-4 text-[10px] px-1">
                      {c.tier}
                    </Badge>
                  )}
                  {active && (
                    <span className="h-4 w-4 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-[9px] font-bold">
                      ✓
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {selected.length} de {Math.min(all.length, maxSelect)} seleccionadas
      </p>
    </div>
  );
}
