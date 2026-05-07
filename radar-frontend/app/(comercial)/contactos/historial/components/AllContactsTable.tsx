'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Search,
  Linkedin,
  Phone,
  CheckCircle2,
  AlertCircle,
  Clock,
  Send,
  ExternalLink,
  Crown,
  X,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const ACCENT = 'var(--agent-contactos)';

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
  empresa_linea?:    string | null;     // codigo de matec_radar.lineas_negocio (bhs, carton_papel, intralogistica)
  empresa_sublinea?: string | null;     // codigo de matec_radar.sub_lineas_negocio (aeropuertos, etc.)
  pais:              string | null;
  hubspot_status:    string;
  prospector_session_id: string | null;
  created_at:        string;
}

type FilterMode = 'all' | 'sincronizado' | 'pendiente' | 'error';

interface TierStyle {
  bg:       string;
  fg:       string;
  border:   string;
  label:    string;
  ribbon?:  boolean;
}

const TIER_BADGE: Record<string, TierStyle> = {
  // Tier A → ribbon dorado prominente
  'A':             { bg: '#FBBF24', fg: '#451A03', border: '#F59E0B', label: 'A', ribbon: true },
  'B':             { bg: '#FCE7F3', fg: '#831843', border: '#FBCFE8', label: 'B' },
  'C':             { bg: '#EDE9FE', fg: '#4C1D95', border: '#DDD6FE', label: 'C' },
  'D':             { bg: '#E5E7EB', fg: '#374151', border: '#D1D5DB', label: 'D' },
  'sin_calificar': { bg: '#F3F4F6', fg: '#6B7280', border: '#E5E7EB', label: '—' },
};

// Mapping codigo → nombre legible (matec_radar.lineas_negocio)
const LINEA_LABELS: Record<string, string> = {
  bhs:            'BHS',
  carton_papel:   'Cartón y Papel',
  intralogistica: 'Intralogística',
};

const LINEA_COLORS: Record<string, string> = {
  bhs:            '#0EA5E9',  // sky
  carton_papel:   '#10B981',  // emerald
  intralogistica: '#F59E0B',  // amber
};

const HUBSPOT_STYLE: Record<string, { bg: string; fg: string; border: string; icon: typeof CheckCircle2; label: string }> = {
  sincronizado: { bg: '#D1FAE5', fg: '#047857', border: '#A7F3D0', icon: CheckCircle2, label: 'Sincronizado' },
  pendiente:    { bg: '#FEF3C7', fg: '#92400E', border: '#FDE68A', icon: Clock,         label: 'Pendiente' },
  error:        { bg: '#FEE2E2', fg: '#B91C1C', border: '#FECACA', icon: AlertCircle,   label: 'Error' },
  omitido:      { bg: '#F3F4F6', fg: '#6B7280', border: '#E5E7EB', icon: Clock,         label: 'Omitido' },
};

