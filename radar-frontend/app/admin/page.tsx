// app/admin/page.tsx — Admin dashboard (panel de control comercial)
import {
  Shield, Users, Layers, Globe, Activity, ShieldCheck, Building2,
  ChevronRight, Database, Star, TrendingUp, Radar, ArrowRight,
  Eye, Zap,
} from 'lucide-react';
import { getAdminDb } from '@/lib/db/supabase/admin';
import { pgQuery, SCHEMA } from '@/lib/db/supabase/pg_client';
import Link from 'next/link';

const S = SCHEMA;

// ─── Data fetching ────────────────────────────────────────────────────────────

interface AgentStats {
  runs_30d:     number;
  success_rate: number;   // 0..100
  last_run_at:  string | null;
}

const EMPTY_AGENT_STATS: AgentStats = { runs_30d: 0, success_rate: 0, last_run_at: null };

async function getStats() {
  try {
    const db = getAdminDb();
    const [
      usuarios, lineas, fuentes, empresas, actividad,
      senalesOroV2, calificacionesA, contactosSync,
      radarSessions, calificadorRuns, contactosRuns,
    ] = await Promise.all([
      db.from('usuarios').select('id', { count: 'exact', head: true }),
      db.from('lineas_negocio').select('id', { count: 'exact', head: true }).eq('activo', true),
      db.from('fuentes').select('id', { count: 'exact', head: true }).eq('activa', true),
      db.from('empresas').select('id', { count: 'exact', head: true }),
      db.from('actividad').select('id, tipo, usuario_email, created_at').order('created_at', { ascending: false }).limit(7),
      // Ajuste A — señales ORO desde radar_v2_results (la tabla del agente nuevo).
      // Sólo cuentan las que pasaron el validador (evaluacion_temporal contiene 'Válido', es decir 🟢).
      pgQuery<{ count: string }>(
        `SELECT COUNT(*)::text AS count
           FROM ${S}.radar_v2_results
          WHERE radar_activo = 'Sí'
            AND evaluacion_temporal LIKE '%Válido%'
            AND created_at > NOW() - INTERVAL '30 days'`
      ).catch(() => []),
      pgQuery<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM ${S}.calificaciones WHERE tier_calculado = 'A' AND is_v2 = TRUE`
      ).catch(() => []),
      pgQuery<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM ${S}.contactos WHERE hubspot_status = 'sincronizado'`
      ).catch(() => []),
      // Ajuste B — Radar V2: runs / éxito / última corrida desde radar_v2_sessions.
      // "Éxito" = sesión que registró duration_ms (terminó sin abortar).
      pgQuery<{ runs: string; completed: string; last_run: string | null }>(
        `SELECT
            COUNT(*)::text                                            AS runs,
            COUNT(*) FILTER (WHERE duration_ms IS NOT NULL)::text     AS completed,
            MAX(created_at)                                           AS last_run
           FROM ${S}.radar_v2_sessions
          WHERE created_at > NOW() - INTERVAL '30 days'`
      ).catch(() => []),
      // Ajuste B — Calificador: runs en 30d, éxito = tier_calculado no nulo.
      pgQuery<{ runs: string; completed: string; last_run: string | null }>(
        `SELECT
            COUNT(*)::text                                            AS runs,
            COUNT(*) FILTER (WHERE tier_calculado IS NOT NULL)::text  AS completed,
            MAX(created_at)                                           AS last_run
           FROM ${S}.calificaciones
          WHERE created_at > NOW() - INTERVAL '30 days'`
      ).catch(() => []),
      // Ajuste B — Contactos: runs = filas creadas en 30d, éxito = hubspot_status='sincronizado'.
      pgQuery<{ runs: string; completed: string; last_run: string | null }>(
        `SELECT
            COUNT(*)::text                                                  AS runs,
            COUNT(*) FILTER (WHERE hubspot_status = 'sincronizado')::text   AS completed,
            MAX(created_at)                                                 AS last_run
           FROM ${S}.contactos
          WHERE created_at > NOW() - INTERVAL '30 days'`
      ).catch(() => []),
    ]);

    const buildAgentStats = (
      rows: Array<{ runs: string; completed: string; last_run: string | null }>
    ): AgentStats => {
      const r = rows[0];
      if (!r) return EMPTY_AGENT_STATS;
      const runs = Number(r.runs ?? 0);
      const completed = Number(r.completed ?? 0);
      return {
        runs_30d:     runs,
        success_rate: runs > 0 ? Math.round((completed / runs) * 100) : 0,
        last_run_at:  r.last_run,
      };
    };

    return {
      usuarios:      usuarios.count   ?? 0,
      lineas:        lineas.count     ?? 0,
      fuentes:       fuentes.count    ?? 0,
      empresas:      empresas.count   ?? 0,
      reciente:      actividad.data   ?? [],
      senalesOro:    Number(senalesOroV2[0]?.count   ?? 0),
      tierA:         Number(calificacionesA[0]?.count ?? 0),
      contactosSync: Number(contactosSync[0]?.count  ?? 0),
      agentStats: {
        radar:       buildAgentStats(radarSessions),
        calificador: buildAgentStats(calificadorRuns),
        contactos:   buildAgentStats(contactosRuns),
      } as Record<'radar' | 'calificador' | 'contactos', AgentStats>,
    };
  } catch {
    return {
      usuarios: 0, lineas: 0, fuentes: 0, empresas: 0,
      reciente: [], senalesOro: 0, tierA: 0, contactosSync: 0,
      agentStats: {
        radar:       EMPTY_AGENT_STATS,
        calificador: EMPTY_AGENT_STATS,
        contactos:   EMPTY_AGENT_STATS,
      },
    };
  }
}

