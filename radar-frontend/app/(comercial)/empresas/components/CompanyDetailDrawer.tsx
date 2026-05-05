'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  X,
  Activity,
  Radio,
  Star,
  Users,
  History,
  ExternalLink,
  Loader2,
  BarChart2,
  Zap,
} from 'lucide-react';
import type { EmpresaItem } from '../page';

// ── Agent colours ──────────────────────────────────────────────────────────────
const AGENT_COLORS = {
  radar:       '#71acd2',
  calificador: '#b9842a',
  contactos:   '#19816a',
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '—';
  const diffMs  = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60)  return `Hace ${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24)   return `Hace ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  return `Hace ${diffD}d`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]!.toUpperCase())
    .join('');
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TabBtn({
  id,
  label,
  icon: Icon,
  color,
  active,
  onClick,
}: {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-selected={active}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        padding: '6px 12px',
        fontSize: 12,
        fontWeight: active ? 600 : 400,
        color: active ? color : 'var(--muted-foreground)',
        borderTop: 'none',
        borderLeft: 'none',
        borderRight: 'none',
        borderBottom: active ? `2px solid ${color}` : '2px solid transparent',
        background: 'none',
        cursor: 'pointer',
        transition: 'color 0.15s',
        whiteSpace: 'nowrap',
      }}
    >
      <Icon size={12} />
      {label}
    </button>
  );
}

function DotCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div style={{
      flex: 1,
      borderRadius: 8,
      border: '1px solid var(--border)',
      padding: '8px 10px',
      background: 'var(--muted)',
    }}>
      <p style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted-foreground)', marginBottom: 2 }}>
        {label}
      </p>
      <p style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono-ui, monospace)', color: 'var(--foreground)', lineHeight: 1 }}>
        {value}
      </p>
      {sub && (
        <p style={{ fontSize: 10, color: 'var(--muted-foreground)', marginTop: 2 }}>{sub}</p>
      )}
    </div>
  );
}

function EmptyBox({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '32px 16px', gap: 8, borderRadius: 8,
      border: '1px dashed var(--border)', background: 'var(--muted)',
    }}>
      <Icon size={20} style={{ color: 'var(--muted-foreground)', opacity: 0.4 }} />
      <p style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{text}</p>
    </div>
  );
}

// ── API data shapes ───────────────────────────────────────────────────────────

interface Signal {
  id: number;
  tipoSenal: string;
  scoreRadar: number;
  ventanaCompra: string;
  descripcion: string;
  fuente: string;
  fuenteUrl: string;
  fechaEscaneo: string;
}

interface Calificacion {
  id: number;
  score_total: number;
  tier_calculado: string;
  created_at: string;
  impacto_presupuesto: string | null;
  anio_objetivo: string | null;
  recurrencia: string | null;
  multiplanta: string | null;
  ticket_estimado: string | null;
  referente_mercado: string | null;
  prioridad_comercial: string | null;
}

interface Contacto {
  id: string | number;
  nombre: string;
  cargo?: string | null;
  email?: string | null;
  linkedinUrl?: string | null;
}

// ── Tab contents ──────────────────────────────────────────────────────────────

