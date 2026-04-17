'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Zap, AlertCircle } from 'lucide-react';
import { CompanySelector } from './components/CompanySelector';
import { ScanProgress } from './components/ScanProgress';
import { ResultCard } from './components/ResultCard';
import { InformeEjecucion } from './components/InformeEjecucion';
import type { RadarV2Company, RadarV2Result, CompanyScanState } from '@/lib/radar-v2/types';

const LINEA_OPTIONS = [
  { value: 'BHS',             label: 'BHS — Aeropuertos' },
  { value: 'Intralogística',  label: 'Intralogística — CEDI' },
  { value: 'Cartón',          label: 'Cartón Corrugado' },
  { value: 'Final de Línea',  label: 'Final de Línea' },
  { value: 'Motos',           label: 'Motos / Ensambladoras' },
  { value: 'SOLUMAT',         label: 'Solumat — Plásticos' },
];

type PageState = 'idle' | 'scanning' | 'done' | 'error';

export default function RadarV2Page() {
  const [line,        setLine]      = useState('');
  const [companies,   setCompanies] = useState<RadarV2Company[]>([]);
  const [pageState,   setPageState] = useState<PageState>('idle');
  const [scanItems,   setScanItems] = useState<CompanyScanState[]>([]);
  const [results,     setResults]   = useState<RadarV2Result[]>([]);
  const [totalCost,   setTotalCost] = useState(0);
  const [errorMsg,       setErrorMsg]       = useState('');
  const [informeSessionId, setInformeSessionId] = useState<string | null>(null);
  const [showInforme,    setShowInforme]    = useState(false);

  const canScan = line && companies.length > 0 && pageState === 'idle';

  async function handleScan() {
    if (!canScan) return;

    setPageState('scanning');
    setErrorMsg('');
    setResults([]);
    setTotalCost(0);

    // Initialize scan states for progress display
    setScanItems(companies.map(c => ({ company: c, status: 'scanning' })));

    try {
      const res = await fetch('/api/radar-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companies, line }),
      });

      const data = await res.json();

      if (!res.ok && !data.results) {
        throw new Error(data.error ?? 'Scan failed');
      }

      const scanResults: RadarV2Result[] = data.results ?? [];
      const scanErrors: Array<{ empresa: string; error: string }> = data.errors ?? [];

      // Update scan items with final status
      setScanItems(companies.map(c => {
        const r = scanResults.find(r => r.empresa_evaluada === c.name || r.empresa_id === c.id);
        const e = scanErrors.find(e => e.empresa === c.name);
        return {
          company: c,
          status:  r ? 'done' : e ? 'error' : 'done',
          result:  r,
          error:   e?.error,
        };
      }));

      setResults(scanResults);
      setTotalCost(data.total_cost_usd ?? 0);
      if (data.session_id) {
        setInformeSessionId(data.session_id);
        setShowInforme(true);
      }
      setPageState('done');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
      setScanItems(prev => prev.map(item => ({ ...item, status: 'error' as const, error: msg })));
      setPageState('error');
    }
  }

  function handleReset() {
    setPageState('idle');
    setResults([]);
    setScanItems([]);
    setErrorMsg('');
    setTotalCost(0);
  }

  const activeCount    = results.filter(r => r.radar_activo === 'Sí').length;
  const discardedCount = results.filter(r => r.radar_activo === 'No').length;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      {/* Migration banner — Fase B */}
      <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
        <p className="font-medium">✨ Nueva experiencia disponible</p>
        <p className="mt-0.5 text-muted-foreground">
          Hemos reorganizado Radar v2 en submódulos. Usa el sidebar o haz clic en{' '}
          <Link href="/radar-v2/escanear" className="text-primary underline">Escanear</Link>,{' '}
          <Link href="/radar-v2/resultados" className="text-primary underline">Resultados</Link>,{' '}
          <Link href="/radar-v2/metricas" className="text-primary underline">Métricas</Link>.
        </p>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <Zap size={20} className="text-primary" />
            Radar v2
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Detección de señales con Claude Sonnet 4.6 + búsqueda web en tiempo real
          </p>
        </div>
        <Badge variant="secondary" className="text-xs">Agente 1 — Solo detección</Badge>
      </div>

      {/* Config panel */}
      {pageState === 'idle' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Configurar escaneo</CardTitle>
            <CardDescription className="text-xs">
              Selecciona la línea de negocio y las empresas a investigar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Línea de negocio
              </label>
              <Select value={line} onValueChange={v => { setLine(v ?? ''); setCompanies([]); }}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Seleccionar línea..." />
                </SelectTrigger>
                <SelectContent>
                  {LINEA_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {line && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Empresas a escanear
                </label>
                <CompanySelector line={line} selected={companies} onChange={setCompanies} />
              </div>
            )}

            <Button
              className="w-full"
              disabled={!canScan}
              onClick={handleScan}
            >
              <Zap size={15} className="mr-1.5" />
              Ejecutar escaneo v2
              {companies.length > 0 && ` (${companies.length})`}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Scanning progress */}
      {(pageState === 'scanning' || pageState === 'error') && scanItems.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">
              {pageState === 'scanning' ? 'Escaneando...' : 'Escaneo finalizado con errores'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ScanProgress items={scanItems} />
            {errorMsg && (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle size={14} />
                {errorMsg}
              </div>
            )}
            {pageState === 'error' && (
              <Button variant="outline" size="sm" onClick={handleReset}>
                Reintentar
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {pageState === 'done' && (
        <>
          {/* Summary bar */}
          <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-2.5">
            <div className="flex items-center gap-4 text-sm">
              <span>
                <span className="font-semibold text-green-600">{activeCount}</span>
                <span className="ml-1 text-muted-foreground">señales activas</span>
              </span>
              <span>
                <span className="font-semibold text-muted-foreground">{discardedCount}</span>
                <span className="ml-1 text-muted-foreground">descartadas</span>
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                Costo: ${totalCost.toFixed(4)} USD
              </span>
              {informeSessionId && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowInforme(true)}
                >
                  Ver informe
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleReset}>
                Nuevo escaneo
              </Button>
            </div>
          </div>

          {/* ScanProgress summary */}
          <ScanProgress items={scanItems} />

          {/* Result cards */}
          {results.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold">Resultados detallados</h2>
              {results.map((r, i) => (
                <ResultCard key={r.id ?? i} result={r} />
              ))}
            </div>
          )}
        </>
      )}
      <InformeEjecucion
        sessionId={informeSessionId ?? ''}
        open={showInforme}
        onClose={() => setShowInforme(false)}
      />
    </div>
  );
}
