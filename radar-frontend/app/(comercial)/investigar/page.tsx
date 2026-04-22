'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Search, Loader2, Brain, FileText, Sparkles, Ban, Flag,
  AlertTriangle, ExternalLink, CheckCircle2, XCircle, Building2,
  MapPin, Layers, DollarSign, Calendar, Link2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button }  from '@/components/ui/button';
import { Input }   from '@/components/ui/input';
import { Label }   from '@/components/ui/label';
import { Badge }   from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs';
import { ResultCard } from '@/app/comercial/components/ResultCard';
import { cn } from '@/lib/utils';
import type { ComercialResult } from '@/lib/comercial/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAISES = [
  'Colombia', 'México', 'Chile', 'Perú', 'Argentina', 'Brasil',
  'Centroamérica', 'Panamá', 'Ecuador', 'Bolivia',
] as const;

const LINEAS = [
  'BHS',
  'Intralogística',
  'Cartón Corrugado',
  'Final de Línea',
  'Motos',
  'Solumat',
] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Phase = 'idle' | 'connecting' | 'live' | 'done' | 'error';

interface StreamLine {
  id:    number;
  icon:  React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  text:  string;
}

interface Source {
  id:       number;
  title:    string;
  url:      string;
  snippet?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function iconAndColor(eventType: string): {
  icon:  React.ComponentType<{ size?: number; className?: string }>;
  color: string;
} {
  switch (eventType) {
    case 'thinking':        return { icon: Brain,         color: 'text-muted-foreground' };
    case 'search_query':    return { icon: Search,        color: 'text-primary' };
    case 'reading_source':  return { icon: FileText,      color: 'text-primary/70' };
    case 'signal_detected': return { icon: Sparkles,      color: 'text-emerald-500' };
    case 'signal_discarded':return { icon: Ban,           color: 'text-red-400' };
    case 'session_done':    return { icon: Flag,          color: 'text-emerald-500' };
    case 'error':           return { icon: AlertTriangle, color: 'text-destructive' };
    default:                return { icon: Loader2,       color: 'text-muted-foreground' };
  }
}

function labelForEvent(type: string, data: unknown): string {
  const d = (typeof data === 'object' && data !== null) ? data as Record<string, unknown> : {};
  switch (type) {
    case 'scan_started':    return `Iniciando investigación profunda de ${String(d.empresas ?? '')}`;
    case 'thinking':        return `Analizando: ${String(d.empresa ?? d.linea ?? '')}`;
    case 'search_query':    return `Buscando: ${String(d.query ?? '')}`;
    case 'reading_source':  return `Leyendo fuente: ${String(d.title ?? d.url ?? '')}`;
    case 'criteria_eval':   return `Criterio "${String(d.criterio ?? '')}": ${d.cumplido ? 'cumplido' : 'no cumplido'}`;
    case 'signal_detected': return `Señal detectada — ${String(d.tipo_senal ?? '')} · ${String(d.ventana_compra ?? '')}`;
    case 'signal_discarded':return `Sin señal activa para ${String(d.empresa ?? '')}`;
    case 'token_tick':      return `Tokens: ${String(d.total_tokens ?? '')}`;
    case 'company_done':    return `Investigación completada`;
    case 'company_error':   return `Error: ${String(d.error ?? '')}`;
    case 'session_done':    return `Finalizado — costo: $${Number(d.total_cost_usd ?? 0).toFixed(4)}`;
    case 'error':           return `Error: ${String(d.message ?? '')}`;
    default:                return type;
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function EmpresaTab({ result }: { result: ComercialResult }) {
  const active = result.radar_activo === 'Sí';

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Building2 size={20} className="text-primary" />
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold leading-tight">{result.empresa_evaluada}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {result.pais && (
              <span className="flex items-center gap-1">
                <MapPin size={11} /> {result.pais}
              </span>
            )}
            {result.linea_negocio && (
              <span className="flex items-center gap-1">
                <Layers size={11} /> {result.linea_negocio}
              </span>
            )}
          </div>
        </div>
        <Badge
          className={cn(
            'ml-auto shrink-0 text-xs font-semibold',
            active
              ? 'bg-green-500/15 text-green-700 dark:text-green-400 hover:bg-green-500/25'
              : 'bg-red-500/15 text-red-600 hover:bg-red-500/25',
          )}
          variant="secondary"
        >
          {active ? '✓ Señal activa' : '✗ Sin señal'}
        </Badge>
      </div>

      {/* Descripción */}
      {result.descripcion_resumen && (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Resumen
          </p>
          <p className="text-sm leading-relaxed text-foreground/85">{result.descripcion_resumen}</p>
        </div>
      )}

      {/* Key facts grid */}
      <div className="grid gap-3 sm:grid-cols-2">
        {result.tipo_senal && result.tipo_senal !== 'Sin Señal' && (
          <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tipo de señal</p>
            <p className="mt-1 text-sm font-medium">{result.tipo_senal}</p>
          </div>
        )}
        {result.ventana_compra && result.ventana_compra !== 'Sin señal' && (
          <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Calendar size={10} className="inline mr-1" />Ventana de compra
            </p>
            <p className="mt-1 text-sm font-medium">{result.ventana_compra}</p>
          </div>
        )}
        {result.monto_inversion && result.monto_inversion !== 'No reportado' && (
          <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <DollarSign size={10} className="inline mr-1" />Monto estimado
            </p>
            <p className="mt-1 text-sm font-medium">{result.monto_inversion}</p>
          </div>
        )}
        {result.empresa_o_proyecto && result.empresa_o_proyecto !== 'No aplica' && (
          <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Proyecto / Licitación</p>
            <p className="mt-1 text-sm font-medium line-clamp-2">{result.empresa_o_proyecto}</p>
          </div>
        )}
      </div>

      {/* Criterios */}
      {result.criterios_cumplidos?.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Criterios MAOA ({result.criterios_cumplidos.length}/{result.total_criterios} cumplidos)
          </p>
          <ul className="space-y-1.5">
            {result.criterios_cumplidos.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-500" />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Motivo descarte */}
      {!active && result.motivo_descarte && result.motivo_descarte !== 'N/A' && (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Motivo de descarte</p>
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 dark:border-red-900/30 dark:bg-red-950/20">
            <XCircle size={14} className="mt-0.5 shrink-0 text-red-500" />
            <p className="text-sm text-red-700 dark:text-red-400">{result.motivo_descarte}</p>
          </div>
        </div>
      )}

      {/* Primary source */}
      {result.fuente_link && result.fuente_link !== 'No disponible' && (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Link2 size={10} className="inline mr-1" />Fuente principal
          </p>
          <a
            href={result.fuente_link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-2 text-xs text-primary hover:bg-muted transition-colors"
          >
            <ExternalLink size={12} />
            <span className="truncate max-w-xs">{result.fuente_nombre || result.fuente_link}</span>
          </a>
          {result.fecha_senal && result.fecha_senal !== 'No disponible' && (
            <p className="mt-1 text-xs text-muted-foreground">{result.fecha_senal}</p>
          )}
        </div>
      )}

      {/* Observaciones */}
      {result.observaciones && (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Observaciones</p>
          <p className="text-xs italic text-muted-foreground">{result.observaciones}</p>
        </div>
      )}

      {/* Token cost */}
      {result.cost_usd != null && (
        <p className="text-right text-[10px] text-muted-foreground/60">
          Costo del scan: ${result.cost_usd.toFixed(4)} USD
          {result.tokens_input ? ` · ${result.tokens_input.toLocaleString()} tokens` : ''}
        </p>
      )}
    </div>
  );
}

function FuentesTab({ sources }: { sources: Source[] }) {
  if (sources.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <FileText size={28} className="mb-2 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">No se registraron fuentes aún</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sources.map(src => (
        <div key={src.id} className="rounded-lg border bg-background p-3 hover:bg-muted/40 transition-colors">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium leading-snug line-clamp-2">{src.title}</p>
              {src.url && (
                <a
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary truncate max-w-full"
                >
                  <ExternalLink size={10} className="shrink-0" />
                  <span className="truncate">{src.url}</span>
                </a>
              )}
              {src.snippet && (
                <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2 italic">
                  {src.snippet}
                </p>
              )}
            </div>
            <span className="shrink-0 text-[10px] text-muted-foreground/60 font-mono">
              #{src.id + 1}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function InvestigarPage() {
  const [empresa, setEmpresa] = useState('');
  const [pais,    setPais]    = useState('');
  const [linea,   setLinea]   = useState('');
  const [phase,   setPhase]   = useState<Phase>('idle');
  const [lines,   setLines]   = useState<StreamLine[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [result,  setResult]  = useState<ComercialResult | null>(null);
  const [errMsg,  setErrMsg]  = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('live');
  const lineIdRef   = useRef(0);
  const sourceIdRef = useRef(0);
  const bottomRef   = useRef<HTMLDivElement | null>(null);
  const esRef       = useRef<EventSource | null>(null);

  // Auto-scroll the stream log
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [lines.length]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { esRef.current?.close(); };
  }, []);

  const canSubmit =
    empresa.trim().length > 0 &&
    pais.trim().length    > 0 &&
    linea.trim().length   > 0 &&
    phase !== 'connecting' &&
    phase !== 'live';

  function pushLine(type: string, data: unknown) {
    const { icon, color } = iconAndColor(type);
    const text = labelForEvent(type, data);
    setLines(prev => [...prev, { id: lineIdRef.current++, icon, color, text }]);
  }

  async function handleInvestigar() {
    if (!canSubmit) return;

    // Reset all state
    esRef.current?.close();
    setLines([]);
    setSources([]);
    setResult(null);
    setErrMsg(null);
    setPhase('connecting');
    setActiveTab('live');
    lineIdRef.current   = 0;
    sourceIdRef.current = 0;

    const sessionId = crypto.randomUUID();

    let resp: Response;
    try {
      resp = await fetch('/api/comercial/deep-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresa: empresa.trim(),
          pais:    pais.trim(),
          linea:   linea.trim(),
          sessionId,
        }),
      });
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : 'Error de red');
      setPhase('error');
      return;
    }

    if (!resp.ok) {
      const text = await resp.text().catch(() => resp.statusText);
      setErrMsg(`${resp.status}: ${text}`);
      setPhase('error');
      return;
    }

    setPhase('live');

    const reader = resp.body?.getReader();
    if (!reader) {
      setErrMsg('No response stream');
      setPhase('error');
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    (async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() ?? '';

          for (const chunk of parts) {
            if (!chunk.trim()) continue;
            let eventType = 'message';
            let dataStr   = '';
            for (const line of chunk.split('\n')) {
              if (line.startsWith('event: ')) eventType = line.slice(7).trim();
              if (line.startsWith('data: '))  dataStr   = line.slice(6);
            }
            let data: unknown = dataStr;
            try { data = JSON.parse(dataStr); } catch { /* raw string is fine */ }

            // Capture sources for the Fuentes tab
            if (eventType === 'reading_source') {
              const d = data as Record<string, unknown>;
              const url = String(d.url ?? '');
              const title = String(d.title ?? url ?? 'Sin título');
              if (url || title) {
                setSources(prev => [
                  ...prev,
                  {
                    id:      sourceIdRef.current++,
                    title,
                    url,
                    snippet: d.snippet ? String(d.snippet) : undefined,
                  },
                ]);
              }
            }

            pushLine(eventType, data);

            if (eventType === 'session_done') {
              const d = data as Record<string, unknown>;
              if (d.result) {
                setResult(d.result as ComercialResult);
                setActiveTab('empresa'); // auto-switch to company tab
              }
              setPhase('done');
            }
            if (eventType === 'error') {
              const d = data as Record<string, unknown>;
              setErrMsg(String(d.message ?? 'Error desconocido'));
              setPhase('error');
            }
          }
        }
        setPhase(prev => (prev === 'live' ? 'done' : prev));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg !== 'The user aborted a request.') {
          setErrMsg(msg);
          setPhase('error');
        }
      }
    })();
  }

  const isRunning = phase === 'connecting' || phase === 'live';
  const showPanel = phase !== 'idle';

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <Search size={20} className="text-primary" />
          Investigación Individual
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Investigación profunda de una empresa con el Agente 1 RADAR (MAOA).
          Usa búsqueda web en tiempo real para detectar señales de inversión.
        </p>
      </div>

      {/* Search card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Empresa a investigar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            {/* Empresa */}
            <div className="sm:col-span-3 space-y-1.5">
              <Label htmlFor="empresa">Empresa</Label>
              <Input
                id="empresa"
                placeholder="Ej. Grupo Bimbo, Aeropuerto El Dorado, SMURFIT..."
                value={empresa}
                onChange={e => setEmpresa(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleInvestigar(); }}
                disabled={isRunning}
              />
            </div>

            {/* Pais */}
            <div className="space-y-1.5">
              <Label htmlFor="pais">País</Label>
              <Select
                value={pais}
                onValueChange={(v: string | null) => { if (v) setPais(v); }}
                disabled={isRunning}
              >
                <SelectTrigger id="pais">
                  <SelectValue placeholder="Seleccionar país" />
                </SelectTrigger>
                <SelectContent>
                  {PAISES.map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Linea de negocio */}
            <div className="space-y-1.5">
              <Label htmlFor="linea">Línea de negocio</Label>
              <Select
                value={linea}
                onValueChange={(v: string | null) => { if (v) setLinea(v); }}
                disabled={isRunning}
              >
                <SelectTrigger id="linea">
                  <SelectValue placeholder="Seleccionar línea" />
                </SelectTrigger>
                <SelectContent>
                  {LINEAS.map(l => (
                    <SelectItem key={l} value={l}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Submit */}
            <div className="flex items-end">
              <Button
                onClick={handleInvestigar}
                disabled={!canSubmit}
                className="w-full"
              >
                {isRunning ? (
                  <>
                    <Loader2 size={16} className="mr-2 animate-spin" />
                    Investigando...
                  </>
                ) : (
                  <>
                    <Search size={16} className="mr-2" />
                    Investigar
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results panel — shown once scan starts */}
      {showPanel && (
        <Card>
          {/* Card header with status */}
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {isRunning && <Loader2 size={14} className="animate-spin text-primary shrink-0" />}
                <CardTitle className="text-sm font-medium">
                  {phase === 'connecting' && 'Conectando con el agente RADAR...'}
                  {phase === 'live'       && `Investigando ${empresa}...`}
                  {phase === 'done'       && `Investigación completada · ${empresa}`}
                  {phase === 'error'      && 'Error durante la investigación'}
                </CardTitle>
              </div>
              {phase === 'done' && result && (
                <Badge
                  className={cn(
                    'shrink-0 text-xs',
                    result.radar_activo === 'Sí'
                      ? 'bg-green-500/15 text-green-700 dark:text-green-400'
                      : 'bg-red-500/15 text-red-600',
                  )}
                  variant="secondary"
                >
                  {result.radar_activo === 'Sí' ? '✓ Señal activa' : '✗ Sin señal'}
                </Badge>
              )}
            </div>
          </CardHeader>

          <CardContent className="pt-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                {/* En vivo */}
                <TabsTrigger value="live" className="gap-1.5 text-xs">
                  {isRunning
                    ? <Loader2 size={12} className="animate-spin" />
                    : <Brain size={12} />
                  }
                  En vivo
                  {lines.length > 0 && (
                    <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-mono leading-none">
                      {lines.length}
                    </span>
                  )}
                </TabsTrigger>

                {/* Empresa / Contexto */}
                <TabsTrigger
                  value="empresa"
                  disabled={!result}
                  className="gap-1.5 text-xs"
                >
                  <Building2 size={12} />
                  Empresa
                </TabsTrigger>

                {/* Resultado / Señal */}
                <TabsTrigger
                  value="resultado"
                  disabled={!result}
                  className="gap-1.5 text-xs"
                >
                  <Sparkles size={12} />
                  Señal
                </TabsTrigger>

                {/* Fuentes */}
                <TabsTrigger value="fuentes" className="gap-1.5 text-xs">
                  <FileText size={12} />
                  Fuentes
                  {sources.length > 0 && (
                    <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-mono leading-none">
                      {sources.length}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* Tab: En vivo */}
              <TabsContent value="live">
                <div className="max-h-72 overflow-y-auto space-y-1.5 text-sm font-mono pr-1">
                  {lines.map(line => {
                    const Icon = line.icon;
                    return (
                      <div key={line.id} className="flex items-start gap-2">
                        <Icon size={13} className={`mt-0.5 shrink-0 ${line.color}`} />
                        <span className="text-muted-foreground leading-snug">{line.text}</span>
                      </div>
                    );
                  })}
                  {isRunning && lines.length === 0 && (
                    <div className="flex items-center gap-2 text-muted-foreground/60">
                      <Loader2 size={13} className="animate-spin" />
                      <span>Esperando respuesta del modelo...</span>
                    </div>
                  )}
                  <div ref={bottomRef} />
                </div>
              </TabsContent>

              {/* Tab: Empresa (company context) */}
              <TabsContent value="empresa">
                {result ? (
                  <EmpresaTab result={result} />
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <Building2 size={28} className="mb-2 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">Esperando resultados...</p>
                  </div>
                )}
              </TabsContent>

              {/* Tab: Señal (ResultCard) */}
              <TabsContent value="resultado">
                {result ? (
                  <ResultCard result={result} />
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <Sparkles size={28} className="mb-2 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">Esperando resultados...</p>
                  </div>
                )}
              </TabsContent>

              {/* Tab: Fuentes */}
              <TabsContent value="fuentes">
                <FuentesTab sources={sources} />
              </TabsContent>
            </Tabs>

            {/* Error message */}
            {phase === 'error' && errMsg && (
              <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {errMsg}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {phase === 'idle' && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Search size={36} className="mb-3 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">
              Ingresa el nombre de una empresa para iniciar la investigación
            </p>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground/70">
              El agente RADAR buscará señales de inversión futura en fuentes oficiales,
              licitaciones, reportes financieros y prensa especializada.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
