'use client';

import { useQuery } from '@tanstack/react-query';
import { Loader2, Star, Radio, Users, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

// ── Types ─────────────────────────────────────────────────────────────────

interface CalificacionRow {
  id: number;
  score_total: number;
  tier_calculado: string;
  razonamiento_agente: string | null;
  modelo_llm: string | null;
  prompt_version: string | null;
  created_at: string;
}

interface RadarScanRow {
  id: number;
  score_radar: number;
  composite_score: number | null;
  tier_compuesto: string | null;
  tipo_senal: string | null;
  descripcion_senal: string | null;
  ventana_compra: string;
  radar_activo: boolean;
  razonamiento_agente: string | null;
  created_at: string;
}

interface ProspeccionRow {
  id: number;
  estado: string;
  contactos_encontrados: number;
  job_titles_usados: string[] | null;
  max_contacts: number | null;
  created_at: string;
}

type EventItem =
  | { type: 'calificacion'; data: CalificacionRow }
  | { type: 'radar';        data: RadarScanRow }
  | { type: 'prospeccion';  data: ProspeccionRow };

// ── Helpers ────────────────────────────────────────────────────────────────

function tierColor(tier: string): string {
  if (tier === 'A') return 'bg-yellow-400 text-yellow-900';
  if (tier === 'B') return 'bg-blue-400 text-blue-900';
  if (tier === 'C') return 'bg-gray-400 text-gray-900';
  return 'bg-muted text-muted-foreground';
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

// ── Component ──────────────────────────────────────────────────────────────

export default function EmpresaTimelinePage({
  params,
}: {
  params: { id: string };
}) {
  const empresaId = Number(params.id);

  const { data: calificaciones = [], isLoading: lcal } = useQuery<CalificacionRow[]>({
    queryKey: ['calificaciones', empresaId],
    queryFn: () =>
      fetch(`/api/calificaciones?empresa_id=${empresaId}&limit=20`).then((r) => r.json()),
  });

  const { data: radarScans = [], isLoading: lrad } = useQuery<RadarScanRow[]>({
    queryKey: ['radar-scans', empresaId],
    queryFn: () =>
      fetch(`/api/radar-scans?empresa_id=${empresaId}&limit=20`).then((r) => r.json()),
  });

  const { data: prospecciones = [], isLoading: lpros } = useQuery<ProspeccionRow[]>({
    queryKey: ['prospecciones', empresaId],
    queryFn: () =>
      fetch(`/api/prospecciones?empresa_id=${empresaId}&limit=20`).then((r) => r.json()),
  });

  const isLoading = lcal || lrad || lpros;

  // Merge & sort chronologically (newest first)
  const events: EventItem[] = [
    ...calificaciones.map((d) => ({ type: 'calificacion' as const, data: d })),
    ...radarScans.map((d)     => ({ type: 'radar' as const,        data: d })),
    ...prospecciones.map((d)  => ({ type: 'prospeccion' as const,  data: d })),
  ].sort((a, b) => new Date(b.data.created_at).getTime() - new Date(a.data.created_at).getTime());

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/empresas/${empresaId}`}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="h-4 w-4" /> Volver a empresa
        </Link>
      </div>

      <h1 className="text-2xl font-bold mb-1">Historial de actividad</h1>
      <p className="text-muted-foreground text-sm mb-6">
        Calificaciones, radar scans y prospecciones registradas en Supabase.
      </p>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-8">
          <Loader2 className="h-5 w-5 animate-spin" /> Cargando historial...
        </div>
      ) : events.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground border rounded-lg">
          No hay historial registrado para esta empresa.
        </div>
      ) : (
        <div className="relative pl-6 border-l border-border space-y-6">
          {events.map((ev, i) => (
            <div key={`${ev.type}-${ev.data.id}-${i}`} className="relative">
              {/* Timeline dot */}
              <span className="absolute -left-9 mt-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background bg-card shadow-sm">
                {ev.type === 'calificacion' && <Star className="h-3 w-3 text-yellow-500" />}
                {ev.type === 'radar'        && <Radio className="h-3 w-3 text-blue-500" />}
                {ev.type === 'prospeccion'  && <Users className="h-3 w-3 text-green-500" />}
              </span>

              {/* Card */}
              <div className="border rounded-lg p-4 bg-card space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {ev.type === 'calificacion' && 'WF01 Calificación'}
                      {ev.type === 'radar'        && 'WF02 Radar'}
                      {ev.type === 'prospeccion'  && 'WF03 Prospección'}
                    </Badge>

                    {ev.type === 'calificacion' && (
                      <span className={`text-xs px-2 py-0.5 rounded font-bold ${tierColor(ev.data.tier_calculado)}`}>
                        Tier {ev.data.tier_calculado} — {ev.data.score_total.toFixed(1)}/10
                      </span>
                    )}
                    {ev.type === 'radar' && ev.data.tier_compuesto && (
                      <span className={`text-xs px-2 py-0.5 rounded font-bold ${tierColor(ev.data.tier_compuesto)}`}>
                        Composite {ev.data.composite_score?.toFixed(0) ?? '?'} — Tier {ev.data.tier_compuesto}
                      </span>
                    )}
                    {ev.type === 'prospeccion' && (
                      <Badge variant={ev.data.estado === 'encontrado' ? 'default' : 'secondary'} className="text-xs">
                        {ev.data.estado} — {ev.data.contactos_encontrados} contactos
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{fmtDate(ev.data.created_at)}</span>
                </div>

                {ev.type === 'calificacion' && ev.data.razonamiento_agente && (
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {ev.data.razonamiento_agente}
                  </p>
                )}
                {ev.type === 'radar' && (
                  <div className="space-y-1">
                    {ev.data.tipo_senal && (
                      <p className="text-sm font-medium">{ev.data.tipo_senal}</p>
                    )}
                    {ev.data.descripcion_senal && (
                      <p className="text-sm text-muted-foreground line-clamp-3">
                        {ev.data.descripcion_senal}
                      </p>
                    )}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Score radar: <strong>{ev.data.score_radar}</strong></span>
                      <span>·</span>
                      <span>Ventana: {ev.data.ventana_compra}</span>
                      {ev.data.radar_activo && (
                        <>
                          <span>·</span>
                          <span className="text-green-600 font-medium">Radar activo</span>
                        </>
                      )}
                    </div>
                  </div>
                )}
                {ev.type === 'prospeccion' && ev.data.job_titles_usados && (
                  <p className="text-xs text-muted-foreground">
                    Job titles: {ev.data.job_titles_usados.slice(0, 5).join(', ')}
                    {ev.data.job_titles_usados.length > 5 && ` +${ev.data.job_titles_usados.length - 5}`}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
