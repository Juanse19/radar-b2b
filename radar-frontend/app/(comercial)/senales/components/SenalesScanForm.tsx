'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Radar, Sparkles, AlertTriangle, X } from 'lucide-react';
import { LINEAS_CONFIG } from '@/lib/comercial/lineas-config';

const PAISES = ['Colombia', 'México', 'Chile', 'Perú', 'Argentina', 'Brasil', 'Panamá'];

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

export function SenalesScanForm() {
  const [linea, setLinea]         = useState<string>('');
  const [subLinea, setSubLinea]   = useState<string>('');
  const [paises, setPaises]       = useState<string[]>([]);
  const [keywordsRaw, setKwsRaw]  = useState<string>('');
  const [maxSenales, setMaxSenales] = useState<number>(10);
  const [provider, setProvider]   = useState<'claude' | 'openai' | 'gemini'>('claude');
  const [running, setRunning]     = useState<boolean>(false);
  const [result, setResult]       = useState<ScanResponse | null>(null);
  const [error, setError]         = useState<string | null>(null);

  const subOptions = LINEAS_CONFIG.find((l) => l.key === linea)?.sublineas ?? [];

  function togglePais(p: string) {
    setPaises((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  const canRun = linea && paises.length > 0 && !running;

  async function run() {
    setError(null);
    setResult(null);
    setRunning(true);
    try {
      const keywords = keywordsRaw
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean);

      const resp = await fetch('/api/radar/scan-signals', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          linea_negocio: linea,
          sub_linea:     subLinea || undefined,
          paises,
          keywords,
          fuentes:       [], // S2 follow-up: cargar desde tabla `fuentes` por sub-línea
          provider,
          max_senales:   maxSenales,
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
      <Card className="space-y-5 p-6">
        <div>
          <Label className="mb-2 block">Línea de negocio</Label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {LINEAS_CONFIG.map((l) => {
              const active = linea === l.key;
              return (
                <button
                  key={l.key}
                  type="button"
                  onClick={() => {
                    setLinea(active ? '' : l.key);
                    setSubLinea('');
                  }}
                  aria-pressed={active}
                  className={
                    'rounded-lg border-2 px-3 py-2.5 text-left text-sm transition-all ' +
                    (active
                      ? 'border-primary bg-primary/20 font-semibold ring-2 ring-primary'
                      : 'border-border bg-muted/30 hover:border-primary/60')
                  }
                >
                  <span className="block font-medium">{l.label}</span>
                  <span className="block text-[11px] text-muted-foreground">{l.description}</span>
                </button>
              );
            })}
          </div>
        </div>

        {subOptions.length > 0 && (
          <div>
            <Label className="mb-2 block">Sub-línea (opcional)</Label>
            <div className="flex flex-wrap gap-1.5">
              {subOptions.map((s) => {
                const active = subLinea === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSubLinea(active ? '' : s)}
                    className={
                      'rounded-full border px-2.5 py-0.5 text-xs transition-all ' +
                      (active
                        ? 'border-primary bg-primary/20 font-medium text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/50')
                    }
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
        )}

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

        <div>
          <Label htmlFor="kw" className="mb-2 block">
            Keywords (separadas por coma o salto de línea)
          </Label>
          <textarea
            id="kw"
            value={keywordsRaw}
            onChange={(e) => setKwsRaw(e.target.value)}
            placeholder="CAPEX, expansión, nueva planta, licitación, BHS"
            rows={3}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Si lo dejás vacío, el agente usa las keywords por defecto de la línea.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="max" className="mb-2 block">Máximo de señales</Label>
            <Input
              id="max"
              type="number"
              min={1}
              max={25}
              value={maxSenales}
              onChange={(e) => setMaxSenales(Math.min(Math.max(Number(e.target.value), 1), 25))}
            />
          </div>
          <div>
            <Label htmlFor="prov" className="mb-2 block">Proveedor IA</Label>
            <select
              id="prov"
              value={provider}
              onChange={(e) => setProvider(e.target.value as 'claude' | 'openai' | 'gemini')}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="claude">Claude (recomendado)</option>
              <option value="openai" disabled>OpenAI (próximamente)</option>
              <option value="gemini" disabled>Gemini (próximamente)</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">
            {linea && paises.length > 0
              ? `Listo para escanear ${paises.length} país${paises.length !== 1 ? 'es' : ''} en ${linea}`
              : 'Selecciona línea y al menos un país'}
          </p>
          <Button onClick={run} disabled={!canRun} size="sm">
            {running ? (
              <>
                <Loader2 size={14} className="mr-2 animate-spin" /> Escaneando…
              </>
            ) : (
              <>
                <Radar size={14} className="mr-2" /> Ejecutar Modo Señales
              </>
            )}
          </Button>
        </div>
      </Card>

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