function TabResumen({
  empresa,
  senales,
  contactos,
  loadingSignals,
  loadingContactos,
}: {
  empresa: EmpresaItem;
  senales: Signal[];
  contactos: Contacto[];
  loadingSignals: boolean;
  loadingContactos: boolean;
}) {
  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 3 agent mini-cards */}
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1, borderRadius: 8, border: `1px solid ${AGENT_COLORS.radar}30`, background: `${AGENT_COLORS.radar}08`, padding: '10px 12px' }}>
          <p style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: AGENT_COLORS.radar, marginBottom: 4 }}>Radar</p>
          <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--foreground)', fontFamily: 'monospace' }}>
            {loadingSignals ? '…' : senales.length}
          </p>
          <p style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>señales</p>
        </div>
        <div style={{ flex: 1, borderRadius: 8, border: `1px solid ${AGENT_COLORS.calificador}30`, background: `${AGENT_COLORS.calificador}08`, padding: '10px 12px' }}>
          <p style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: AGENT_COLORS.calificador, marginBottom: 4 }}>Calificador</p>
          <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--foreground)', fontFamily: 'monospace' }}>
            {empresa.score ?? '—'}
          </p>
          <p style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>score / 10</p>
        </div>
        <div style={{ flex: 1, borderRadius: 8, border: `1px solid ${AGENT_COLORS.contactos}30`, background: `${AGENT_COLORS.contactos}08`, padding: '10px 12px' }}>
          <p style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: AGENT_COLORS.contactos, marginBottom: 4 }}>Contactos</p>
          <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--foreground)', fontFamily: 'monospace' }}>
            {loadingContactos ? '…' : contactos.length}
          </p>
          <p style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>encontrados</p>
        </div>
      </div>

      {/* Most recent signal */}
      <div>
        <p style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted-foreground)', marginBottom: 8 }}>
          Ultima senal
        </p>
        {loadingSignals ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted-foreground)', fontSize: 12 }}>
            <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Cargando...
          </div>
        ) : senales.length > 0 ? (
          <div style={{ borderRadius: 8, border: '1px solid var(--border)', background: 'var(--muted)', padding: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)' }}>{senales[0]!.tipoSenal || 'Sin tipo'}</p>
            </div>
            {senales[0]!.descripcion && (
              <p style={{ fontSize: 11, color: 'var(--muted-foreground)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {senales[0]!.descripcion}
              </p>
            )}
            <p style={{ fontSize: 10, color: 'var(--muted-foreground)', marginTop: 4 }}>
              {senales[0]!.fechaEscaneo ? timeAgo(senales[0]!.fechaEscaneo) : '—'}
            </p>
          </div>
        ) : (
          <EmptyBox icon={Zap} text="Sin senales registradas" />
        )}
      </div>

      {/* Contact summary */}
      <div>
        <p style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted-foreground)', marginBottom: 8 }}>
          Contactos
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <DotCard label="Total"      value={loadingContactos ? '…' : contactos.length} />
          <DotCard label="Existentes" value={loadingContactos ? '…' : contactos.length} />
          <DotCard label="Nuevos"     value="0" />
        </div>
      </div>
    </div>
  );
}

