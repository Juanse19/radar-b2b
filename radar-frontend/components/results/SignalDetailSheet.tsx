'use client';

import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ExternalLink, Calendar, Tag, DollarSign, Brain, Building2 } from 'lucide-react';
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
          {signal.motivoDescarte && (
            <div className="py-2.5 border-b border-border">
              <p className="text-xs text-muted-foreground mb-0.5">Motivo descarte</p>
              <p className="text-sm text-muted-foreground italic">{signal.motivoDescarte}</p>
            </div>
          )}
        </div>

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
