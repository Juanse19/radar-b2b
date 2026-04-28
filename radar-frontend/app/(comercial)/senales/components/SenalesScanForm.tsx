'use client';

import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible';
import { Loader2, Radar, Sparkles, AlertTriangle, X, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LineaSelectorCards } from '@/components/agent/LineaSelectorCards';
import { Stepper } from '../../escanear/components/Stepper';
import type { ParentLineaItem } from '@/app/api/comercial/lineas-tree/route';

const PAISES = ['Colombia', 'México', 'Chile', 'Perú', 'Argentina', 'Brasil', 'Panamá'];

const FALLBACK_KEYWORDS = ['CAPEX', 'inversión', 'licitación', 'expansión', 'nueva planta'];

interface FuenteApi {
  nombre?: string;
  url_base?: string | null;
  lineas?: string[] | null;
  pais?: string | null;
  country?: string | null;
}

interface KeywordApi {
  palabra?: string;
  sub_linea_id?: number | null;
}

interface PersistedSignal {
  id: string;
  empresa_id: number | null;
  empresa_nombre: string;
  empresa_es_nueva: boolean;
  tipo_senal: string | null;
  descripcion: string | null;
  ventana_compra: string | null;
  nivel_confianza: 'ALTA' | 'MEDIA' | 'BAJA' | null;
  pais: string | null;
}

interface ScanResponse {
  session_id: string | null;
  total_senales: number;
  empresas_nuevas: number;
  signals: PersistedSignal[];
  resumen_busqueda: string;
  cost?: { tokens_input: number; tokens_output: number; cost_usd: number; search_calls: number; model: string };
}

function groupFuentesByCountry(rows: FuenteApi[]): Array<{ country: string; sources: string[] }> {
  const groups = new Map<string, string[]>();
  for (const f of rows) {
    const country = f.pais ?? f.country ?? 'Otros';
    const name = f.nombre ?? '';
    if (!name) continue;
    const existing = groups.get(country) ?? [];
    if (!existing.includes(name)) existing.push(name);
    groups.set(country, existing);
  }
  return Array.from(groups.entries()).map(([country, sources]) => ({ country, sources }));
}

function resolveSubLineaIds(tree: ParentLineaItem[], line: string, subLinea: string): number[] {
  const parent = tree.find((p) => p.label === line);
  if (!parent) return [];
  const pool = subLinea
    ? parent.subLineas.filter((s) => s.value === subLinea || s.label === subLinea)
    : parent.subLineas;
  return pool.map((s) => s.id).filter((id): id is number => id !== null);
}