function TabRadar({ empresa, senales, loading }: { empresa: EmpresaItem; senales: Signal[]; loading: boolean }) {
  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <DotCard label="Senales"   value={loading ? '…' : senales.length} />
        <DotCard label="ORO"       value={loading ? '…' : senales.filter(s => s.scoreRadar >= 80).length} />
        <DotCard label="Monitoreo" value={loading ? '…' : senales.filter(s => s.scoreRadar >= 40 && s.scoreRadar < 80).length} />
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted-foreground)', fontSize: 12, padding: '16px 0' }}>
          <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Cargando senales...
        </div>
      ) : senales.length === 0 ? (
        <EmptyBox icon={Zap} text="Sin senales para esta empresa" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {senales.map((s, i) => (
            <div
              key={s.id ?? i}
              style={{
                display: 'flex', gap: 12, padding: '12px 0',
                borderBottom: i < senales.length - 1 ? '1px solid var(--border)' : 'none',
              }}
            >
              <div style={{ width: 3, borderRadius: 2, background: s.scoreRadar >= 80 ? '#f59e0b' : s.scoreRadar >= 40 ? '#71acd2' : 'var(--border)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'monospace', color: 'var(--foreground)' }}>{s.scoreRadar}</span>
                  <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{s.tipoSenal || 'Sin tipo'}</span>
                </div>
                {s.descripcion && (
                  <p style={{ fontSize: 11, color: 'var(--muted-foreground)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {s.descripcion}
                  </p>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: 10, color: 'var(--muted-foreground)' }}>
                  <span>{timeAgo(s.fechaEscaneo)}</span>
                  {s.ventanaCompra && <span>{s.ventanaCompra}</span>}
                  {s.fuenteUrl && (
                    <a href={s.fuenteUrl} target="_blank" rel="noopener noreferrer" style={{ color: AGENT_COLORS.radar, display: 'flex', alignItems: 'center', gap: 2 }}>
                      <ExternalLink size={9} />
                      {s.fuente || 'Fuente'}
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TabCalificador({ empresa, calificaciones, loading }: { empresa: EmpresaItem; calificaciones: Calificacion[]; loading: boolean }) {
  const latest = calificaciones[0] ?? null;
  const score  = latest?.score_total ?? empresa.score ?? null;
  const scoreNum = typeof score === 'number' ? score : null;

  const DIMENSIONS = [
    ['Impacto presupuesto', latest?.impacto_presupuesto],
    ['Año objetivo',        latest?.anio_objetivo],
    ['Recurrencia',         latest?.recurrencia],
    ['Multiplanta',         latest?.multiplanta],
    ['Ticket estimado',     latest?.ticket_estimado],
    ['Referente mercado',   latest?.referente_mercado],
    ['Prioridad comercial', latest?.prioridad_comercial],
  ] as [string, string | null | undefined][];

  const tierChip = empresa.tier
    ? { ORO: { bg: '#fef3c7', color: '#92400e' }, MONITOREO: { bg: '#dbeafe', color: '#1e40af' }, ARCHIVO: { bg: '#f3f4f6', color: '#6b7280' } }[empresa.tier]
    : null;

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Score circle + tier */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div
          style={{
            width: 90, height: 90, borderRadius: '50%', flexShrink: 0,
            background: scoreNum !== null
              ? `conic-gradient(${AGENT_COLORS.calificador} ${scoreNum * 36}deg, var(--border) 0deg)`
              : 'var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div style={{ width: 70, height: 70, borderRadius: '50%', background: 'var(--card)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--foreground)', fontFamily: 'monospace', lineHeight: 1 }}>
              {scoreNum ?? '—'}
            </p>
            <p style={{ fontSize: 9, color: 'var(--muted-foreground)' }}>/ 10</p>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {tierChip && (
            <span style={{ display: 'inline-flex', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: tierChip.bg, color: tierChip.color }}>
              {empresa.tier}
            </span>
          )}
          {latest?.created_at && (
            <p style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
              Calificado {formatDate(latest.created_at)}
            </p>
          )}
        </div>
      </div>

      {/* Dimension bars */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted-foreground)', fontSize: 12 }}>
          <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Cargando...
        </div>
      ) : latest === null ? (
        <EmptyBox icon={BarChart2} text="Sin datos de dimension para esta empresa" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {DIMENSIONS.map(([label, value]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <p style={{ fontSize: 11, color: 'var(--muted-foreground)', width: 140, flexShrink: 0 }}>{label}</p>
              <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
                <div style={{ width: value ? '75%' : '5%', height: '100%', borderRadius: 2, background: value ? AGENT_COLORS.calificador : 'var(--border)' }} />
              </div>
              <p style={{ fontSize: 11, color: 'var(--foreground)', width: 90, textAlign: 'right', flexShrink: 0 }}>{value ?? '—'}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TabContactos({ empresa, contactos, loading }: { empresa: EmpresaItem; contactos: Contacto[]; loading: boolean }) {
  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Incorporation banner */}
      <div style={{ borderRadius: 8, background: `${AGENT_COLORS.contactos}12`, border: `1px solid ${AGENT_COLORS.contactos}30`, padding: '10px 14px' }}>
        <p style={{ fontSize: 11, color: AGENT_COLORS.contactos, fontWeight: 600 }}>
          Prospectados por Apollo.io · Agente 03
        </p>
        <p style={{ fontSize: 10, color: 'var(--muted-foreground)', marginTop: 2 }}>
          Contactos clave en la empresa para la linea de negocio asignada
        </p>
      </div>

      {/* DotCards */}
      <div style={{ display: 'flex', gap: 8 }}>
        <DotCard label="Total"      value={loading ? '…' : contactos.length} />
        <DotCard label="Existentes" value={loading ? '…' : contactos.length} />
        <DotCard label="Nuevos"     value="0" />
      </div>

      {/* Contact list */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted-foreground)', fontSize: 12 }}>
          <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Cargando contactos...
        </div>
      ) : contactos.length === 0 ? (
        <EmptyBox icon={Users} text="Sin contactos prospectos para esta empresa" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {contactos.map((c, i) => (
            <div
              key={c.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0',
                borderBottom: i < contactos.length - 1 ? '1px solid var(--border)' : 'none',
              }}
            >
              <div style={{ width: 32, height: 32, borderRadius: 8, background: `${AGENT_COLORS.contactos}20`, color: AGENT_COLORS.contactos, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                {initials(c.nombre)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)' }}>{c.nombre}</p>
                {c.cargo && <p style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{c.cargo}</p>}
                {c.email && <p style={{ fontSize: 10, color: AGENT_COLORS.radar, fontFamily: 'monospace' }}>{c.email}</p>}
              </div>
              {c.linkedinUrl && (
                <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--muted-foreground)', flexShrink: 0 }}>
                  <ExternalLink size={13} />
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const MOCK_TIMELINE = [
  { type: 'calificador', color: AGENT_COLORS.calificador, icon: Star,     title: 'Calificado por Agente 01', sub: 'Score asignado basado en 7 dimensiones', at: new Date(Date.now() - 86400_000 * 2).toISOString() },
  { type: 'radar',       color: AGENT_COLORS.radar,       icon: Radio,     title: 'Señal detectada por Radar', sub: 'Expansion CAPEX detectada en fuentes oficiales', at: new Date(Date.now() - 86400_000 * 5).toISOString() },
  { type: 'contactos',   color: AGENT_COLORS.contactos,   icon: Users,     title: 'Prospectado por Agente 03', sub: '3 contactos Apollo clave encontrados', at: new Date(Date.now() - 86400_000 * 7).toISOString() },
  { type: 'radar',       color: AGENT_COLORS.radar,       icon: Activity,  title: 'Re-escaneo Radar', sub: 'Segunda busqueda sin nuevas señales', at: new Date(Date.now() - 86400_000 * 12).toISOString() },
];

function TabHistorial() {
  return (
    <div style={{ padding: '16px' }}>
      <div style={{ position: 'relative', paddingLeft: 24 }}>
        {/* Vertical line */}
        <div style={{ position: 'absolute', left: 7, top: 8, bottom: 8, width: 2, background: 'var(--border)' }} />

        {MOCK_TIMELINE.map((ev, i) => {
          const Icon = ev.icon;
          return (
            <div key={i} style={{ display: 'flex', gap: 12, paddingBottom: 20, position: 'relative' }}>
              {/* Dot */}
              <div style={{
                position: 'absolute', left: -24, top: 2,
                width: 16, height: 16, borderRadius: '50%',
                background: `${ev.color}20`, border: `2px solid ${ev.color}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Icon size={8} style={{ color: ev.color }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)' }}>{ev.title}</p>
                <p style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{ev.sub}</p>
                <p style={{ fontSize: 10, color: 'var(--muted-foreground)', marginTop: 2 }}>{timeAgo(ev.at)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main drawer ───────────────────────────────────────────────────────────────

export interface CompanyDetailDrawerProps {
  empresa: EmpresaItem | null;
  onClose: () => void;
}

const LINEA_COLORS: Record<string, string> = {
  BHS:           '#0ea5e9',
  'Cartón':      '#10b981',
  Intralogística:'#f59e0b',
};

type DrawerTab = 'resumen' | 'radar' | 'calificador' | 'contactos' | 'historial';

const TABS: { id: DrawerTab; label: string; icon: React.ElementType; color: string }[] = [
  { id: 'resumen',      label: 'Resumen',    icon: Activity,  color: 'var(--primary)' },
  { id: 'radar',        label: 'Radar',      icon: Radio,     color: AGENT_COLORS.radar },
  { id: 'calificador',  label: 'Calificador',icon: Star,      color: AGENT_COLORS.calificador },
  { id: 'contactos',    label: 'Contactos',  icon: Users,     color: AGENT_COLORS.contactos },
  { id: 'historial',    label: 'Historial',  icon: History,   color: 'var(--muted-foreground)' },
];

export function CompanyDetailDrawer({ empresa, onClose }: CompanyDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<DrawerTab>('resumen');

  useEffect(() => {
    if (empresa) setActiveTab('resumen');
  }, [empresa?.id]);

  // Lock body scroll while open
  useEffect(() => {
    if (!empresa) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [empresa]);

  const enabled = !!empresa;

  const { data: senales = [], isLoading: loadingSignals } = useQuery<Signal[]>({
    queryKey: ['signals', 'empresa', empresa?.id],
    queryFn: () =>
      fetch(`/api/signals?empresa_id=${empresa!.id}&limit=100`)
        .then(r => r.json())
        .then((d: unknown) => Array.isArray(d) ? d as Signal[] : []),
    enabled: enabled && (activeTab === 'radar' || activeTab === 'resumen'),
    staleTime: 60_000,
  });

  const { data: contactos = [], isLoading: loadingContactos } = useQuery<Contacto[]>({
    queryKey: ['contactos', 'empresa', empresa?.id],
    queryFn: () =>
      fetch(`/api/contacts?empresa_id=${empresa!.id}&limit=100`)
        .then(r => r.json())
        .then((d: unknown) => Array.isArray(d) ? d as Contacto[] : []),
    enabled: enabled && (activeTab === 'contactos' || activeTab === 'resumen'),
    staleTime: 60_000,
  });

  const { data: calificaciones = [], isLoading: loadingCal } = useQuery<Calificacion[]>({
    queryKey: ['calificaciones', 'empresa', empresa?.id],
    queryFn: () =>
      fetch(`/api/calificaciones?empresa_id=${empresa!.id}&limit=10`)
        .then(r => r.json())
        .then((d: unknown) => Array.isArray(d) ? d as Calificacion[] : []),
    enabled: enabled && activeTab === 'calificador',
    staleTime: 60_000,
  });

  if (!empresa) return null;

  const lineaColor = LINEA_COLORS[empresa.linea ?? ''] ?? '#0ea5e9';
  const empresaInitials = initials(empresa.name);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(20,46,71,0.42)',
          backdropFilter: 'blur(2px)',
          zIndex: 60,
        }}
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-label={`Detalle de ${empresa.name}`}
        aria-modal
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: 720,
          zIndex: 61,
          background: 'var(--card)',
          boxShadow: '-12px 0 48px rgba(20,46,71,0.18)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Top colour accent */}
        <div style={{ height: 3, background: lineaColor, flexShrink: 0 }} />

        {/* Header */}
        <div style={{
          padding: '16px 20px 12px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
          background: `linear-gradient(135deg, ${lineaColor}06 0%, transparent 60%)`,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            {/* Avatar */}
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: `${lineaColor}20`, color: lineaColor,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, flexShrink: 0,
            }}>
              {empresaInitials}
            </div>

            {/* Name + meta */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--foreground)', lineHeight: 1.2 }}>
                {empresa.name}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                {empresa.country && (
                  <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{empresa.country}</span>
                )}
                {empresa.linea && (
                  <span style={{ fontSize: 10, padding: '1px 8px', borderRadius: 12, background: `${lineaColor}15`, color: lineaColor, fontWeight: 600 }}>
                    {empresa.linea}
                  </span>
                )}
                {empresa.tier && (
                  <span style={{
                    fontSize: 10, padding: '1px 8px', borderRadius: 12, fontWeight: 600,
                    background: empresa.tier === 'ORO' ? '#fef3c7' : empresa.tier === 'MONITOREO' ? '#dbeafe' : '#f3f4f6',
                    color:      empresa.tier === 'ORO' ? '#92400e' : empresa.tier === 'MONITOREO' ? '#1e40af' : '#6b7280',
                  }}>
                    {empresa.tier}
                  </span>
                )}
                {empresa.domain && (
                  <span style={{ fontSize: 10, color: 'var(--muted-foreground)', fontFamily: 'monospace' }}>{empresa.domain}</span>
                )}
              </div>
            </div>

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar panel"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', padding: 4, flexShrink: 0 }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Tab strip */}
          <div style={{ display: 'flex', gap: 0, marginTop: 12, borderBottom: '1px solid var(--border)', marginBottom: -12, marginLeft: -20, marginRight: -20, paddingLeft: 20, overflowX: 'auto' }}>
            {TABS.map(t => (
              <TabBtn
                key={t.id}
                id={t.id}
                label={t.label}
                icon={t.icon}
                color={t.color}
                active={activeTab === t.id}
                onClick={() => setActiveTab(t.id)}
              />
            ))}
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {activeTab === 'resumen' && (
            <TabResumen empresa={empresa} senales={senales} contactos={contactos} loadingSignals={loadingSignals} loadingContactos={loadingContactos} />
          )}
          {activeTab === 'radar' && (
            <TabRadar empresa={empresa} senales={senales} loading={loadingSignals} />
          )}
          {activeTab === 'calificador' && (
            <TabCalificador empresa={empresa} calificaciones={calificaciones} loading={loadingCal} />
          )}
          {activeTab === 'contactos' && (
            <TabContactos empresa={empresa} contactos={contactos} loading={loadingContactos} />
          )}
          {activeTab === 'historial' && <TabHistorial />}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          gap: 8,
          flexShrink: 0,
          background: 'var(--card)',
        }}>
          <a
            href="https://app.hubspot.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600,
              border: '1px solid var(--border)', color: 'var(--muted-foreground)',
              background: 'none', cursor: 'pointer', textDecoration: 'none',
            }}
          >
            <ExternalLink size={11} />
            Ver en HubSpot
          </a>
          <button
            type="button"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600,
              border: `1px solid ${AGENT_COLORS.radar}40`, color: AGENT_COLORS.radar,
              background: `${AGENT_COLORS.radar}08`, cursor: 'pointer',
            }}
            onClick={() => alert('Re-escanear — conectar a /api/radar')}
          >
            <Radio size={11} />
            Re-escanear
          </button>
          <button
            type="button"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600,
              border: 'none',
              background: 'var(--primary)', color: 'var(--primary-foreground)',
              cursor: 'pointer',
              marginLeft: 'auto',
            }}
            onClick={() => alert('Correr 3 Agentes — conectar a pipeline completo')}
          >
            <Zap size={11} />
            Correr 3 Agentes
          </button>
        </div>
      </div>
    </>
  );
}
