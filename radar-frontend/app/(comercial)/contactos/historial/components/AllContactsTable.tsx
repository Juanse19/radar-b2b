'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, Linkedin, Phone, CheckCircle2, AlertCircle, Clock, Loader2, Send } from 'lucide-react';
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
  pais:              string | null;
  hubspot_status:    string;
  prospector_session_id: string | null;
  created_at:        string;
}

type FilterMode = 'all' | 'sincronizado' | 'pendiente' | 'error';

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

interface Props {
  initial: ContactoRow[];
}

export function AllContactsTable({ initial }: Props) {
  const [contactos]               = useState<ContactoRow[]>(initial);
  const [filter,    setFilter]    = useState<FilterMode>('all');
  const [searchQ,   setSearchQ]   = useState('');

  const counts = useMemo(() => {
    const c = { all: contactos.length, sincronizado: 0, pendiente: 0, error: 0 };
    for (const x of contactos) {
      if (x.hubspot_status === 'sincronizado') c.sincronizado++;
      else if (x.hubspot_status === 'error')   c.error++;
      else                                      c.pendiente++;
    }
    return c;
  }, [contactos]);

  const filtered = useMemo(() => {
    let xs = contactos;
    if (filter !== 'all') xs = xs.filter(c => (c.hubspot_status ?? 'pendiente') === filter);
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
  }, [contactos, filter, searchQ]);

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
        <Link href="/contactos">
          <Button size="sm" style={{ background: ACCENT, color: '#fff' }}>
            Iniciar prospección
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/70 bg-card overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold leading-tight">Contactos prospectados</h3>
          <p className="text-xs text-muted-foreground">
            {counts.all} contacto{counts.all !== 1 ? 's' : ''}
            {counts.sincronizado > 0 && <> · {counts.sincronizado} sincronizado{counts.sincronizado !== 1 ? 's' : ''}</>}
            {counts.pendiente > 0    && <> · {counts.pendiente} pendiente{counts.pendiente !== 1 ? 's' : ''}</>}
            {counts.error > 0        && <> · {counts.error} con error</>}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              placeholder="Buscar nombre, email, empresa…"
              className="pl-7 h-8 text-xs"
            />
          </div>
          <div className="inline-flex rounded-lg border border-border/60 bg-background p-0.5">
            {filters.map(f => {
              const active = filter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    'px-3 py-1 text-xs rounded-md transition-colors',
                    active ? 'bg-accent text-accent-foreground font-medium' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {f.label}
                  {f.count > 0 && <span className={cn('ml-1.5 text-[10px]', active ? 'opacity-80' : 'opacity-60')}>{f.count}</span>}
                </button>
              );
            })}
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={counts.all === 0}
          >
            <Send size={13} className="mr-1.5" /> Sync HubSpot
          </Button>
        </div>
      </div>

      {/* Tabla */}
      {filtered.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">
          Sin coincidencias para "{searchQ}".
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2.5 text-left font-medium">Contacto</th>
                <th className="px-4 py-2.5 text-left font-medium">Empresa</th>
                <th className="px-4 py-2.5 text-left font-medium">Email</th>
                <th className="px-4 py-2.5 text-left font-medium">Teléfono</th>
                <th className="px-4 py-2.5 text-left font-medium">HubSpot</th>
                <th className="px-4 py-2.5 text-left font-medium">Sesión</th>
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

function Row({ ct }: { ct: ContactoRow }) {
  const fullName = `${ct.first_name ?? ''} ${ct.last_name ?? ''}`.trim() || '—';
  const initials = ((ct.first_name?.charAt(0) ?? '') + (ct.last_name?.charAt(0) ?? '')).toUpperCase() || '??';
  const avatar   = avatarColors(fullName);
  const hsStyle  = HUBSPOT_STYLE[ct.hubspot_status] ?? HUBSPOT_STYLE.pendiente;
  const HsIcon   = hsStyle.icon;

  return (
    <tr className="border-b border-border/40 last:border-b-0 hover:bg-muted/20 transition-colors">
      <td className="px-4 py-3 align-middle">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
            style={{ background: avatar.bg, color: avatar.fg }}
          >
            {initials}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-sm font-medium">{fullName}</p>
              {ct.linkedin_url && (
                <a href={ct.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:opacity-70">
                  <Linkedin size={12} />
                </a>
              )}
            </div>
            <p className="truncate text-xs text-muted-foreground">{ct.title ?? '—'}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 align-middle">
        <p className="truncate text-sm font-medium">{ct.empresa_nombre ?? '—'}</p>
        <p className="text-xs text-muted-foreground">
          {ct.pais ?? '—'}{ct.empresa_tier && <> · tier {ct.empresa_tier}</>}
        </p>
      </td>
      <td className="px-4 py-3 align-middle">
        {ct.email ? (
          <a href={`mailto:${ct.email}`} className="text-sm hover:underline" style={{ color: ACCENT }}>
            {ct.email}
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-4 py-3 align-middle">
        <span className="inline-flex items-center gap-1.5 text-sm font-mono">
          {ct.phone_mobile && <Phone size={11} className="text-emerald-600" />}
          {maskPhone(ct.phone_mobile, ct.phone_unlocked)}
        </span>
      </td>
      <td className="px-4 py-3 align-middle">
        <span
          className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium"
          style={{ background: hsStyle.bg, color: hsStyle.fg, borderColor: hsStyle.border }}
        >
          <HsIcon size={11} />
          {hsStyle.label}
        </span>
      </td>
      <td className="px-4 py-3 align-middle">
        {ct.prospector_session_id ? (
          <Link
            href={`/contactos/historial/${ct.prospector_session_id}`}
            className="text-xs font-mono hover:underline"
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