function avatarColors(name: string): { bg: string; fg: string } {
  const palette = [
    { bg: '#DBEAFE', fg: '#1E40AF' }, { bg: '#FEE2E2', fg: '#B91C1C' },
    { bg: '#D1FAE5', fg: '#065F46' }, { bg: '#FEF3C7', fg: '#92400E' },
    { bg: '#E9D5FF', fg: '#6B21A8' }, { bg: '#FCE7F3', fg: '#9D174D' },
    { bg: '#CFFAFE', fg: '#155E75' }, { bg: '#FED7AA', fg: '#9A3412' },
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

function maskPhone(tel: string | null, unlocked: boolean): string {
  if (!tel) return '—';
  if (unlocked) return tel;
  const cleaned = tel.replace(/[^\d+]/g, '');
  if (cleaned.length < 6) return '••••••••';
  return `${cleaned.slice(0, Math.min(7, cleaned.length - 4))} •••• ${cleaned.slice(-4)}`;
}

/** Extrae handle limpio de URL LinkedIn (`/in/john-doe-123`) */
function linkedinHandle(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/linkedin\.com\/(?:in|pub|company)\/([^/?#]+)/i);
  return m ? m[1] : url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

interface Props {
  initial: ContactoRow[];
}

export function AllContactsTable({ initial }: Props) {
  const [contactos]                 = useState<ContactoRow[]>(initial);
  const [filter,    setFilter]      = useState<FilterMode>('all');
  const [searchQ,   setSearchQ]     = useState('');
  const [tierFilter, setTierFilter] = useState<Set<string>>(new Set());
  const [lineaFilter, setLineaFilter] = useState<Set<string>>(new Set());

  const counts = useMemo(() => {
    const c = { all: contactos.length, sincronizado: 0, pendiente: 0, error: 0 };
    for (const x of contactos) {
      if      (x.hubspot_status === 'sincronizado') c.sincronizado++;
      else if (x.hubspot_status === 'error')        c.error++;
      else                                          c.pendiente++;
    }
    return c;
  }, [contactos]);

  const filtered = useMemo(() => {
    let xs = contactos;
    if (filter !== 'all') xs = xs.filter(c => (c.hubspot_status ?? 'pendiente') === filter);
    if (tierFilter.size > 0) {
      xs = xs.filter(c => tierFilter.has(c.empresa_tier ?? 'sin_calificar'));
    }
    if (lineaFilter.size > 0) {
      xs = xs.filter(c => c.empresa_linea && lineaFilter.has(c.empresa_linea));
    }
    const q = searchQ.trim().toLowerCase();
    if (q) {
      xs = xs.filter(c =>
        `${c.first_name ?? ''} ${c.last_name ?? ''}`.toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q) ||
        (c.empresa_nombre ?? '').toLowerCase().includes(q) ||
        (c.title ?? '').toLowerCase().includes(q),
      );
    }
    return xs;
  }, [contactos, filter, tierFilter, lineaFilter, searchQ]);

  function toggleTier(t: string) {
    setTierFilter(prev => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else             next.add(t);
      return next;
    });
  }

  function toggleLinea(l: string) {
    setLineaFilter(prev => {
      const next = new Set(prev);
      if (next.has(l)) next.delete(l);
      else             next.add(l);
      return next;
    });
  }

  const tierCounts = useMemo(() => {
    const c: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, sin_calificar: 0 };
    for (const x of contactos) {
      const t = x.empresa_tier ?? 'sin_calificar';
      c[t] = (c[t] ?? 0) + 1;
    }
    return c;
  }, [contactos]);

  const lineaCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const x of contactos) {
      const l = x.empresa_linea;
      if (!l) continue;
      c[l] = (c[l] ?? 0) + 1;
    }
    return c;
  }, [contactos]);

  const filters: Array<{ id: FilterMode; label: string; count: number }> = [
    { id: 'all',          label: 'Todos',         count: counts.all },
    { id: 'sincronizado', label: 'Sincronizados', count: counts.sincronizado },
    { id: 'pendiente',    label: 'Pendientes',    count: counts.pendiente },
    { id: 'error',        label: 'Errores',       count: counts.error },
  ];

  if (contactos.length === 0) {
    return (
      <div className="rounded-xl border border-border/70 bg-card p-12 text-center">
        <p className="text-sm text-muted-foreground mb-2">Sin contactos prospectados todavía.</p>
        <Link href="/contactos/buscar">
          <Button size="sm" style={{ background: ACCENT, color: '#fff' }}>
            Iniciar prospección
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/70 bg-card overflow-hidden">
      {/* ── Toolbar (3 zonas: título · búsqueda · acciones) ────────────────── */}
      <div className="border-b border-border/60">
        <div className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-end lg:justify-between">
          {/* Zona 1 — título + métricas */}
          <div className="min-w-0">
            <h3 className="text-base font-semibold leading-tight tracking-tight">
              Contactos prospectados
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {counts.all} contacto{counts.all !== 1 ? 's' : ''}
              {counts.sincronizado > 0 && <> · <span className="text-emerald-700 font-medium">{counts.sincronizado}</span> sincronizado{counts.sincronizado !== 1 ? 's' : ''}</>}
              {counts.pendiente    > 0 && <> · <span className="text-amber-700 font-medium">{counts.pendiente}</span> pendiente{counts.pendiente !== 1 ? 's' : ''}</>}
              {counts.error        > 0 && <> · <span className="text-red-700 font-medium">{counts.error}</span> con error</>}
            </p>
          </div>

          {/* Zona 2 — búsqueda + acción primaria */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:w-72">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                placeholder="Buscar nombre, email, empresa…"
                className="pl-9 h-9 text-sm"
              />
            </div>
            <Button
              type="button"
              size="sm"
              disabled={counts.all === 0}
              style={{ background: ACCENT, color: '#fff' }}
              className="h-9 shadow-sm"
            >
              <Send size={14} className="mr-1.5" /> Sync HubSpot
            </Button>
          </div>
        </div>

        {/* Zona 3 — filtros segmentados (HubSpot · Tier) en una fila ordenada */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-border/50 bg-muted/20 px-5 py-3">
          {/* HubSpot status filter */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Estado
            </span>
            <div className="inline-flex rounded-lg border border-border/60 bg-background p-0.5 shadow-xs">
              {filters.map(f => {
                const active = filter === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFilter(f.id)}
                    className={cn(
                      'px-3 py-1.5 text-xs rounded-md transition-colors',
                      active
                        ? 'bg-foreground text-background font-medium shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {f.label}
                    {f.count > 0 && (
                      <span className={cn('ml-1.5 text-[10px] tabular-nums', active ? 'opacity-80' : 'opacity-60')}>
                        {f.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tier filter */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Tier
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {(['A', 'B', 'C', 'D', 'sin_calificar'] as const).map(t => {
                const active = tierFilter.has(t);
                const badge  = TIER_BADGE[t];
                const count  = tierCounts[t] ?? 0;
                if (count === 0 && !active) return null;
                const isGold = t === 'A';
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleTier(t)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-all',
                      active ? 'font-semibold shadow-sm' : 'opacity-75 hover:opacity-100',
                    )}
                    style={{
                      background:  active ? badge.bg : 'transparent',
                      color:       active ? badge.fg : undefined,
                      borderColor: active ? badge.border : 'var(--border)',
                    }}
                  >
                    {isGold && active && <Crown size={11} />}
                    <span className="font-bold">{t === 'sin_calificar' ? 'Sin calificar' : `Tier ${badge.label}`}</span>
                    <span className="text-[10px] opacity-70 tabular-nums">{count}</span>
                  </button>
                );
              })}
              {tierFilter.size > 0 && (
                <button
                  type="button"
                  onClick={() => setTierFilter(new Set())}
                  className="inline-flex items-center gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  <X size={11} /> Limpiar
                </button>
              )}
            </div>
          </div>

          {/* Zona 4 — filtro por LÍNEA de negocio */}
          {Object.keys(lineaCounts).length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-t border-border/40 px-5 py-3 bg-muted/10">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Línea:
              </span>
              {Object.entries(LINEA_LABELS).map(([codigo, label]) => {
                const count = lineaCounts[codigo] ?? 0;
                const active = lineaFilter.has(codigo);
                if (count === 0 && !active) return null;
                const accent = LINEA_COLORS[codigo] ?? '#94a3b8';
                return (
                  <button
                    key={codigo}
                    type="button"
                    onClick={() => toggleLinea(codigo)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-all',
                      active ? 'font-semibold shadow-sm' : 'opacity-75 hover:opacity-100',
                    )}
                    style={{
                      background:  active ? `color-mix(in srgb, ${accent} 12%, transparent)` : 'transparent',
                      color:       active ? accent : undefined,
                      borderColor: active ? accent : 'var(--border)',
                    }}
                  >
                    <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
                    {label}
                    <span className="text-[10px] opacity-70">{count}</span>
                  </button>
                );
              })}
              {lineaFilter.size > 0 && (
                <button
                  type="button"
                  onClick={() => setLineaFilter(new Set())}
                  className="inline-flex items-center gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  <X size={11} /> Limpiar
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Tabla ──────────────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="p-10 text-center text-sm text-muted-foreground">
          Sin coincidencias para "{searchQ}".
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-3 text-left font-semibold">Contacto</th>
                <th className="px-5 py-3 text-left font-semibold">Empresa</th>
                <th className="px-5 py-3 text-left font-semibold">Línea</th>
                <th className="px-5 py-3 text-left font-semibold">Tier</th>
                <th className="px-5 py-3 text-left font-semibold">Email</th>
                <th className="px-5 py-3 text-left font-semibold">Teléfono</th>
                <th className="px-5 py-3 text-left font-semibold">LinkedIn</th>
                <th className="px-5 py-3 text-left font-semibold">HubSpot</th>
                <th className="px-5 py-3 text-left font-semibold">Sesión</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(ct => <Row key={ct.id} ct={ct} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Tier badge (con ribbon dorado para Tier A) ──────────────────────────────
function TierBadge({ tier }: { tier: string }) {
  const t = TIER_BADGE[tier] ?? TIER_BADGE.sin_calificar;
  if (t.ribbon) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-bold uppercase tracking-wide shadow-sm"
        style={{
          background: `linear-gradient(135deg, ${t.bg} 0%, #FCD34D 100%)`,
          color:      t.fg,
          borderColor: t.border,
        }}
        title="Tier A — máxima prioridad"
      >
        <Crown size={11} />
        Tier {t.label}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center justify-center rounded-md border px-2.5 py-1 text-[11px] font-semibold tabular-nums"
      style={{ background: t.bg, color: t.fg, borderColor: t.border }}
      title={tier === 'sin_calificar' ? 'Sin calificar' : `Tier ${t.label}`}
    >
      {t.label === '—' ? 'Sin calificar' : `Tier ${t.label}`}
    </span>
  );
}

function Row({ ct }: { ct: ContactoRow }) {
  const fullName = `${ct.first_name ?? ''} ${ct.last_name ?? ''}`.trim() || '—';
  const initials = ((ct.first_name?.charAt(0) ?? '') + (ct.last_name?.charAt(0) ?? '')).toUpperCase() || '??';
  const avatar   = avatarColors(fullName);
  const hsStyle  = HUBSPOT_STYLE[ct.hubspot_status] ?? HUBSPOT_STYLE.pendiente;
  const HsIcon   = hsStyle.icon;
  const handle   = linkedinHandle(ct.linkedin_url);
  const isGold   = (ct.empresa_tier ?? '') === 'A';

  return (
    <tr
      className={cn(
        'border-b border-border/40 last:border-b-0 transition-colors hover:bg-muted/30',
        isGold && 'bg-amber-50/30',
      )}
    >
      {/* Contacto — avatar + nombre + cargo */}
      <td className="px-5 py-4 align-middle">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold tracking-tight ring-2 ring-white"
            style={{
              background: avatar.bg,
              color:      avatar.fg,
              fontFeatureSettings: '"ss01"',
            }}
            aria-hidden
          >
            {initials}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{fullName}</p>
            <p className="truncate text-xs text-muted-foreground">{ct.title ?? '—'}</p>
          </div>
        </div>
      </td>

      {/* Empresa */}
      <td className="px-5 py-4 align-middle">
        <p className="truncate text-sm font-medium">{ct.empresa_nombre ?? '—'}</p>
        <p className="text-xs text-muted-foreground">{ct.pais ?? '—'}</p>
      </td>

      {/* Línea / Sub-línea */}
      <td className="px-5 py-4 align-middle">
        {ct.empresa_linea ? (
          <div className="flex flex-col">
            <span className="inline-flex items-center gap-1.5 text-sm font-medium">
              <span
                aria-hidden
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: LINEA_COLORS[ct.empresa_linea] ?? '#94a3b8' }}
              />
              {LINEA_LABELS[ct.empresa_linea] ?? ct.empresa_linea}
            </span>
            {ct.empresa_sublinea && (
              <span className="text-[11px] text-muted-foreground capitalize">
                {ct.empresa_sublinea.replace(/_/g, ' ')}
              </span>
            )}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>

      {/* Tier */}
      <td className="px-5 py-4 align-middle">
        <TierBadge tier={ct.empresa_tier ?? 'sin_calificar'} />
      </td>

      {/* Email */}
      <td className="px-5 py-4 align-middle">
        {ct.email ? (
          <a
            href={`mailto:${ct.email}`}
            className="text-sm hover:underline truncate max-w-[220px] inline-block"
            style={{ color: ACCENT }}
          >
            {ct.email}
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>

      {/* Teléfono */}
      <td className="px-5 py-4 align-middle whitespace-nowrap">
        <span className="inline-flex items-center gap-1.5 text-sm font-mono">
          {ct.phone_mobile && <Phone size={11} className="text-emerald-600" />}
          {maskPhone(ct.phone_mobile, ct.phone_unlocked)}
        </span>
      </td>

      {/* LinkedIn — columna explícita */}
      <td className="px-5 py-4 align-middle">
        {ct.linkedin_url ? (
          <a
            href={ct.linkedin_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-[#0A66C2]/20 bg-[#0A66C2]/5 px-2.5 py-1 text-xs font-medium text-[#0A66C2] transition-colors hover:bg-[#0A66C2]/10 hover:border-[#0A66C2]/40 max-w-[180px]"
            title={ct.linkedin_url}
          >
            <Linkedin size={12} className="shrink-0" />
            <span className="truncate">{handle ?? 'Ver perfil'}</span>
            <ExternalLink size={10} className="shrink-0 opacity-60" />
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>

      {/* HubSpot */}
      <td className="px-5 py-4 align-middle">
        <span
          className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium whitespace-nowrap"
          style={{ background: hsStyle.bg, color: hsStyle.fg, borderColor: hsStyle.border }}
        >
          <HsIcon size={11} />
          {hsStyle.label}
        </span>
      </td>

      {/* Sesión */}
      <td className="px-5 py-4 align-middle">
        {ct.prospector_session_id ? (
          <Link
            href={`/contactos/historial/${ct.prospector_session_id}`}
            className="text-xs font-mono hover:underline whitespace-nowrap"
            style={{ color: ACCENT }}
          >
            {ct.prospector_session_id.slice(0, 8).toUpperCase()}
          </Link>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  );
}
