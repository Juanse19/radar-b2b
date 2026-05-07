/**
 * /contactos/historial — Sesiones de prospección (lista de ejecuciones del wizard).
 *
 * La tabla de TODOS los contactos vive ahora en /contactos.
 * Esta página queda enfocada en sesiones (auditoría de búsquedas).
 */
import Link from 'next/link';
import { History, Search, AlertCircle, Sparkles, Loader2, ArrowLeft } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { pgQuery, SCHEMA } from '@/lib/db/supabase/pg_client';

export const dynamic = 'force-dynamic';

interface SessionRow {
  id:                string;
  modo:              'auto' | 'manual';
  sublineas:         string[];
  tiers:             string[] | null;
  empresas_count:    number;
  total_contacts:    number;
  total_with_email:  number;
  total_with_phone:  number;
  credits_used:      number;
  duration_ms:       number | null;
  cancelled:         boolean;
  created_at:        string;
  finished_at:       string | null;
}

async function getSessions(limit = 100): Promise<SessionRow[]> {
  try {
    return await pgQuery<SessionRow>(`
      SELECT id, modo, sublineas, tiers,
             empresas_count, total_contacts, total_with_email, total_with_phone,
             credits_used, duration_ms, cancelled,
             created_at, finished_at
      FROM ${SCHEMA}.prospector_v2_sessions
      ORDER BY created_at DESC
      LIMIT ${limit}
    `);
  } catch (err) {
    console.error('[contactos/historial] getSessions failed:', err);
    return [];
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function formatDuration(ms: number | null): string {
  if (!ms) return '—';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

export default async function HistorialPage() {
  const sessions = await getSessions(100);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{ background: 'var(--agent-contactos-tint)', color: 'var(--agent-contactos)' }}
          >
            <History size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--agent-contactos)' }}>
              Agente 03 — Prospector v2 · Sesiones
            </p>
            <h1 className="text-xl font-semibold leading-tight text-foreground">
              Historial de sesiones
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {sessions.length} sesion{sessions.length !== 1 ? 'es' : ''} · click en cualquier ID para ver el detalle.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link href="/contactos">
            <Button variant="outline" size="sm">
              <ArrowLeft size={13} className="mr-1.5" />
              Ver contactos
            </Button>
          </Link>
          <Link href="/contactos/buscar">
            <Button size="sm" style={{ background: 'var(--agent-contactos)', color: '#fff' }}>
              <Sparkles size={13} className="mr-1.5" />
              Nueva búsqueda
            </Button>
          </Link>
        </div>
      </div>

      {sessions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <History size={40} className="mb-4 text-muted-foreground/30" />
            <h2 className="mb-1 text-lg font-semibold">Sin sesiones todavía</h2>
            <p className="mb-6 max-w-sm text-sm text-muted-foreground">
              Inicia una sesión de prospección desde el wizard. Cada ejecución
              quedará registrada aquí con sus stats y créditos consumidos.
            </p>
            <Link href="/contactos/buscar">
              <Button>Empezar prospección</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-xl border border-border/70 bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3 text-left font-semibold">Fecha</th>
                  <th className="px-5 py-3 text-left font-semibold">Sesión</th>
                  <th className="px-5 py-3 text-left font-semibold">Modo</th>
                  <th className="px-5 py-3 text-left font-semibold">Sub-líneas / Tiers</th>
                  <th className="px-5 py-3 text-right font-semibold">Empresas</th>
                  <th className="px-5 py-3 text-right font-semibold">Contactos</th>
                  <th className="px-5 py-3 text-right font-semibold">Créditos</th>
                  <th className="px-5 py-3 text-right font-semibold">Duración</th>
                  <th className="px-5 py-3 text-left font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(s => <SessionRow key={s.id} session={s} />)}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function SessionRow({ session }: { session: SessionRow }) {
  const subs  = session.sublineas?.length ? session.sublineas.join(', ') : '—';
  const tiers = session.tiers?.length ? session.tiers.join('·') : null;
  const isFinished = !!session.finished_at;

  return (
    <tr className="border-b border-border/40 last:border-b-0 hover:bg-muted/20 transition-colors">
      <td className="px-5 py-4 align-middle text-xs text-muted-foreground">{formatDate(session.created_at)}</td>
      <td className="px-5 py-4 align-middle">
        <Link
          href={`/contactos/historial/${session.id}`}
          className="text-xs font-mono hover:underline"
          style={{ color: 'var(--agent-contactos)' }}
        >
          {session.id.slice(0, 8).toUpperCase()}
        </Link>
      </td>
      <td className="px-5 py-4 align-middle">
        <span
          className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider"
          style={
            session.modo === 'auto'
              ? { background: '#FEF3C7', color: '#92400E' }
              : { background: '#DBEAFE', color: '#1E40AF' }
          }
        >
          {session.modo}
        </span>
      </td>
      <td className="px-5 py-4 align-middle">
        <p className="text-xs truncate max-w-[280px]" title={subs}>{subs}</p>
        {tiers && <p className="text-[10px] text-muted-foreground">tier {tiers}</p>}
      </td>
      <td className="px-5 py-4 align-middle text-right tabular-nums">{session.empresas_count}</td>
      <td className="px-5 py-4 align-middle text-right">
        <span className="font-semibold tabular-nums">{session.total_contacts}</span>
        {session.total_with_phone > 0 && (
          <span className="ml-1 text-[10px] text-muted-foreground">({session.total_with_phone} c/tel)</span>
        )}
      </td>
      <td className="px-5 py-4 align-middle text-right tabular-nums text-xs text-muted-foreground">{session.credits_used}</td>
      <td className="px-5 py-4 align-middle text-right tabular-nums text-xs text-muted-foreground">{formatDuration(session.duration_ms)}</td>
      <td className="px-5 py-4 align-middle">
        {!isFinished ? (
          <span className="inline-flex items-center gap-1 text-xs text-amber-700">
            <Loader2 size={11} className="animate-spin" /> En curso
          </span>
        ) : session.cancelled ? (
          <span className="inline-flex items-center gap-1 text-xs text-amber-700">
            <AlertCircle size={11} /> Cancelada
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
            <Search size={11} /> Completa
          </span>
        )}
      </td>
    </tr>
  );
}
