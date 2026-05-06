import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Star, TrendingUp, Archive, XCircle, ChevronLeft, Radar } from 'lucide-react';
import { pgQuery, pgLit, SCHEMA } from '@/lib/db/supabase/pg_client';
import { TIER_LABEL } from '@/lib/comercial/calificador/scoring';
import { DimensionStrip } from '../../components/DimensionStrip';
import type { Tier, DimScores } from '@/lib/comercial/calificador/types';

const S = SCHEMA;

interface CalDetailRow {
  id:                  number;
  empresa_nombre:      string;
  pais:                string;
  linea_negocio:       string | null;
  tier_calculado:      Tier;
  score_total:         number;
  score_impacto:            number;
  score_multiplanta:        number;
  score_recurrencia:        number;
  score_referente:          number;
  score_anio:               number;
  score_ticket:             number;
  score_prioridad:          number;
  score_cuenta_estrategica: number | null;
  score_tier:               number | null;
  dimensiones:              unknown;
  razonamiento_agente: string | null;
  perfil_web_summary:  string | null;
  modelo_llm:          string | null;
  tokens_input:        number | null;
  tokens_output:       number | null;
  costo_usd:           number | null;
  created_at:          string;
}

async function getCalificacion(id: number): Promise<CalDetailRow | null> {
  try {
    const rows = await pgQuery<CalDetailRow>(`
      SELECT
        c.id,
        COALESCE(e.company_name, c.linea_negocio, 'Empresa desconocida') AS empresa_nombre,
        COALESCE(e.pais, '')                                              AS pais,
        c.linea_negocio,
        c.tier_calculado,
        c.score_total,
        c.score_impacto,
        c.score_multiplanta,
        c.score_recurrencia,
        c.score_referente,
        c.score_anio,
        c.score_ticket,
        c.score_prioridad,
        c.score_cuenta_estrategica,
        c.score_tier,
        c.dimensiones,
        c.razonamiento_agente,
        c.perfil_web_summary,
        c.modelo_llm,
        c.tokens_input,
        c.tokens_output,
        c.costo_usd,
        c.created_at
      FROM ${S}.calificaciones c
      LEFT JOIN ${S}.empresas e ON e.id = c.empresa_id
      WHERE c.id = ${id} AND c.is_v2 = TRUE
      LIMIT 1
    `);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

const TIER_ICON: Record<Tier, typeof Star> = {
  A: Star, B: TrendingUp, C: Archive, D: XCircle,
};

const TIER_CLS: Record<Tier, string> = {
  A: 'text-amber-500',
  B: 'text-blue-500',
  C: 'text-slate-500',
  D: 'text-muted-foreground',
};

const TIER_BADGE: Record<Tier, string> = {
  A: 'bg-amber-500/15 text-amber-700 border-amber-500/30',
  B: 'bg-blue-500/15  text-blue-700  border-blue-500/30',
  C: 'bg-slate-500/15 text-slate-700 border-slate-500/30',
  D: 'bg-muted        text-muted-foreground',
};

interface Props {
  params: Promise<{ id: string }>;
}

export const dynamic = 'force-dynamic';

export default async function CalificacionDetailPage({ params }: Props) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!id || Number.isNaN(id)) notFound();

  const row = await getCalificacion(id);
  if (!row) notFound();

  const tier  = row.tier_calculado;
  const Icon  = TIER_ICON[tier];
  const label = TIER_LABEL[tier];

  const scores: DimScores = {
    impacto_presupuesto: row.score_impacto,
    multiplanta:         row.score_multiplanta,
    recurrencia:         row.score_recurrencia,
    referente_mercado:   row.score_referente,
    anio_objetivo:       row.score_anio,
    ticket_estimado:     row.score_ticket,
    prioridad_comercial: row.score_prioridad,
    cuenta_estrategica:  row.score_cuenta_estrategica ?? 0,
    tier:                row.score_tier ?? 0,
  };

  // Build dimensiones map for UI from persisted jsonb if available.
  type DimEntry = { dim: string; valor?: string; justificacion?: string };
  const dimList: DimEntry[] = Array.isArray(row.dimensiones)
    ? (row.dimensiones as DimEntry[])
    : [];
  const dimensionesMap = dimList.reduce<Record<string, { valor: string; justificacion?: string }>>(
    (acc, d) => {
      if (d.dim && d.valor) acc[d.dim] = { valor: d.valor, justificacion: d.justificacion };
      return acc;
    },
    {},
  );

  return (
    <div className="space-y-6">
      {/* Back nav */}
      <Link href="/calificador/cuentas" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft size={14} /> Historial
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{row.empresa_nombre}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {row.pais}{row.linea_negocio ? ` · ${row.linea_negocio}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className={cn('text-3xl font-bold font-mono tabular-nums', TIER_CLS[tier])}>
            {Number(row.score_total).toFixed(1)}
          </span>
          <Badge variant="outline" className={cn('border h-7 px-2 text-xs', TIER_BADGE[tier])}>
            <Icon size={12} className={cn('mr-1', TIER_CLS[tier])} />
            {label}
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Dimension scores */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Dimensiones (7)</CardTitle>
          </CardHeader>
          <CardContent>
            <DimensionStrip scores={scores} dimensiones={dimensionesMap} animate={false} />
          </CardContent>
        </Card>

        {/* Metadata */}
        <div className="space-y-4">
          {/* Razonamiento */}
          {row.razonamiento_agente && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Razonamiento IA</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {row.razonamiento_agente}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Perfil web */}
          {row.perfil_web_summary && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Perfil web</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {row.perfil_web_summary}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Usage stats */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Uso de tokens</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Modelo</dt>
                  <dd className="font-mono">{row.modelo_llm ?? '—'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Tokens entrada</dt>
                  <dd className="font-mono tabular-nums">{row.tokens_input?.toLocaleString() ?? '—'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Tokens salida</dt>
                  <dd className="font-mono tabular-nums">{row.tokens_output?.toLocaleString() ?? '—'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Costo USD</dt>
                  <dd className="font-mono tabular-nums">
                    {row.costo_usd != null ? `$${Number(row.costo_usd).toFixed(5)}` : '—'}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Fecha</dt>
                  <dd>{new Date(row.created_at).toLocaleString('es-CO')}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Trigger Radar action */}
      <div className="flex gap-3">
        <Link href={`/en-vivo?sessionId=${encodeURIComponent(crypto.randomUUID())}&line=${encodeURIComponent(row.linea_negocio ?? '')}&empresas=${encodeURIComponent(JSON.stringify([{ name: row.empresa_nombre, country: row.pais }]))}`}>
          <Button variant="outline" size="sm" className="gap-2">
            <Radar size={14} /> Activar Radar de Inversión
          </Button>
        </Link>
      </div>
    </div>
  );
}
