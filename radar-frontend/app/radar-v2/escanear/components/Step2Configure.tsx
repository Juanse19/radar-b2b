'use client';

import { useEffect, useState } from 'react';
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
import type { WizardState } from '@/lib/radar-v2/wizard-state';
import type { RadarV2Company } from '@/lib/radar-v2/types';

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
    if (!line || count < 1) { setCost(null); return; }
    let cancelled = false;
    fetch('/api/radar-v2/estimate', {
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

interface Props {
  state:    WizardState;
  onChange: (updates: Partial<WizardState>) => void;
}

export function Step2Configure({ state, onChange }: Props) {
  // The CompanySelector needs a full RadarV2Company[] locally — the URL only
  // persists IDs. We re-hydrate from the /api/radar-v2/companies endpoint.
  const [selectedCompanies, setSelectedCompanies] = useState<RadarV2Company[]>([]);
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
        if (rows.length > 0) {
          const grouped = groupFuentesByCountry(rows);
          if (grouped.length > 0) setFuentesGroups(grouped);
        }
      })
      .catch(() => { /* keep fallback */ });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/keywords')
      .then((r) => r.ok ? r.json() : [])
      .then((data: KeywordApi[] | unknown) => {
        if (cancelled) return;
        const rows: KeywordApi[] = Array.isArray(data) ? data : [];
        const words = rows
          .map((k) => k.palabra ?? '')
          .filter((w) => w.length > 0);
        if (words.length > 0) setKeywords(words.slice(0, 40));  // cap to avoid visual overflow
      })
      .catch(() => { /* keep fallback */ });
    return () => { cancelled = true; };
  }, []);

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
    fetch(`/api/radar-v2/companies?${params}`)
      .then((r) => r.ok ? r.json() : [])
      .then((all: RadarV2Company[]) => {
        if (cancelled) return;
        const picked = all.filter((c) => state.selectedIds.includes(c.id));
        setSelectedCompanies(picked);
        setHydrated(true);
      })
      .catch(markHydrated);

    return () => { cancelled = true; };
  }, [state.line, state.mode, state.selectedIds, hydrated]);

  const handleCompaniesChange = (cs: RadarV2Company[]) => {
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
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