/** Formatea ISO date como "Hace 12 min" / "Hace 3 h" / "Hace 5 d". */
function relativeTimeEs(iso: string | null): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const diffMs = Date.now() - then;
  if (diffMs < 0) return 'Recién';
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1)  return 'Recién';
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24)   return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30)    return `Hace ${days} d`;
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
}

async function getRecentOroSignals() {
  try {
    const rows = await pgQuery<{
      id: number; empresa: string; linea_negocio: string;
      titulo_senal: string; fuente: string; created_at: string;
      score_radar: number;
    }>(
      `SELECT id, empresa, linea_negocio, titulo_senal, fuente, created_at, score_radar
         FROM ${S}.senales_radar
        WHERE tier_senal = 'ORO'
        ORDER BY created_at DESC
        LIMIT 4`
    );
    return rows;
  } catch {
    return [];
  }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

const ADMIN_SECTIONS = [
  { href: '/admin/usuarios',      label: 'Usuarios',          Icon: Users,       desc: 'Gestión de acceso y roles del equipo' },
  { href: '/admin/roles',         label: 'Roles y Permisos',  Icon: ShieldCheck, desc: 'Matriz de acceso y capacidades por rol' },
  { href: '/admin/empresas',      label: 'Empresas',          Icon: Building2,   desc: 'Base de datos comercial por línea de negocio' },
  { href: '/admin/lineas',        label: 'Líneas de negocio', Icon: Layers,      desc: 'Configurar líneas activas y metadatos' },
  { href: '/admin/fuentes',       label: 'Fuentes',           Icon: Globe,       desc: 'Fuentes de búsqueda para los agentes' },
  { href: '/admin/configuracion', label: 'Configuración',     Icon: Shield,      desc: 'Parámetros globales del sistema' },
  { href: '/admin/actividad',     label: 'Actividad',         Icon: Activity,    desc: 'Log de auditoría y eventos del sistema' },
];

const AGENT_CONFIG = [
  {
    key:        'radar' as const,
    name:       'Radar B2B',
    short:      'WF02',
    desc:       'Detecta señales de inversión LATAM',
    Icon:       Radar,
    color:      'var(--agent-radar)',
    tint:       'var(--agent-radar-tint)',
    href:       '/escanear',
    label:      'Disparar Radar',
    headlineKey: 'senalesOro' as const,
    headlineLabel: 'señales ORO (30d)',
  },
  {
    key:        'calificador' as const,
    name:       'Calificador',
    short:      'WF01',
    desc:       'Asigna tier en 7 dimensiones',
    Icon:       Star,
    color:      'var(--agent-calificador)',
    tint:       'var(--agent-calificador-tint)',
    href:       '/calificador',
    label:      'Disparar Calificador',
    headlineKey: 'tierA' as const,
    headlineLabel: 'cuentas tier A vigentes',
  },
  {
    key:        'contactos' as const,
    name:       'Búsqueda Contactos',
    short:      'WF03',
    desc:       'Apollo · decisores por empresa',
    Icon:       Users,
    color:      'var(--agent-contactos)',
    tint:       'var(--agent-contactos-tint)',
    href:       '/en-vivo',
    label:      'Buscar contactos',
    headlineKey: 'contactosSync' as const,
    headlineLabel: 'contactos sincronizados',
  },
] as const;

function TipoBadge({ tipo }: { tipo: string }) {
  const map: Record<string, string> = {
    login:          'bg-emerald-500/10 text-emerald-700 border-emerald-200',
    logout:         'bg-gray-100 text-gray-500 border-gray-200',
    disparo_agente: 'bg-blue-50 text-blue-700 border-blue-200',
    error:          'bg-red-50 text-red-700 border-red-200',
    warn:           'bg-amber-50 text-amber-700 border-amber-200',
    config_change:  'bg-violet-50 text-violet-700 border-violet-200',
  };
  const cls = map[tipo] ?? 'bg-surface-muted text-muted-foreground border-border';
  return (
    <span className={`agent-chip border ${cls}`}>{tipo}</span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const { getCurrentSession } = await import('@/lib/auth/session');
  const session = await getCurrentSession();
  const isAdmin = session?.role === 'ADMIN';

  const [stats, oroSignals] = await Promise.all([getStats(), getRecentOroSignals()]);

  return (
    <div className="space-y-8 max-w-[1400px] mx-auto pb-16 animate-fade-in-up">

      {/* ── Header ── */}
      <div className="flex items-end justify-between gap-6">
        <div>
          <p className="text-[10px] font-bold tracking-[0.28em] text-muted-foreground uppercase mb-1.5">
            PANEL DE CONTROL · LATAM
          </p>
          <h1 className="text-3xl font-bold tracking-tight">
            Panel
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Visión global de los 3 agentes IA y el estado de la inteligencia comercial.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link href="/escanear">
            <button className="inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-surface px-3.5 py-2 text-sm font-medium text-foreground hover:bg-surface-muted transition-colors">
              <Zap size={14} />
              Nuevo escaneo
            </button>
          </Link>
        </div>
      </div>

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Empresas en BD',          value: stats.empresas.toLocaleString('es-CO'), delta: '+42 sem',  Icon: Database,   color: 'var(--primary)',           tint: 'rgba(20,46,71,0.08)'       },
          { label: 'Señales ORO (30d)',        value: String(stats.senalesOro),               delta: 'mes',      Icon: Star,       color: 'var(--agent-calificador)', tint: 'rgba(185,132,42,0.12)'     },
          { label: 'Cuentas tier A',           value: String(stats.tierA),                    delta: 'vigentes', Icon: TrendingUp, color: 'var(--agent-radar)',       tint: 'rgba(113,172,210,0.18)'    },
          { label: 'Contactos sincronizados',  value: String(stats.contactosSync),            delta: 'HubSpot',  Icon: Users,      color: 'var(--agent-contactos)',   tint: 'rgba(25,129,106,0.14)'     },
        ].map((kpi) => (
          <div key={kpi.label} className="panel rounded-[14px] px-4 py-4">
            <div className="flex items-start justify-between">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-[10px]"
                style={{ background: kpi.tint, color: kpi.color }}
              >
                <kpi.Icon size={18} />
              </div>
              <span className="font-mono text-[11px] font-semibold text-success">{kpi.delta}</span>
            </div>
            <p
              className="mt-3.5 font-display text-[28px] font-bold leading-none tracking-tight tabular-nums"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {kpi.value}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* ── Agent Cards ── */}
      <div>
        <p className="mb-2.5 text-[10px] font-bold tracking-[0.28em] text-muted-foreground uppercase">
          AGENTES
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {AGENT_CONFIG.map((agent) => {
            const headlineValue = stats[agent.headlineKey];
            const aStats = stats.agentStats[agent.key];
            const isActive = aStats.runs_30d > 0;
            return (
              <div
                key={agent.key}
                className="panel relative overflow-hidden rounded-[14px] p-5"
              >
                {/* accent top bar */}
                <div
                  className="absolute inset-x-0 top-0 h-[3px]"
                  style={{ background: agent.color }}
                />

                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-[42px] w-[42px] items-center justify-center rounded-[12px]"
                      style={{ background: agent.tint, color: agent.color }}
                    >
                      <agent.Icon size={20} />
                    </div>
                    <div>
                      <p className="text-[14.5px] font-semibold leading-tight">{agent.name}</p>
                      <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                        <span style={{ color: agent.color }} className="font-semibold">{agent.short}</span>
                        {' · '}{agent.desc}
                      </p>
                    </div>
                  </div>
                  <span
                    className="agent-chip"
                    style={{
                      background: isActive ? agent.tint : 'rgba(0,0,0,0.04)',
                      color: isActive ? agent.color : 'var(--muted-foreground)',
                      borderColor: isActive
                        ? `color-mix(in srgb, ${agent.color} 30%, transparent)`
                        : 'var(--border)',
                    }}
                  >
                    {isActive && (
                      <span
                        className="pulse-dot inline-block h-1.5 w-1.5 rounded-full"
                        style={{ background: agent.color }}
                      />
                    )}
                    {isActive ? 'Activo' : 'Inactivo'}
                  </span>
                </div>

                {/* Headline metric */}
                <div
                  className="mb-3 rounded-[10px] px-3 py-2.5"
                  style={{ background: agent.tint }}
                >
                  <p
                    className="font-mono text-[22px] font-bold leading-none tabular-nums"
                    style={{ color: agent.color }}
                  >
                    {headlineValue}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{agent.headlineLabel}</p>
                </div>

                {/* 3-column metric grid — RUNS · ÉXITO · ÚLTIMA */}
                <div className="mb-4 grid grid-cols-3 gap-2">
                  <div className="rounded-[10px] border border-border bg-surface px-2.5 py-2">
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/80">Runs (30d)</p>
                    <p className="mt-1 font-mono text-[15px] font-bold leading-none tabular-nums">{aStats.runs_30d}</p>
                  </div>
                  <div className="rounded-[10px] border border-border bg-surface px-2.5 py-2">
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/80">Tasa de éxito</p>
                    <p className="mt-1 font-mono text-[15px] font-bold leading-none tabular-nums">
                      {aStats.runs_30d > 0 ? `${aStats.success_rate}%` : '—'}
                    </p>
                  </div>
                  <div className="rounded-[10px] border border-border bg-surface px-2.5 py-2">
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/80">Última corrida</p>
                    <p className="mt-1 font-mono text-[12px] font-semibold leading-tight">
                      {relativeTimeEs(aStats.last_run_at)}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Link href={agent.href} className="flex-1">
                    <button
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-[9px] py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
                      style={{ background: agent.color }}
                    >
                      {agent.label} <ArrowRight size={13} />
                    </button>
                  </Link>
                  <Link href="/admin/actividad">
                    <button className="inline-flex items-center gap-1.5 rounded-[9px] border border-border bg-surface px-3 py-2 text-[13px] font-medium text-foreground hover:bg-surface-muted transition-colors">
                      <Eye size={13} /> Historial
                    </button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Activity feed + ORO signals ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

        {/* Activity feed */}
        <div className="panel rounded-[14px] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-semibold">Actividad reciente</h3>
            <Link href="/admin/actividad" className="text-xs text-secondary font-medium hover:underline">
              Ver todo →
            </Link>
          </div>

          {stats.reciente.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Sin actividad registrada</p>
          ) : (
            <div className="space-y-2.5">
              {stats.reciente.map((a: { id: number; tipo: string; usuario_email: string | null; created_at: string }) => (
                <div key={a.id} className="flex items-center justify-between">
                  <TipoBadge tipo={a.tipo} />
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{a.usuario_email ?? '—'}</span>
                    <span className="font-mono tabular-nums">
                      {new Date(a.created_at).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ORO signals */}
        <div className="panel rounded-[14px] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-semibold">Señales ORO recientes</h3>
            <Link href="/resultados" className="inline-flex items-center gap-1 text-xs text-secondary font-medium hover:underline">
              Ver todas <ArrowRight size={12} />
            </Link>
          </div>

          {oroSignals.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Sin señales ORO recientes</p>
          ) : (
            <div className="space-y-2">
              {oroSignals.map((s) => (
                <div
                  key={s.id}
                  className="rounded-[10px] border px-3 py-2.5"
                  style={{ background: 'rgba(254,249,231,0.45)', borderColor: 'rgba(245,228,168,0.55)' }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="tier-oro agent-chip">ORO</span>
                    <span className="text-[12px] font-semibold">{s.empresa}</span>
                    {s.score_radar > 0 && (
                      <span className="ml-auto font-mono text-[11px] text-muted-foreground">
                        {s.score_radar}%
                      </span>
                    )}
                  </div>
                  <p className="text-[12.5px] leading-snug line-clamp-1">{s.titulo_senal}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {s.fuente} · {new Date(s.created_at).toLocaleDateString('es-CO')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Section grid (admin links) — solo visible para ADMIN ── */}
      {isAdmin && (
      <div>
        <p className="mb-2.5 text-[10px] font-bold tracking-[0.28em] text-muted-foreground uppercase">
          ADMINISTRACIÓN
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ADMIN_SECTIONS.map(({ href, label, Icon, desc }) => (
            <Link
              key={href}
              href={href}
              className="group panel rounded-[14px] p-4 transition-all hover:border-secondary/40 hover:shadow-sm"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-surface-muted group-hover:bg-secondary/10 transition-colors">
                  <Icon size={15} className="text-muted-foreground group-hover:text-secondary transition-colors" />
                </div>
                <ChevronRight size={13} className="text-muted-foreground/0 group-hover:text-secondary/70 transition-all -translate-x-1 group-hover:translate-x-0 duration-200" />
              </div>
              <p className="text-[13px] font-semibold">{label}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">{desc}</p>
            </Link>
          ))}
        </div>
      </div>
      )}

    </div>
  );
}
