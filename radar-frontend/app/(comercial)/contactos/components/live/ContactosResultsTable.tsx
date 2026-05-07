'use client';

import { useMemo, useState } from 'react';
import {
  Linkedin,
  Phone,
  Send,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  ExternalLink,
  Crown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { UnlockPhoneButton } from './UnlockPhoneButton';
import type { ContactCardState } from './useProspectorStream';

interface Props {
  contacts:        ContactCardState[];
  isStreaming?:    boolean;
  onPhoneUnlocked?: (apolloId: string, telMovil: string) => void;
}

type FilterMode = 'all' | 'sincronizado' | 'pendiente' | 'error';

const ACCENT = 'var(--agent-contactos)';

const LINEA_DOT: Record<string, string> = {
  bhs:                 '#0EA5E9',
  aeropuertos:         '#0EA5E9',
  cargo_uld:           '#0EA5E9',
  carton_papel:        '#10B981',
  carton_corrugado:    '#10B981',
  intralogistica:      '#F59E0B',
  final_linea:         '#F59E0B',
  ensambladoras_motos: '#F59E0B',
  solumat:             '#F59E0B',
  logistica:           '#F59E0B',
};

interface TierStyle {
  bg:      string;
  fg:      string;
  border:  string;
  label:   string;
  ribbon?: boolean;
}

const TIER_BADGE: Record<string, TierStyle> = {
  'A':             { bg: '#FBBF24', fg: '#451A03', border: '#F59E0B', label: 'A', ribbon: true },
  'B':             { bg: '#FCE7F3', fg: '#831843', border: '#FBCFE8', label: 'B' },
  'C':             { bg: '#EDE9FE', fg: '#4C1D95', border: '#DDD6FE', label: 'C' },
  'D':             { bg: '#E5E7EB', fg: '#374151', border: '#D1D5DB', label: 'D' },
  'sin_calificar': { bg: '#F3F4F6', fg: '#6B7280', border: '#E5E7EB', label: '—' },
};

const HUBSPOT_STYLE: Record<string, { bg: string; fg: string; border: string; icon: typeof CheckCircle2; label: string }> = {
  sincronizado: { bg: '#D1FAE5', fg: '#047857', border: '#A7F3D0', icon: CheckCircle2, label: 'Sincronizado' },
  pendiente:    { bg: '#FEF3C7', fg: '#92400E', border: '#FDE68A', icon: Clock,         label: 'Pendiente' },
  error:        { bg: '#FEE2E2', fg: '#B91C1C', border: '#FECACA', icon: AlertCircle,   label: 'Error' },
};

function avatarColors(name: string): { bg: string; fg: string } {
  const palette = [
    { bg: '#DBEAFE', fg: '#1E40AF' },
    { bg: '#FEE2E2', fg: '#B91C1C' },
    { bg: '#D1FAE5', fg: '#065F46' },
    { bg: '#FEF3C7', fg: '#92400E' },
    { bg: '#E9D5FF', fg: '#6B21A8' },
    { bg: '#FCE7F3', fg: '#9D174D' },
    { bg: '#CFFAFE', fg: '#155E75' },
    { bg: '#FED7AA', fg: '#9A3412' },
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

function getInitials(name: string, last: string): string {
  const a = (name?.trim().charAt(0) ?? '').toUpperCase();
  const b = (last?.trim().charAt(0) ?? '').toUpperCase();
  return (a + b) || '??';
}

function maskPhone(tel: string | null | undefined, unlocked: boolean): string {
  if (!tel) return '—';
  if (unlocked) return tel;
  const cleaned = tel.replace(/[^\d+]/g, '');
  if (cleaned.length < 6) return '••••••••';
  const head = cleaned.slice(0, Math.min(7, cleaned.length - 4));
  const tail = cleaned.slice(-4);
  return `${head} •••• ${tail}`;
}

function linkedinHandle(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/linkedin\.com\/(?:in|pub|company)\/([^/?#]+)/i);
  return m ? m[1] : url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

function TierBadge({ tier }: { tier: string }) {
  const t = TIER_BADGE[tier] ?? TIER_BADGE.sin_calificar;
  if (t.ribbon) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-bold uppercase tracking-wide shadow-sm"
        style={{
          background:  `linear-gradient(135deg, ${t.bg} 0%, #FCD34D 100%)`,
          color:       t.fg,
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

export function ContactosResultsTable({ contacts, isStreaming, onPhoneUnlocked }: Props) {
  const [filter, setFilter]   = useState<FilterMode>('all');
  const [syncing, setSyncing] = useState(false);

  const counts = useMemo(() => {
    const c = { all: contacts.length, sincronizado: 0, pendiente: 0, error: 0 };
    for (const ct of contacts) {
      const s = (ct as ContactCardState & { hubspot_status?: string }).hubspot_status ?? 'pendiente';
      if      (s === 'sincronizado') c.sincronizado++;
      else if (s === 'error')        c.error++;
      else                            c.pendiente++;
    }
    return c;
  }, [contacts]);

  const filtered = useMemo(() => {
    if (filter === 'all') return contacts;
    return contacts.filter(ct => {
      const s = (ct as ContactCardState & { hubspot_status?: string }).hubspot_status ?? 'pendiente';
      return s === filter;
    });
  }, [contacts, filter]);

  async function handleBatchSync() {
    const ids = contacts.filter(c => c.contacto_id).map(c => c.contacto_id!);
    if (ids.length === 0) return;
    setSyncing(true);
    try {
      // eslint-disable-next-line no-console
      console.info('[Sync HubSpot] batch ids:', ids);
      await new Promise(r => setTimeout(r, 600));
    } finally {
      setSyncing(false);
    }
  }

  if (contacts.length === 0) {
    return (
      <div className="rounded-lg border border-border/60 p-10 text-center">
        {isStreaming ? (
          <>
            <Loader2 size={20} className="mx-auto mb-2 animate-spin" style={{ color: ACCENT }} />
            <p className="text-sm font-medium" style={{ color: ACCENT }}>Esperando primer contacto…</p>
            <p className="text-xs text-muted-foreground mt-1">Apollo Search → Enrich → fila aparecerá aquí</p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Sin contactos esta sesión.</p>
        )}
      </div>
    );
  }

  const filters: Array<{ id: FilterMode; label: string; count: number }> = [
    { id: 'all',          label: 'Todos',         count: counts.all },
    { id: 'sincronizado', label: 'Sincronizados', count: counts.sincronizado },
    { id: 'pendiente',    label: 'Pendientes',    count: counts.pendiente },
    { id: 'error',        label: 'Errores',       count: counts.error },
  ];

  return (
    <div className="rounded-xl border border-border/70 bg-card overflow-hidden">
      {/* ── Toolbar ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 border-b border-border/60 px-5 py-4 lg:flex-row lg:items-end lg:justify-between">
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

        <div className="flex flex-wrap items-center gap-3">
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
          <Button
            type="button"
            size="sm"
            onClick={handleBatchSync}
            disabled={syncing || counts.all === 0}
            style={{ background: ACCENT, color: '#fff' }}
            className="h-9 shadow-sm"
          >
            {syncing
              ? <><Loader2 size={14} className="mr-1.5 animate-spin" /> Sincronizando…</>
              : <><Send size={14} className="mr-1.5" /> Sync HubSpot</>
            }
          </Button>
        </div>
      </div>

      {/* ── Tabla ──────────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="px-5 py-3 text-left font-semibold">Contacto</th>
              <th className="px-5 py-3 text-left font-semibold">Empresa · Línea</th>
              <th className="px-5 py-3 text-left font-semibold">Tier</th>
              <th className="px-5 py-3 text-left font-semibold">Email</th>
              <th className="px-5 py-3 text-left font-semibold">Teléfono</th>
              <th className="px-5 py-3 text-left font-semibold">LinkedIn</th>
              <th className="px-5 py-3 text-left font-semibold">HubSpot</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(ct => (
              <ContactRow
                key={ct.apollo_id}
                contact={ct}
                onUnlocked={onPhoneUnlocked}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Subcomponent: ContactRow ────────────────────────────────────────────────

interface RowProps {
  contact:    ContactCardState;
  onUnlocked?: (apolloId: string, telMovil: string) => void;
}

function ContactRow({ contact, onUnlocked }: RowProps) {
  const fullName = `${contact.nombre} ${contact.apellido}`.trim() || '—';
  const initials = getInitials(contact.nombre, contact.apellido);
  const avatar   = avatarColors(fullName);
  const dot      = LINEA_DOT[contact.sublinea ?? ''] ?? '#94A3B8';
  const handle   = linkedinHandle(contact.linkedin);

  const hubspot = (contact as ContactCardState & { hubspot_status?: string }).hubspot_status ?? 'pendiente';
  const hsStyle = HUBSPOT_STYLE[hubspot] ?? HUBSPOT_STYLE.pendiente;
  const HsIcon  = hsStyle.icon;

  const isGold = (contact.empresa_tier ?? '') === 'A';

  return (
    <tr
      className={cn(
        'border-b border-border/40 last:border-b-0 transition-colors hover:bg-muted/30',
        isGold && 'bg-amber-50/30',
      )}
    >
      {/* Contacto */}
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
            <p className="truncate text-xs text-muted-foreground">{contact.cargo}</p>
          </div>
        </div>
      </td>

      {/* Empresa · Línea */}
      <td className="px-5 py-4 align-middle">
        <p className="truncate text-sm font-medium">{contact.empresa}</p>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: dot }} />
          <span className="truncate">{contact.sublinea ?? '—'}</span>
        </p>
      </td>

      {/* Tier */}
      <td className="px-5 py-4 align-middle">
        <TierBadge tier={contact.empresa_tier ?? 'sin_calificar'} />
      </td>

      {/* Email */}
      <td className="px-5 py-4 align-middle">
        <a
          href={`mailto:${contact.email}`}
          className="text-sm hover:underline truncate max-w-[220px] inline-block"
          style={{ color: ACCENT }}
        >
          {contact.email}
        </a>
        {contact.estado_email && contact.estado_email !== 'verified' && (
          <p className="text-[10px] text-muted-foreground italic">{contact.estado_email}</p>
        )}
      </td>

      {/* Teléfono */}
      <td className="px-5 py-4 align-middle whitespace-nowrap">
        {contact.tel_movil ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-mono">
            <Phone size={11} className="text-emerald-600" />
            {maskPhone(contact.tel_movil, contact.phone_unlocked)}
          </span>
        ) : (
          <UnlockPhoneButton
            contactoId={contact.contacto_id}
            telMovil={null}
            unlocked={false}
            onUnlocked={tel => onUnlocked?.(contact.apollo_id, tel)}
            disabled={!contact.saved}
          />
        )}
      </td>

      {/* LinkedIn — columna explícita */}
      <td className="px-5 py-4 align-middle">
        {contact.linkedin ? (
          <a
            href={contact.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-[#0A66C2]/20 bg-[#0A66C2]/5 px-2.5 py-1 text-xs font-medium text-[#0A66C2] transition-colors hover:bg-[#0A66C2]/10 hover:border-[#0A66C2]/40 max-w-[180px]"
            title={contact.linkedin}
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
    </tr>
  );
}
