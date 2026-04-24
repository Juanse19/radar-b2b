'use client';

import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ExternalLink, Calendar, Tag, DollarSign, Brain, Building2, CheckCircle2, Target, Zap } from 'lucide-react';
import { ScoreBadge } from '@/components/ScoreBadge';
import { LineaBadge } from '@/components/LineaBadge';
import { TierBadge } from '@/components/TierBadge';
import { toast } from 'sonner';
import type { ResultadoRadar } from '@/lib/types';

interface SignalDetailSheetProps {
  signal: ResultadoRadar | null;
  open: boolean;
  onClose: () => void;
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex gap-3 py-2.5 border-b border-border last:border-0">
      <div className="shrink-0 mt-0.5 text-muted-foreground">{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        <p className="text-sm text-gray-200">{value}</p>
      </div>
    </div>
  );
}

export function SignalDetailSheet({ signal, open, onClose }: SignalDetailSheetProps) {
  if (!signal) return null;

  function crearDealHubSpot() {
    toast.info('Integración HubSpot próximamente — el deal se creará automáticamente con Score ≥ 8');
  }

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <SheetContent
        side="right"
        className="bg-surface border-l border-border text-foreground w-full sm:max-w-lg overflow-y-auto"
      >
        <SheetHeader className="pb-4 border-b border-border">
          <SheetTitle className="text-white text-lg leading-tight">{signal.empresa}</SheetTitle>
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <LineaBadge linea={signal.linea} />
            <TierBadge tier={signal.tier} />
            <ScoreBadge score={signal.scoreRadar} />
          </div>
          <p className="text-xs text-muted-foreground mt-1">{signal.pais} · Escaneado: {signal.fechaEscaneo}</p>
        </SheetHeader>

        <div className="py-4 space-y-0">
          {/* Descripción */}
          {signal.descripcion && (
            <div className="pb-4 border-b border-border">
              <p className="text-xs text-muted-foreground mb-2">Descripción de la señal</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{signal.descripcion}</p>
            </div>
          )}

          {/* Razonamiento del agente */}
          {signal.razonamientoAgente && (
            <div className="py-4 border-b border-border">
              <div className="flex items-center gap-2 mb-2">
                <Brain size={14} className="text-purple-400" />
                <p className="text-xs text-purple-400 font-medium">Razonamiento del Agente</p>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed italic">{signal.razonamientoAgente}</p>
            </div>
          )}

          <DetailRow
            icon={<Tag size={14} />}
            label="Tipo de señal"
            value={signal.tipoSenal}
          />
          <DetailRow
            icon={<Calendar size={14} />}
            label="Ventana de compra"
            value={signal.ventanaCompra}
          />
          <DetailRow
            icon={<DollarSign size={14} />}
            label="Ticket estimado"
            value={signal.ticketEstimado}
          />
          <DetailRow
            icon={<Building2 size={14} />}
            label="Prioridad comercial"
            value={signal.prioridadComercial}
          />
          {signal.montoInversion && signal.montoInversion !== 'No reportado' && (
            <DetailRow
              icon={<DollarSign size={14} />}
              label="Monto de inversión"
              value={signal.montoInversion}
            />
          )}
          {signal.fechaSenal && signal.fechaSenal !== 'No disponible' && (
            <DetailRow
              icon={<Calendar size={14} />}
              label="Fecha señal"
              value={signal.fechaSenal}
            />
          )}
          {signal.motivoDescarte && (
            <div className="py-2.5 border-b border-border">
              <p className="text-xs text-muted-foreground mb-0.5">Motivo descarte</p>
              <p className="text-sm text-muted-foreground italic">{signal.motivoDescarte}</p>
            </div>
          )}
          {signal.observacionesMaoa && (
            <div className="py-2.5 border-b border-border">
              <p className="text-xs text-muted-foreground mb-0.5">Observaciones</p>
              <p className="text-sm text-muted-foreground italic">{signal.observacionesMaoa}</p>
            </div>
          )}
        </div>

        {/* ── MAOA Scoring ──────────────────────────────────────────────────── */}
        {(signal.convergenciaMaoa || signal.scoreFinalMaoa != null) && (
          <div className="py-4 border-t border-border space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Target size={14} className="text-violet-400" />
              <p className="text-xs text-violet-400 font-medium uppercase tracking-wider">Scoring MAOA</p>
            </div>

            {/* Convergencia + Acción */}
            <div className="flex items-center gap-3 flex-wrap">
              {signal.convergenciaMaoa && (
                <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium ${
                  signal.convergenciaMaoa === 'Verificada'
                    ? 'bg-green-900/40 text-green-300 border-green-800/50'
                    : signal.convergenciaMaoa === 'Pendiente'
                    ? 'bg-yellow-900/40 text-yellow-300 border-yellow-800/50'
                    : 'bg-surface-muted text-muted-foreground border-border'
                }`}>
                  {signal.convergenciaMaoa === 'Verificada' ? '🟢' : signal.convergenciaMaoa === 'Pendiente' ? '🟡' : '🔴'} {signal.convergenciaMaoa}
                </span>
              )}
              {signal.accionRecomendada && (
                <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-semibold ${
                  signal.accionRecomendada === 'ABM ACTIVADO'
                    ? 'bg-violet-900/50 text-violet-200 border-violet-700'
                    : signal.accionRecomendada === 'MONITOREO ACTIVO'
                    ? 'bg-blue-900/50 text-blue-200 border-blue-700'
                    : 'bg-surface-muted text-muted-foreground border-border'
                }`}>
                  <Zap size={10} />
                  {signal.accionRecomendada}
                </span>
              )}
            </div>

            {/* TIER + TIR scores */}
            {(signal.tierScore != null || signal.tirScore != null) && (
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-surface-muted/50 rounded-lg p-2.5 text-center">
                  <p className="text-xs text-muted-foreground mb-1">TIER</p>
                  <p className="text-lg font-bold text-foreground">{signal.tierClasificacion ?? '—'}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">{signal.tierScore?.toFixed(1) ?? '—'}/10</p>
                </div>
                <div className="bg-surface-muted/50 rounded-lg p-2.5 text-center">
                  <p className="text-xs text-muted-foreground mb-1">TIR</p>
                  <p className="text-lg font-bold text-foreground">{signal.tirClasificacion ?? '—'}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">{signal.tirScore?.toFixed(1) ?? '—'}/10</p>
                </div>
                <div className="bg-violet-900/20 border border-violet-800/40 rounded-lg p-2.5 text-center">
                  <p className="text-xs text-violet-400 mb-1">Score Final</p>
                  <p className="text-lg font-bold text-violet-200">{signal.scoreFinalMaoa?.toFixed(1) ?? '—'}</p>
                  <p className="text-xs text-muted-foreground">/10</p>
                </div>
              </div>
            )}

            {/* Criterios cumplidos */}
            {signal.criteriosCumplidos && signal.criteriosCumplidos.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">
                  Criterios cumplidos ({signal.totalCriterios ?? signal.criteriosCumplidos.length}/6)
                </p>
                <ul className="space-y-1">
                  {signal.criteriosCumplidos.map((c, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs text-gray-300">
                      <CheckCircle2 size={11} className="text-green-400 shrink-0" />
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Signal ID */}
            {signal.signalId && (
              <p className="text-xs text-muted-foreground font-mono">
                ID: <span className="text-gray-300">{signal.signalId}</span>
              </p>
            )}
          </div>
        )}

        {/* Fuente */}
        {(signal.fuente || signal.fuenteUrl) && (
          <div className="py-4 border-t border-border">
            <p className="text-xs text-muted-foreground mb-2">Fuente de la señal</p>
            {signal.fuenteUrl ? (
              <a
                href={signal.fuenteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300"
              >
                <ExternalLink size={14} />
                {signal.fuente || signal.fuenteUrl}
              </a>
            ) : (
              <p className="text-sm text-muted-foreground">{signal.fuente}</p>
            )}
          </div>
        )}

        {/* Acción HubSpot */}
        <div className="pt-4 border-t border-border">
          <Button
            onClick={crearDealHubSpot}
            className="w-full bg-orange-700 hover:bg-orange-600 text-foreground gap-2"
          >
            Crear Deal en HubSpot
          </Button>
          <p className="text-xs text-muted-foreground text-center mt-2">
            Disponible para señales con Score ORO (≥8)
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
