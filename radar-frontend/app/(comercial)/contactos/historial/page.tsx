/**
 * /contactos/historial — Vista global del Apollo Prospector v2.
 *
 * Dos secciones:
 *   1. Todos los contactos prospectados (tabla principal con filtros HubSpot)
 *   2. Historial de sesiones (lista colapsable de ejecuciones del wizard)
 */
import Link from 'next/link';
import { History, Search, Users, AlertCircle, Sparkles, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { pgQuery, SCHEMA } from '@/lib/db/supabase/pg_client';
import { AllContactsTable } from './components/AllContactsTable';

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

interface ContactoRow {
  id:                number;
  apollo_id:         string | null;
  first_name:        string | null;
  last_name:         string | null;
  title:             string | null;
  nivel_jerarquico:  string | null;
  email:             string | null;
  email_status:      string | null;
  phone_mobile:      string | null;
  phone_unlocked:    boolean;
  linkedin_url:      string | null;
  empresa_id:        number | null;
  empresa_nombre:    string | null;
  empresa_tier:      string | null;
  pais:              string | null;
  hubspot_status:    string;
  prospector_session_id: string | null;
  created_at:        string;
}

async function getSessions(limit = 50): Promise<SessionRow[]> {
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

async function getAllContactos(limit = 500): Promise<ContactoRow[]> {
  try {
    return await pgQuery<ContactoRow>(`
      SELECT c.id, c.apollo_id, c.first_name, c.last_name, c.title,
             c.nivel_jerarquico, c.email, c.email_status,
             c.phone_mobile, c.phone_unlocked, c.linkedin_url,
             c.empresa_id,
             e.company_name AS empresa_nombre,
             e.tier_actual::TEXT AS empresa_tier,
             c.country::TEXT AS pais,
             c.hubspot_status::TEXT AS hubspot_status,
             c.prospector_session_id::TEXT AS prospector_session_id,
             c.created_at
      FROM ${SCHEMA}.contactos c
      LEFT JOIN ${SCHEMA}.empresas e ON e.id = c.empresa_id
      WHERE c.email IS NOT NULL
      ORDER BY c.created_at DESC
      LIMIT ${limit}
    `);
  } catch (err) {
    console.error('[contactos/historial] getAllContactos failed:', err);
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
  const [sessions, contactos] = await Promise.all([
    getSessions(50),
    getAllContactos(500),
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
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
              Agente 03 — Prospector v2 · Historial
            </p>
            <h1 className="text-xl font-semibold leading-tight text-foreground">
              Contactos prospectados
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {contactos.length} contacto{contactos.length !== 1 ? 's' : ''} en {sessions.length} sesion{sessions.length !== 1 ? 'es' : ''} · ordenados de más reciente a más antigua.
            </p>
          </div>
        </div>
        <Link href="/contactos" className="shrink-0">
          <Button variant="outline" size="sm">
            <Sparkles size={13} className="mr-1.5" />
            Nueva búsqueda
          </Button>
        </Link>
      </div>

      {/* Sección 1: TODOS LOS CONTACTOS (lo principal) */}
      {contactos.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <Users size={40} className="mb-4 text-muted-foreground/30" />
            <h2 className="mb-1 text-lg font-semibold">Sin contactos todavía</h2>
            <p className="mb-6 max-w-sm text-sm text-muted-foreground">
              Inicia una sesión de prospección desde el wizard de Contactos.
              Los contactos prospectados aparecerán aquí con su email verificado,
              estado HubSpot y sesión de origen.
            </p>
            <Link href="/contactos">
              <Button>Empezar prospección</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <AllContactsTable initial={contactos} />
      )}

      {/* Sección 2: HISTORIAL DE SESIONES (colapsable) */}
      {sessions.length > 0 && (
        <details className="rounded-xl border border-border/70 bg-card overflow-hidden">
          <summary className="cursor-pointer list-none border-b border-border/60 px-4 py-3 hover:bg-muted/20 transition-colors">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold inline-flex items-center gap-2">
                Historial de sesiones
                <span className="text-xs font-normal text-muted-foreground">
                  ({sessions.length})
                </span>
              </h3>
              <span className="text-xs text-muted-foreground">click para mostrar/ocultar</span>
            </div>
          </summary>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-medium">Fecha</th>
                  <th className="px-4 py-2.5 text-left font-medium">Sesión</th>
                  <th className="px-4 py-2.5 text-left font-medium">Modo</th>
                  <th className="px-4 py-2.5 text-left font-medium">Sub-líneas / Tiers</th>
                  <th className="px-4 py-2.5 text-right font-medium">Empresas</th>
                  <th className="px-4 py-2.5 text-right font-medium">Contactos</th>
                  <th className="px-4 py-2.5 text-right font-medium">Créditos</th>
                  <th className="px-4 py-2.5 text-right font-medium">Duración</th>
                  <th className="px-4 py-2.5 text-left font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(s => <SessionRow key={s.id} session={s} />)}
              </tbody>
            </table>
          </div>
        </details>
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
      <td className="px-4 py-3 align-middle text-xs text-muted-foreground">
        {formatDate(session.created_at)}
      </td>
      <td className="px-4 py-3 align-middle">
        <Link
          href={`/contactos/historial/${session.id}`}
          className="text-xs font-mono hover:underline"
          style={{ color: 'var(--agent-contactos)' }}
        >
          {session.id.slice(0, 8).toUpperCase()}
        </Link>
      </td>
      <td className="px-4 py-3 align-middle">
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
      <td className="px-4 py-3 align-middle">
        <p className="text-xs truncate max-w-[260px]" title={subs}>{subs}</p>
        {tiers && <p className="text-[10px] text-muted-foreground">tier {tiers}</p>}
      </td>
      <td className="px-4 py-3 align-middle text-right tabular-nums">{session.empresas_count}</td>
      <td className="px-4 py-3 align-middle text-right">
        <span className="font-semibold tabular-nums">{session.total_contacts}</span>
        {session.total_with_phone > 0 && (
          <span className="ml-1 text-[10px] text-muted-foreground">
            ({session.total_with_phone} c/tel)
          </span>
        )}
      </td>
      <td className="px-4 py-3 align-middle text-right tabular-nums text-xs text-muted-foreground">
        {session.credits_used}
      </td>
      <td className="px-4 py-3 align-middle text-right tabular-nums text-xs text-muted-foreground">
        {formatDuration(session.duration_ms)}
      </td>
      <td className="px-4 py-3 align-middle">
        {!isFinished ? (
          <span className="inline-flex items-center gap-1 text-xs text-amber-700">
            <Loader2 size={11} className="animate-spin" />
            En curso
          </span>
        ) : session.cancelled ? (
          <span className="inline-flex items-center gap-1 text-xs text-amber-700">
            <AlertCircle size={11} />
            Cancelada
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
            <Search size={11} />
            Completa
          </span>
        )}
      </td>
    </tr>
  );
}