export function SenalesScanForm() {
  const [step, setStep]           = useState<1 | 2 | 3>(1);
  const [linea, setLinea]         = useState<string>('');
  const [subLinea, setSubLinea]   = useState<string>('');
  const [paises, setPaises]       = useState<string[]>([]);
  const [keywordsRaw, setKwsRaw]  = useState<string>('');
  const [maxSenales, setMaxSenales] = useState<number>(10);
  const [provider, setProvider]   = useState<'claude' | 'openai' | 'gemini'>('claude');
  const [running, setRunning]     = useState<boolean>(false);
  const [result, setResult]       = useState<ScanResponse | null>(null);
  const [error, setError]         = useState<string | null>(null);

  // Fuentes + Keywords — resolved from selected line for display and payload
  const [lineasTree,    setLineasTree]    = useState<ParentLineaItem[]>([]);
  const [fuentesGroups, setFuentesGroups] = useState<Array<{ country: string; sources: string[] }>>([]);
  const [dbKeywords,    setDbKeywords]    = useState<string[]>(FALLBACK_KEYWORDS);
  const allFuentesRef = useRef<FuenteApi[]>([]);

  useEffect(() => {
    fetch('/api/comercial/lineas-tree')
      .then((r) => r.ok ? r.json() : [])
      .then((data: ParentLineaItem[]) => { if (Array.isArray(data)) setLineasTree(data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/fuentes')
      .then((r) => r.ok ? r.json() : [])
      .then((data: unknown) => {
        if (cancelled) return;
        const rows: FuenteApi[] = Array.isArray(data) ? data
          : (data && typeof data === 'object' && Array.isArray((data as { data?: unknown }).data))
              ? ((data as { data: FuenteApi[] }).data) : [];
        allFuentesRef.current = rows;
        applyFuentesFilter(rows, linea);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (allFuentesRef.current.length > 0) applyFuentesFilter(allFuentesRef.current, linea);
  }, [linea]);

  function applyFuentesFilter(rows: FuenteApi[], line: string) {
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

  useEffect(() => {
    let cancelled = false;
    const ids = resolveSubLineaIds(lineasTree, linea, subLinea);

    if (ids.length === 0) {
      if (!linea) return;
      fetch('/api/admin/keywords')
        .then((r) => r.ok ? r.json() : [])
        .then((data: unknown) => {
          if (cancelled) return;
          const rows: KeywordApi[] = Array.isArray(data) ? data : [];
          const words = rows.map((k) => k.palabra ?? '').filter((w) => w.length > 0);
          if (words.length > 0) setDbKeywords(words.slice(0, 40));
        })
        .catch(() => {});
      return () => { cancelled = true; };
    }

    Promise.all(
      ids.map((id) =>
        fetch(`/api/admin/keywords?sub_linea_id=${id}`)
          .then((r) => r.ok ? r.json() : [])
          .then((data: unknown): KeywordApi[] => Array.isArray(data) ? data : [])
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
      setDbKeywords(words.length > 0 ? words.slice(0, 40) : FALLBACK_KEYWORDS);
    });

    return () => { cancelled = true; };
  }, [lineasTree, linea, subLinea]);

  function togglePais(p: string) {
    setPaises((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  const canRun = linea && paises.length > 0 && !running;
  const canNext =
    step === 1 ? Boolean(linea) :
    step === 2 ? paises.length > 0 :
    false;

  async function run() {
    setError(null);
    setResult(null);
    setRunning(true);
    try {
      const customKws = keywordsRaw
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean);
      // Merge DB keywords with custom ones (custom takes priority, placed first)
      const keywords = customKws.length > 0 ? customKws : dbKeywords;
      // Collect fuentes from DB (raw names for the payload)
      const fuentes = allFuentesRef.current
        .filter((f) => f.nombre)
        .map((f) => ({ nombre: f.nombre!, url_base: f.url_base ?? undefined }));

      const resp = await fetch('/api/radar/scan-signals', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          linea_negocio: linea,
          sub_linea:     subLinea || undefined,
          paises,
          keywords,
          fuentes,
          provider,
          max_senales: maxSenales,
        }),
      });
      const data = (await resp.json()) as ScanResponse | { error: string };
      if (!resp.ok || 'error' in data) {
        setError(('error' in data && data.error) || `HTTP ${resp.status}`);
        return;
      }
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-6">
      <Stepper current={step} onGoto={(s) => setStep(s)} />

      <Card className="p-6">
        {/* Step 1 — Línea + Sub-línea */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <Label className="mb-2 block">Línea de negocio</Label>
              <LineaSelectorCards
                value={linea}
                onChange={(v) => { setLinea(v === 'ALL' ? '' : v); setSubLinea(''); }}
                sublinea={subLinea || undefined}
                onSublineaChange={(s) => setSubLinea(s ?? '')}
              />
            </div>
          </div>
        )}

        {/* Step 2 — Fuentes + Keywords + Países + Máximo */}
        {step === 2 && (
          <div className="space-y-5">
            {/* Fuentes institucionales from DB (T3/T4) */}
            {fuentesGroups.length > 0 && (
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
                      {fuentesGroups.reduce((n, g) => n + g.sources.length, 0)} activas
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
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Keywords from DB (T2/T4) */}
            <Collapsible>
              <CollapsibleTrigger
                className={cn(
                  'group flex w-full items-center justify-between rounded-lg border border-border',
                  'bg-muted/30 px-3 py-2 text-sm hover:bg-muted/60',
                )}
              >
                <span className="font-medium">Palabras clave del sector</span>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="h-5 text-[10px]">{dbKeywords.length}</Badge>
                  <ChevronDown
                    size={14}
                    className="text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
                  />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <div className="rounded-lg border border-border/50 bg-background p-3">
                  <div className="flex flex-wrap gap-1.5">
                    {dbKeywords.map((k) => (
                      <Badge key={k} variant="outline" className="text-[11px]">{k}</Badge>
                    ))}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Countries */}
            <div>
              <Label className="mb-2 block">Países objetivo</Label>
              <div className="flex flex-wrap gap-1.5">
                {PAISES.map((p) => {
                  const active = paises.includes(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => togglePais(p)}
                      className={
                        'rounded-full border px-3 py-1 text-xs transition-all ' +
                        (active
                          ? 'border-primary bg-primary/20 font-medium text-primary'
                          : 'border-border text-muted-foreground hover:border-primary/50')
                      }
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom keywords override */}
            <div>
              <Label htmlFor="kw" className="mb-2 block">
                Palabras clave adicionales
                <span className="ml-1 font-normal text-muted-foreground">(opcional — reemplaza las del sector)</span>
              </Label>
              <textarea
                id="kw"
                value={keywordsRaw}
                onChange={(e) => setKwsRaw(e.target.value)}
                placeholder="ej: nueva concesión aeroportuaria terminal T3 CAPEX 2026"
                rows={2}
                className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <Label htmlFor="max" className="mb-2 block">Máximo de señales a devolver</Label>
              <Input
                id="max"
                type="number"
                min={1}
                max={25}
                value={maxSenales}
                onChange={(e) => setMaxSenales(Math.min(Math.max(Number(e.target.value), 1), 25))}
              />
            </div>
          </div>
        )}

        {/* Step 3 — Provider + Resumen + Ejecutar */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <Label htmlFor="prov" className="mb-2 block">Proveedor IA</Label>
              <select
                id="prov"
                value={provider}
                onChange={(e) => setProvider(e.target.value as 'claude' | 'openai' | 'gemini')}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="claude">Claude Sonnet 4.6 (recomendado · web search)</option>
                <option value="openai" disabled>OpenAI (próximamente)</option>
                <option value="gemini" disabled>Gemini (próximamente)</option>
              </select>
            </div>

            <div className="rounded-md border border-border bg-muted/30 p-4 text-sm">
              <p className="font-medium">Resumen del escaneo</p>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                <li>· <strong className="text-foreground">{linea}</strong>{subLinea && <> · <strong className="text-foreground">{subLinea}</strong></>}</li>
                <li>· {paises.length} país{paises.length !== 1 ? 'es' : ''}: {paises.join(', ')}</li>
                <li>· {keywordsRaw.split(/[\n,]/).filter(Boolean).length || dbKeywords.length} keywords · {fuentesGroups.reduce((n, g) => n + g.sources.length, 0)} fuentes</li>
                <li>· máximo {maxSenales} señales · provider <strong className="text-foreground">{provider}</strong></li>
              </ul>
            </div>

            <Button onClick={run} disabled={!canRun} size="sm" className="w-full">
              {running ? (
                <><Loader2 size={14} className="mr-2 animate-spin" /> Escaneando…</>
              ) : (
                <><Radar size={14} className="mr-2" /> Ejecutar Modo Señales</>
              )}
            </Button>
          </div>
        )}
      </Card>

      {/* Navegación */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setStep((step - 1) as 1 | 2 | 3)}
          disabled={step === 1}
        >
          <ChevronLeft size={14} className="mr-1" /> Atrás
        </Button>
        {step < 3 ? (
          <Button size="sm" onClick={() => setStep((step + 1) as 1 | 2 | 3)} disabled={!canNext}>
            Siguiente <ChevronRight size={14} className="ml-1" />
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">Revisa y ejecuta arriba</span>
        )}
      </div>

      {error && (
        <Card className="flex items-start gap-3 border-destructive bg-destructive/5 p-4 text-sm">
          <AlertTriangle size={16} className="mt-0.5 text-destructive" />
          <div className="flex-1">
            <p className="font-medium text-destructive">Error</p>
            <p className="text-muted-foreground">{error}</p>
          </div>
          <button onClick={() => setError(null)} aria-label="Cerrar">
            <X size={14} />
          </button>
        </Card>
      )}

      {result && <SignalsResultsList data={result} />}
    </div>
  );
}

function SignalsResultsList({ data }: { data: ScanResponse }) {
  return (
    <div className="space-y-4">
      <Card className="flex items-center justify-between p-4">
        <div>
          <p className="text-sm font-medium">
            <Sparkles size={14} className="mr-1 inline text-primary" />
            {data.total_senales} señal{data.total_senales !== 1 ? 'es' : ''} encontrada
            {data.total_senales !== 1 ? 's' : ''}
            {data.empresas_nuevas > 0 && (
              <Badge variant="outline" className="ml-2">
                {data.empresas_nuevas} empresa{data.empresas_nuevas !== 1 ? 's' : ''} nueva{data.empresas_nuevas !== 1 ? 's' : ''}
              </Badge>
            )}
          </p>
          {data.resumen_busqueda && (
            <p className="mt-1 text-xs text-muted-foreground">{data.resumen_busqueda}</p>
          )}
        </div>
        {data.cost && (
          <div className="text-right text-xs text-muted-foreground">
            <p>{data.cost.search_calls} búsquedas · {data.cost.tokens_input + data.cost.tokens_output} tokens</p>
            <p className="font-mono">USD {data.cost.cost_usd.toFixed(4)}</p>
          </div>
        )}
      </Card>

      <div className="space-y-3">
        {data.signals.map((s) => (
          <SignalCard key={s.id} signal={s} />
        ))}
      </div>
    </div>
  );
}

function SignalCard({ signal: s }: { signal: PersistedSignal }) {
  const confianzaColor =
    s.nivel_confianza === 'ALTA' ? 'border-emerald-500 text-emerald-600 bg-emerald-500/10'
    : s.nivel_confianza === 'MEDIA' ? 'border-amber-500 text-amber-600 bg-amber-500/10'
    : 'border-muted-foreground text-muted-foreground bg-muted/40';

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{s.empresa_nombre}</h3>
            {s.empresa_es_nueva && (
              <Badge variant="outline" className="border-primary text-primary">Empresa nueva</Badge>
            )}
            {s.pais && <span className="text-xs text-muted-foreground">· {s.pais}</span>}
          </div>
          {s.tipo_senal && (
            <p className="mt-1 text-xs font-medium text-primary">{s.tipo_senal}</p>
          )}
          {s.descripcion && (
            <p className="mt-2 text-sm text-muted-foreground line-clamp-3">{s.descripcion}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5">
          {s.nivel_confianza && (
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${confianzaColor}`}>
              {s.nivel_confianza}
            </span>
          )}
          {s.ventana_compra && (
            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
              {s.ventana_compra}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
