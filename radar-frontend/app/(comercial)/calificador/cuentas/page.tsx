import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Star, TrendingUp, Archive, XCircle } from 'lucide-react';
import { pgQuery, SCHEMA } from '@/lib/db/supabase/pg_client';
import type { Tier } from '@/lib/comercial/calificador/types';
import { TIER_LABEL } from '@/lib/comercial/calificador/scoring';

const S = SCHEMA;

interface CalRow {
  id:              number;
  empresa_nombre:  string;
  pais:            string;
  linea_negocio:   string | null;
  tier_calculado:  Tier;
  score_total:     number;
  modelo_llm:      string | null;
  created_at:      string;
}

async function getCalificaciones(limit = 100): Promise<CalRow[]> {
  try {
    return await pgQuery<CalRow>(`
      SELECT
        c.id,
        COALESCE(e.company_name, c.linea_negocio, 'Empresa desconocida') AS empresa_nombre,
        COALESCE(e.pais, '')                                              AS pais,
        c.linea_negocio,
        c.tier_calculado,
        c.score_total,
        c.modelo_llm,
        c.created_at
      FROM ${S}.calificaciones c
      LEFT JOIN ${S}.empresas e ON e.id = c.empresa_id
      WHERE c.is_v2 = TRUE
      ORDER BY c.created_at DESC
      LIMIT ${limit}
    `);
  } catch {
    return [];
  }
}

const TIER_ICON: Record<Tier, typeof Star> = {
  'A':      Star,
  'B-Alta': TrendingUp,
  'B-Baja': TrendingUp,
  'C':      Archive,
  'D':      XCircle,
};

const TIER_CLS: Record<Tier, string> = {
  'A':      'text-amber-500',
  'B-Alta': 'text-blue-600',
  'B-Baja': 'text-blue-400',
  'C':      'text-slate-500',
  'D':      'text-muted-foreground',
};

const TIER_BADGE: Record<Tier, string> = {
  'A':      'bg-amber-500/15 text-amber-700 border-amber-500/30',
  'B-Alta': 'bg-blue-500/20  text-blue-800  border-blue-500/40',
  'B-Baja': 'bg-blue-500/10  text-blue-600  border-blue-500/25',
  'C':      'bg-slate-500/15 text-slate-700 border-slate-500/30',
  'D':      'bg-muted        text-muted-foreground',
};

export const dynamic = 'force-dynamic';

export default async function CalificacionesListPage() {
  const rows = await getCalificaciones();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Historial de calificaciones</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {rows.length} calificación{rows.length !== 1 ? 'es' : ''} con IA (v2)
        </p>
      </div>

      {rows.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-12 text-center">
            <Star size={40} className="mb-4 text-muted-foreground/30" />
            <h2 className="mb-1 text-lg font-semibold">Sin historial</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Las calificaciones aparecerán aquí tras ejecutar el agente.
            </p>
            <Link
              href="/calificador/wizard"
              className="text-sm font-medium text-primary hover:underline"
            >
              Iniciar calificación →
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                <th className="px-4 py-3 text-left font-medium">Empresa</th>
                <th className="px-4 py-3 text-left font-medium">Línea</th>
                <th className="px-4 py-3 text-left font-medium">Score</th>
                <th className="px-4 py-3 text-left font-medium">Tier</th>
                <th className="px-4 py-3 text-left font-medium">Modelo</th>
                <th className="px-4 py-3 text-left font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const Icon  = TIER_ICON[row.tier_calculado];
                const tier  = row.tier_calculado;
                return (
                  <tr
                    key={row.id}
                    className="border-b border-border/40 last:border-0 hover:bg-muted/20"
                  >
                    <td className="px-4 py-3">
                      <Link href={`/calificador/cuentas/${row.id}`} className="hover:underline">
                        <span className="font-medium">{row.empresa_nombre}</span>
                        {row.pais && (
                          <span className="ml-1 text-xs text-muted-foreground">{row.pais}</span>
                        )}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {row.linea_negocio ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('font-mono font-bold', TIER_CLS[tier])}>
                        {Number(row.score_total).toFixed(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={cn('border gap-1 h-5 text-[10px]', TIER_BADGE[tier])}>
                        <Icon size={10} className={TIER_CLS[tier]} />
                        {TIER_LABEL[tier]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                      {row.modelo_llm ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(row.created_at).toLocaleDateString('es-CO', {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
