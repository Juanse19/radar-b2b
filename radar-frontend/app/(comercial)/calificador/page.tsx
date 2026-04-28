import Link from 'next/link';
import { Star, TrendingUp, Archive, XCircle, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { pgQuery, SCHEMA } from '@/lib/db/supabase/pg_client';

const S = SCHEMA;

interface TierStat {
  tier_calculado: string;
  count: string;
}

async function getTierStats(): Promise<Record<string, number>> {
  try {
    const rows = await pgQuery<TierStat>(
      `SELECT tier_calculado, COUNT(*)::text AS count
         FROM ${S}.calificaciones
        WHERE is_v2 = TRUE
        GROUP BY tier_calculado`,
    );
    return Object.fromEntries(rows.map((r) => [r.tier_calculado, Number(r.count)]));
  } catch {
    return {};
  }
}

const TIER_CONFIG = [
  {
    key:   'A',
    label: 'ORO',
    sub:   'Alta prioridad comercial',
    icon:  Star,
    color: 'text-amber-500',
    bg:    'bg-amber-500/10 border-amber-500/20',
  },
  {
    key:   'B',
    label: 'MONITOREO',
    sub:   'Seguimiento activo',
    icon:  TrendingUp,
    color: 'text-blue-500',
    bg:    'bg-blue-500/10 border-blue-500/20',
  },
  {
    key:   'C',
    label: 'ARCHIVO',
    sub:   'Potencial a largo plazo',
    icon:  Archive,
    color: 'text-slate-500',
    bg:    'bg-slate-500/10 border-slate-500/20',
  },
  {
    key:   'D',
    label: 'DESCARTAR',
    sub:   'Sin potencial actual',
    icon:  XCircle,
    color: 'text-muted-foreground',
    bg:    'bg-muted/40 border-border',
  },
];

export const dynamic = 'force-dynamic';

export default async function CalificadorDashboardPage() {
  const stats = await getTierStats();
  const total = Object.values(stats).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Calificador</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Evalúa empresas en 7 dimensiones y asigna tier comercial con IA
          </p>
        </div>
        <Link href="/calificador/wizard/seleccionar">
          <Button className="shrink-0 gap-2">
            Nueva calificación <ArrowRight size={14} />
          </Button>
        </Link>
      </div>

      {/* Tier stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {TIER_CONFIG.map(({ key, label, sub, icon: Icon, color, bg }) => {
          const count = stats[key] ?? 0;
          const pct   = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <Card key={key} className={`border ${bg}`}>
              <CardHeader className="pb-2 pt-4">
                <div className="flex items-center justify-between">
                  <Icon size={18} className={color} />
                  {total > 0 && (
                    <Badge variant="outline" className="h-5 text-[10px] font-mono">
                      {pct}%
                    </Badge>
                  )}
                </div>
                <CardTitle className={`text-2xl font-bold tabular-nums ${color}`}>
                  {count}
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4 pt-0">
                <p className="text-sm font-semibold">{label}</p>
                <p className="text-[11px] text-muted-foreground">{sub}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Total summary */}
      {total > 0 && (
        <p className="text-sm text-muted-foreground">
          {total} empresa{total !== 1 ? 's' : ''} calificada{total !== 1 ? 's' : ''} en total
        </p>
      )}

      {/* Empty state */}
      {total === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-12 text-center">
            <Star size={40} className="mb-4 text-muted-foreground/30" />
            <h2 className="mb-1 text-lg font-semibold">Sin calificaciones todavía</h2>
            <p className="mb-6 max-w-sm text-sm text-muted-foreground">
              Inicia una sesión de calificación para evaluar empresas de tu base de datos
              y descubrir cuáles tienen mayor potencial comercial.
            </p>
            <Link href="/calificador/wizard/seleccionar">
              <Button>Calificar empresas</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Quick links */}
      {total > 0 && (
        <div className="flex flex-wrap gap-3">
          <Link href="/calificador/cuentas">
            <Button variant="outline" size="sm">
              Ver historial de calificaciones
            </Button>
          </Link>
          <Link href="/calificador/wizard/seleccionar">
            <Button variant="outline" size="sm">
              Nueva calificación
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
