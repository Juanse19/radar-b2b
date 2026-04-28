'use client';

import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible';
import { ChevronDown, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AutoCountSlider } from './AutoCountSlider';
import { CompanySelector } from '../../components/CompanySelector';
import { RagToggle } from '@/components/agent/RagToggle';
import type { ParentLineaItem } from '@/app/api/comercial/lineas-tree/route';
import type { WizardState } from '@/lib/comercial/wizard-state';
import type { ComercialCompany } from '@/lib/comercial/types';

// Map tier to badge classes
const TIER_BADGE: Record<string, string> = {
  ORO:       'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
  MONITOREO: 'bg-blue-500/15  text-blue-700  dark:text-blue-400  border-blue-500/30',
  ARCHIVO:   'bg-muted        text-muted-foreground',
};

function TierBadge({ tier }: { tier?: string }) {
  if (!tier) return null;
  const cls = TIER_BADGE[tier.toUpperCase()] ?? TIER_BADGE['ARCHIVO'];
  return (
    <Badge variant="outline" className={cn('h-4 px-1 text-[10px] font-medium', cls)}>
      {tier}
    </Badge>
  );
}

interface EstimateResponse {
  cost_usd_est: number;
}

function useCostEstimate(line: string, count: number) {
  const [cost, setCost] = useState<number | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!line || count < 1) { setCost(null); return; }
    let cancelled = false;
    fetch('/api/comercial/estimate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ linea: line, empresas_count: count, provider: 'claude' }),
    })
      .then(r => r.ok ? r.json() as Promise<EstimateResponse> : null)
      .then(d => { if (!cancelled && d) setCost(d.cost_usd_est); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [line, count]);
  return cost;
}

// Fuentes and Keywords are fetched live from the admin API.
// Fallback values (used if fetch fails) for graceful degradation.
const FALLBACK_FUENTES = [
  { country: 'Colombia', sources: ['SECOP', 'ANI', 'Aerocivil', 'DNP'] },
  { country: 'México',   sources: ['AFAC', 'CompraNet', 'ASUR/GAP/OMA'] },
  { country: 'Chile',    sources: ['Mercado Público', 'DGAC', 'MOP'] },
  { country: 'Brasil',   sources: ['ANAC', 'Infraestrutura.gov', 'Portal Transparência'] },
];

const FALLBACK_KEYWORDS = [
  'terminal pasajeros', 'sistema BHS', 'carrusel equipaje', 'CUTE CUSS CBIS',
  'ampliación aeropuerto', 'concesión aeroportuaria', 'self bag drop',
];

interface FuenteApi {
  nombre?:         string;
  url_base?:       string | null;
  tipo?:           string | null;
  lineas?:         string[] | null;
  priority_score?: number | null;
  notas?:          string | null;
  pais?:           string | null;
  country?:        string | null;
}

interface KeywordApi {
  palabra?:       string;
  tipo?:          string | null;
  peso?:          number | null;
  sub_linea_id?:  number | null;
}

function groupFuentesByCountry(rows: FuenteApi[]): Array<{ country: string; sources: string[] }> {
  const groups = new Map<string, string[]>();
  for (const f of rows) {
    const country = f.pais ?? f.country ?? 'Otros';
    const name    = f.nombre ?? '';
    if (!name) continue;
    const existing = groups.get(country) ?? [];
    if (!existing.includes(name)) existing.push(name);
    groups.set(country, existing);
  }
  return Array.from(groups.entries()).map(([country, sources]) => ({ country, sources }));
}

function resolveSubLineaIds(tree: ParentLineaItem[], line: string | undefined, sublineas: string[]): number[] {
  if (!line) return [];
  const parent = tree.find(p => p.label === line);
  if (!parent) return [];
  const pool = sublineas.length > 0
    ? parent.subLineas.filter(s => sublineas.includes(s.value) || sublineas.includes(s.label))
    : parent.subLineas;
  return pool.map(s => s.id).filter((id): id is number => id !== null);
}

interface Props {
  state:    WizardState;
  onChange: (updates: Partial<WizardState>) => void;
}

