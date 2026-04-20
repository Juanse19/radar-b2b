'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, Loader2, Brain, FileText, Sparkles, Ban, Flag, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button }  from '@/components/ui/button';
import { Input }   from '@/components/ui/input';
import { Label }   from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ResultCard } from '@/app/radar-v2/components/ResultCard';
import type { RadarV2Result } from '@/lib/radar-v2/types';

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
// Component
// ---------------------------------------------------------------------------

export default function InvestigarPage() {
  const [empresa, setEmpresa] = useState('');
  const [pais,    setPais]    = useState('');
  const [linea,   setLinea]   = useState('');
  const [phase,   setPhase]   = useState<Phase>('idle');
  const [lines,   setLines]   = useState<StreamLine[]>([]);
  const [result,  setResult]  = useState<RadarV2Result | null>(null);
  const [errMsg,  setErrMsg]  = useState<string | null>(null);
  const lineIdRef = useRef(0);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const esRef     = useRef<EventSource | null>(null);

  // Auto-scroll to bottom on new stream lines
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [lines.length]);

  // Cleanup EventSource on unmount
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
    setLines(prev => [
      ...prev,
      { id: lineIdRef.current++, icon, color, text },
    ]);
  }

  async function handleInvestigar() {
    if (!canSubmit) return;

    // Reset state
    esRef.current?.close();
    setLines([]);
    setResult(null);
    setErrMsg(null);
    setPhase('connecting');

    const sessionId = crypto.randomUUID();

    let resp: Response;
    try {
      resp = await fetch('/api/radar-v2/deep-scan', {
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

    // EventSource does not support POST, so we use a fresh GET EventSource
    // connecting to a sessionId-scoped replay endpoint is not available here.
    // Instead, we parse the ReadableStream body directly from the fetch response.
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

            pushLine(eventType, data);

            if (eventType === 'session_done') {
              const d = data as Record<string, unknown>;
              if (d.result) setResult(d.result as RadarV2Result);
              setPhase('done');
            }
            if (eventType === 'error') {
              const d = data as Record<string, unknown>;
              setErrMsg(String(d.message ?? 'Error desconocido'));
              setPhase('error');
            }
          }
        }
        // Stream ended without session_done — treat as done if we have lines
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
                disabled={phase === 'connecting' || phase === 'live'}
              />
            </div>

            {/* Pais */}
            <div className="space-y-1.5">
              <Label htmlFor="pais">Pais</Label>
              <Select
                value={pais}
                onValueChange={(v: string | null) => { if (v) setPais(v); }}
                disabled={phase === 'connecting' || phase === 'live'}
              >
                <SelectTrigger id="pais">
                  <SelectValue placeholder="Seleccionar pais" />
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
              <Label htmlFor="linea">Linea de negocio</Label>
              <Select
                value={linea}
                onValueChange={(v: string | null) => { if (v) setLinea(v); }}
                disabled={phase === 'connecting' || phase === 'live'}
              >
                <SelectTrigger id="linea">
                  <SelectValue placeholder="Seleccionar linea" />
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
                {(phase === 'connecting' || phase === 'live') ? (
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

      {/* Stream panel — shown while live or done */}
      {phase !== 'idle' && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              {(phase === 'connecting' || phase === 'live') && (
                <Loader2 size={14} className="animate-spin text-primary" />
              )}
              <CardTitle className="text-sm font-medium">
                {phase === 'connecting' && 'Conectando...'}
                {phase === 'live'       && 'Investigando en tiempo real'}
                {phase === 'done'       && 'Investigacion completada'}
                {phase === 'error'      && 'Error durante la investigacion'}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {/* Stream lines */}
            <div className="max-h-64 overflow-y-auto space-y-1.5 text-sm font-mono">
              {lines.map(line => {
                const Icon = line.icon;
                return (
                  <div key={line.id} className="flex items-start gap-2">
                    <Icon size={14} className={`mt-0.5 shrink-0 ${line.color}`} />
                    <span className="text-muted-foreground leading-snug">{line.text}</span>
                  </div>
                );
              })}
              {(phase === 'connecting' || phase === 'live') && lines.length === 0 && (
                <div className="flex items-center gap-2 text-muted-foreground/60">
                  <Loader2 size={14} className="animate-spin" />
                  <span>Esperando respuesta del modelo...</span>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Error message */}
            {phase === 'error' && errMsg && (
              <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {errMsg}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Result card — shown after completion */}
      {phase === 'done' && result && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Resultado
          </h2>
          <ResultCard result={result} />
        </div>
      )}

      {/* Empty state */}
      {phase === 'idle' && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Search size={36} className="mb-3 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">
              Ingresa el nombre de una empresa para iniciar la investigacion
            </p>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground/70">
              El agente RADAR buscara señales de inversion futura en fuentes oficiales,
              licitaciones, reportes financieros y prensa especializada.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
