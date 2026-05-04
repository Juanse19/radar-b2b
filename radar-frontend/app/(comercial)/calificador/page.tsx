import Link from 'next/link';
import { Star, ClipboardCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { pgQuery, SCHEMA } from '@/lib/db/supabase/pg_client';
import { CalificadorTabs } from './components/CalificadorTabs';

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
    cls:   'tier-oro',
    sub:   'Alta prioridad comercial',
    color: 'var(--gold)',
    href:  '/calificador/cuentas?tier=A',
  },
  {
    key:   'B',
    label: 'MONITOREO',
    cls:   'tier-monitoreo',
    sub:   'Seguimiento activo',
    color: '#1f5d8d',
    href:  '/calificador/cuentas?tier=B',
  },
  {
    key:   'C',
    label: 'ARCHIVO',
    cls:   'tier-archivo',
    sub:   'Potencial a largo plazo',
    color: '#5c6f81',
    href:  '/calificador/cuentas?tier=C',
  },
  {
    key:   'D',
    label: 'DESCARTAR',
    cls:   'tier-descartar',
    sub:   'Sin potencial actual',
    color: '#7d1837',
    href:  '/calificador/cuentas?tier=D',
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
        <div className="flex items-start gap-3">
          <div
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{ background: 'var(--agent-calificador-tint)', color: 'var(--agent-calificador)' }}
          >
            <ClipboardCheck size={18} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--agent-calificador)' }}>
              Agente 01 — Calificador
            </p>
            <h1 className="text-xl font-semibold leading-tight text-foreground">Calificar empresas</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Evalúa el potencial comercial por empresa, línea o conversación con IA.
            </p>
          </div>
        </div>
        <Link href="/calificador/wizard/seleccionar">
          <Button size="sm" style={{ background: 'var(--agent-calificador)', color: '#fff' }}>
            Nueva calificación
          </Button>
        </Link>
      </div>

      {/* Tabs principales (Empresa / Automático / Chat) */}
      <CalificadorTabs />

      {/* Tier stat cards */}
      <div>
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Distribución por tier
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {TIER_CONFIG.map(({ key, label, cls, sub, color, href }) => {
            const count = stats[key] ?? 0;
            const pct   = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <Link key={key} href={href}>
                <div className="panel group cursor-pointer p-4 transition-shadow hover:shadow-md">
                  <div className="mb-3 flex items-center justify-between">
                    <span className={`agent-chip ${cls}`}>{label}</span>
                    {total > 0 && (
                      <span className="font-mono text-[11px]" style={{ color: 'var(--muted-fg)' }}>
                        {pct}%
                      </span>
                    )}
                  </div>
                  <p className="font-mono text-3xl font-bold tabular-nums leading-none" style={{ color }}>
                    {count}
                  </p>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">{sub}</p>
                </div>
              </Link>
            );
          })}
        </div>
        {total > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            {total} empresa{total !== 1 ? 's' : ''} calificada{total !== 1 ? 's' : ''} en total
          </p>
        )}
      </div>

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
            <Button variant="outline" size="sm">Ver historial de calificaciones</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