export function Step2Configure({ state, onChange }: Props) {
  // The CompanySelector needs a full ComercialCompany[] locally — the URL only
  // persists IDs. We re-hydrate from the /api/comercial/companies endpoint.
  const [selectedCompanies, setSelectedCompanies] = useState<ComercialCompany[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const manualCount = state.mode === 'manual' ? selectedCompanies.length : 0;
  const autoCount   = state.mode === 'auto'   ? state.count            : 0;
  const costEstimate = useCostEstimate(
    state.line ?? '',
    state.mode === 'manual' ? manualCount : autoCount,
  );

  // Fuentes and Keywords — fetched from admin APIs with graceful fallback
  const [fuentesGroups, setFuentesGroups] = useState<Array<{ country: string; sources: string[] }>>(FALLBACK_FUENTES);
  const [keywords,      setKeywords]      = useState<string[]>(FALLBACK_KEYWORDS);
  const [lineasTree,    setLineasTree]    = useState<ParentLineaItem[]>([]);
  // Cache all fuentes so we can re-filter client-side when the line changes
  const allFuentesRef = useRef<FuenteApi[]>([]);

  // Fetch lineas tree once — needed to resolve sub_linea_id for keyword filtering
  useEffect(() => {
    fetch('/api/comercial/lineas-tree')
      .then((r) => r.ok ? r.json() : [])
      .then((data: ParentLineaItem[]) => { if (Array.isArray(data)) setLineasTree(data); })
      .catch(() => {});
  }, []);

  // Fuentes — fetch once, re-filter client-side whenever selected line changes (T3)
  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/fuentes')
      .then((r) => r.ok ? r.json() : [])
      .then((data: FuenteApi[] | { data: FuenteApi[] } | unknown) => {
        if (cancelled) return;
        const rows: FuenteApi[] = Array.isArray(data)
          ? data
          : (data && typeof data === 'object' && Array.isArray((data as { data?: unknown }).data))
              ? ((data as { data: FuenteApi[] }).data)
              : [];
        allFuentesRef.current = rows;
        applyFuentesFilter(rows, state.line);
      })
      .catch(() => { /* keep fallback */ });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-filter fuentes when line changes without refetching
  useEffect(() => {
    if (allFuentesRef.current.length > 0) {
      applyFuentesFilter(allFuentesRef.current, state.line);
    }
  }, [state.line]);

  function applyFuentesFilter(rows: FuenteApi[], line: string | undefined) {
    const sel = line?.toLowerCase();
    const filtered = sel
      ? rows.filter((f) =>
          !f.lineas || f.lineas.length === 0 ||
          f.lineas.some((l) => l.toLowerCase().includes(sel) || sel.includes(l.toLowerCase()))
        )
      : rows;
    const grouped = groupFuentesByCountry(filtered.length > 0 ? filtered : rows);
    if (grouped.length > 0) setFuentesGroups(grouped);
  }

  // Keywords — re-fetch whenever selected line or sublines change (T2)
  useEffect(() => {
    let cancelled = false;
    const ids = resolveSubLineaIds(lineasTree, state.line, state.sublineas ?? []);

    if (ids.length === 0) {
      // No IDs resolved (no line selected or fallback tree with null IDs) — fetch all
      fetch('/api/admin/keywords')
        .then((r) => r.ok ? r.json() : [])
        .then((data: KeywordApi[] | unknown) => {
          if (cancelled) return;
          const rows: KeywordApi[] = Array.isArray(data) ? data : [];
          const words = rows.map((k) => k.palabra ?? '').filter((w) => w.length > 0);
          if (words.length > 0) setKeywords(words.slice(0, 40));
        })
        .catch(() => {});
      return () => { cancelled = true; };
    }

    // Fetch per sub_linea_id and merge deduplicated results
    Promise.all(
      ids.map((id) =>
        fetch(`/api/admin/keywords?sub_linea_id=${id}`)
          .then((r) => r.ok ? r.json() : [])
          .then((data: KeywordApi[] | unknown): KeywordApi[] => Array.isArray(data) ? data : [])
          .catch((): KeywordApi[] => [])
      )
    ).then((results) => {
      if (cancelled) return;
      const seen = new Set<string>();
      const words: string[] = [];
      for (const rows of results) {
        for (const k of rows) {
          const w = k.palabra ?? '';
          if (w && !seen.has(w)) { seen.add(w); words.push(w); }
        }
      }
      setKeywords(words.length > 0 ? words.slice(0, 40) : FALLBACK_KEYWORDS);
    });

    return () => { cancelled = true; };
  }, [lineasTree, state.line, state.sublineas]);

  useEffect(() => {
    if (state.mode !== 'manual' || !state.line || hydrated) return;

    let cancelled = false;
    const markHydrated = () => { if (!cancelled) setHydrated(true); };

    if (state.selectedIds.length === 0) {
      // Defer the state update to the next microtask so we don't update
      // during the same commit phase.
      Promise.resolve().then(markHydrated);
      return () => { cancelled = true; };
    }

    const params = new URLSearchParams({ linea: state.line, limit: '200' });
    if (state.sublineas && state.sublineas.length > 0) {
      params.set('sublinea', state.sublineas.join(','));
    } else if (state.sublinea) {
      params.set('sublinea', state.sublinea);
    }
    fetch(`/api/comercial/companies?${params}`)
      .then((r) => r.ok ? r.json() : [])
      .then((all: ComercialCompany[]) => {
        if (cancelled) return;
        const picked = all.filter((c) => state.selectedIds.includes(c.id));
        setSelectedCompanies(picked);
        setHydrated(true);
      })
      .catch(markHydrated);

    return () => { cancelled = true; };
  }, [state.line, state.mode, state.selectedIds, hydrated]);

  const handleCompaniesChange = (cs: ComercialCompany[]) => {
    setSelectedCompanies(cs);
    onChange({ selectedIds: cs.map((c) => c.id) });
  };

  return (
    <div className="space-y-6">
      {state.mode === 'auto' ? (
        <div>
          <p className="mb-3 text-sm text-muted-foreground">
            Elige cuántas empresas de <strong className="text-foreground">{state.line || '—'}</strong> quieres escanear.
            El sistema seleccionará las de mayor prioridad (ORO/MONITOREO).
          </p>
          <AutoCountSlider
            value={state.count}
            onChange={(v) => onChange({ count: v })}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Selecciona las empresas a escanear de <strong className="text-foreground">{state.line || '—'}</strong>.
          </p>
          {!state.line ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              Falta seleccionar la línea de negocio en el paso anterior.
            </p>
          ) : (
            <CompanySelector
              line={state.line}
              sublinea={state.sublineas && state.sublineas.length > 0 ? state.sublineas.join(',') : state.sublinea}
              selected={selectedCompanies}
              onChange={handleCompaniesChange}
              maxSelect={20}
            />
          )}

          {/* Selected companies table with tier badges */}
          {selectedCompanies.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">Empresa</th>
                    <th className="px-3 py-2 text-left font-medium">País</th>
                    <th className="px-3 py-2 text-left font-medium">Tier</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedCompanies.map((c) => (
                    <tr key={c.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20">
                      <td className="px-3 py-2 font-medium">{c.name}</td>
                      <td className="px-3 py-2 text-muted-foreground">{c.country}</td>
                      <td className="px-3 py-2">
                        <TierBadge tier={c.tier} />
                      </td>
                    </tr>
                  ))}
                  {/* Total estimado row */}
                  <tr className="bg-muted/30">
                    <td className="px-3 py-2 font-semibold text-foreground" colSpan={2}>
                      <div className="flex items-center gap-1">
                        <DollarSign size={11} className="text-muted-foreground" />
                        Total estimado
                      </div>
                    </td>
                    <td className="px-3 py-2 font-mono font-semibold text-foreground">
                      {costEstimate !== null
                        ? `~$${costEstimate.toFixed(4)}`
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <Collapsible>
        <CollapsibleTrigger
          className={cn(
            'group flex w-full items-center justify-between rounded-lg border border-border',
            'bg-muted/30 px-3 py-2 text-sm hover:bg-muted/60',
          )}
        >
          <span className="font-medium">Fuentes institucionales</span>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="h-5 text-[10px]">
              17 activas
            </Badge>
            <ChevronDown
              size={14}
              className="text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
            />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <div className="space-y-1 rounded-lg border border-border/50 bg-background p-3 text-xs">
            {fuentesGroups.map((f) => (
              <div key={f.country} className="flex flex-wrap items-baseline gap-1.5">
                <span className="font-medium text-foreground">{f.country}:</span>
                <span className="text-muted-foreground">{f.sources.join(', ')}</span>
              </div>
            ))}
            <a
              href="/admin/fuentes"
              className="mt-2 inline-block text-primary hover:underline"
            >
              Editar en admin →
            </a>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Collapsible>
        <CollapsibleTrigger
          className={cn(
            'group flex w-full items-center justify-between rounded-lg border border-border',
            'bg-muted/30 px-3 py-2 text-sm hover:bg-muted/60',
          )}
        >
          <span className="font-medium">Palabras clave</span>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="h-5 text-[10px]">
              {keywords.length}
            </Badge>
            <ChevronDown
              size={14}
              className="text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
            />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <div className="rounded-lg border border-border/50 bg-background p-3">
            <div className="flex flex-wrap gap-1.5">
              {keywords.map((k) => (
                <Badge key={k} variant="outline" className="text-[11px]">
                  {k}
                </Badge>
              ))}
            </div>
            <a
              href="/admin/keywords"
              className="mt-2 inline-block text-xs text-primary hover:underline"
            >
              Editar en admin →
            </a>
            <div className="mt-3 border-t border-border/40 pt-3">
              <label className="mb-1 block text-xs font-medium text-foreground">
                Palabras clave personalizadas
                <span className="ml-1 font-normal text-muted-foreground">(opcional — reemplaza las del sector)</span>
              </label>
              <textarea
                rows={2}
                value={state.customKeywords ?? ''}
                onChange={(e) => onChange({ customKeywords: e.target.value || undefined })}
                placeholder="ej: palletizador ULMA CAPEX licitación 2026"
                className="w-full resize-none rounded-md border border-border bg-muted/30 px-2 py-1.5 text-xs placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Contexto RAG — habilita retrieval de señales pasadas para mejorar precisión */}
      <RagToggle
        enabled={state.ragEnabled}
        onChange={(v) => onChange({ ragEnabled: v })}
        description="Añade contexto de señales de inversión pasadas para mejorar la precisión del agente RADAR"
      />
    </div>
  );
}
