'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Download,
  Plus,
  Search,
  ChevronRight,
  Building2,
  Plane,
  Package,
  Truck,
  Users,
  Radio,
  Star,
  Zap,
  Boxes,
  Bike,
  Layers,
  X,
  Loader2,
} from 'lucide-react';
import { LINEAS_CONFIG } from '@/lib/comercial/lineas-config';
import { CompanyDetailDrawer } from './components/CompanyDetailDrawer';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EmpresaItem {
  id:        number;
  name:      string;
  country:   string;
  tier?:     string;
  score?:    number;
  linea?:    string;
  sublinea?: string;
  domain?:   string;
  contactos?:number;
  senales?:  number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const LINEA_COLORS: Record<string, string> = {
  BHS:              '#0ea5e9',
  'Cartón':         '#10b981',
  'Intralogística': '#f59e0b',
  'Final de Línea': '#8b5cf6',
  'Motos':          '#ef4444',
  'Solumat':        '#f97316',
};

const LINEA_ICONS: Record<string, React.ElementType> = {
  BHS:              Plane,
  'Cartón':         Package,
  'Intralogística': Truck,
  'Final de Línea': Boxes,
  'Motos':          Bike,
  'Solumat':        Layers,
};

const TIER_PILLS = [
  { value: 'ALL',          label: 'Todas' },
  { value: 'ORO',          label: 'ORO' },
  { value: 'MONITOREO',    label: 'MONITOREO' },
  { value: 'ARCHIVO',      label: 'ARCHIVO' },
  { value: 'sin_calificar',label: 'Sin calificar' },
] as const;

type TierFilter = typeof TIER_PILLS[number]['value'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '';
  const diffMs  = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60)  return `Hace ${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24)   return `Hace ${diffH}h`;
  return `Hace ${Math.floor(diffH / 24)}d`;
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]!.toUpperCase())
    .join('');
}

function matchesTierFilter(empresa: EmpresaItem, filter: TierFilter): boolean {
  if (filter === 'ALL') return true;
  if (filter === 'sin_calificar') return !empresa.tier;
  return empresa.tier === filter;
}

/** Maps any linea string (parent label, parent key, or sub-linea name) → parent key used in LINEAS_CONFIG. */
function resolveParentLinea(lineaFromApi: string): string {
  if (!lineaFromApi) return 'Sin línea';
  const exactMatch = LINEAS_CONFIG.find(
    l => l.key === lineaFromApi || l.label === lineaFromApi,
  );
  if (exactMatch) return exactMatch.key;
  for (const lc of LINEAS_CONFIG) {
    if (lc.sublineas.some(s => s.toLowerCase() === lineaFromApi.toLowerCase())) {
      return lc.key;
    }
  }
  return lineaFromApi;
}

// ── Modal types ───────────────────────────────────────────────────────────────

type ModalState = 'idle' | 'add' | 'edit' | 'delete';

interface EmpresaFormValues {
  company_name:   string;
  pais:           string;
  linea_negocio:  string;
  sublinea:       string;
  company_domain: string;
}

const EMPTY_FORM: EmpresaFormValues = {
  company_name:   '',
  pais:           '',
  linea_negocio:  'BHS',
  sublinea:       '',
  company_domain: '',
};

// ── CRUD Modals ───────────────────────────────────────────────────────────────

function EmpresaModal({
  mode,
  initial,
  onClose,
  onSaved,
}: {
  mode:    'add' | 'edit';
  initial: EmpresaItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm]     = useState<EmpresaFormValues>(() =>
    mode === 'edit' && initial
      ? {
          company_name:   initial.name,
          pais:           initial.country ?? '',
          linea_negocio:  initial.linea ?? 'BHS',
          sublinea:       initial.sublinea ?? '',
          company_domain: initial.domain ?? '',
        }
      : { ...EMPTY_FORM },
  );
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  function field<K extends keyof EmpresaFormValues>(key: K, value: EmpresaFormValues[K]) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (mode === 'add') {
        const res = await fetch('/api/companies', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            company_name:   form.company_name.trim(),
            pais:           form.pais || undefined,
            linea_negocio:  form.linea_negocio,
            company_domain: form.company_domain || undefined,
          }),
        });
        const data = await res.json() as Record<string, unknown>;
        if (!res.ok) throw new Error(String(data['error'] ?? 'Error al crear'));
      } else {
        const res = await fetch(`/api/companies/${String(initial?.id ?? '')}`, {
          method:  'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            company_name:   form.company_name.trim(),
            pais:           form.pais || undefined,
            linea_negocio:  form.linea_negocio,
            company_domain: form.company_domain || undefined,
          }),
        });
        const data = await res.json() as Record<string, unknown>;
        if (!res.ok) throw new Error(String(data['error'] ?? 'Error al actualizar'));
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setSaving(false);
    }
  }

  const title = mode === 'add' ? 'Agregar empresa' : 'Editar empresa';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-testid="empresa-modal"
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: '100%', maxWidth: 440, background: 'var(--card)',
        border: '1px solid var(--border)', borderRadius: 12,
        padding: '24px', boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
      }}>
        {/* Modal header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>{title}</h2>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', padding: 4 }}
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={e => { void handleSubmit(e); }} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Nombre */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Nombre <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              required
              data-testid="modal-nombre"
              value={form.company_name}
              onChange={e => field('company_name', e.target.value)}
              placeholder="Ej: Aeropuertos de Colombia S.A."
              style={{
                padding: '8px 10px', borderRadius: 7,
                border: '1px solid var(--border)', background: 'var(--background)',
                color: 'var(--foreground)', fontSize: 13, outline: 'none', boxSizing: 'border-box', width: '100%',
              }}
            />
          </div>

          {/* País */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>País</label>
            <input
              data-testid="modal-pais"
              value={form.pais}
              onChange={e => field('pais', e.target.value)}
              placeholder="Colombia"
              style={{
                padding: '8px 10px', borderRadius: 7,
                border: '1px solid var(--border)', background: 'var(--background)',
                color: 'var(--foreground)', fontSize: 13, outline: 'none', boxSizing: 'border-box', width: '100%',
              }}
            />
          </div>

          {/* Línea */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Línea <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <select
              required
              value={form.linea_negocio}
              onChange={e => field('linea_negocio', e.target.value)}
              style={{
                padding: '8px 10px', borderRadius: 7,
                border: '1px solid var(--border)', background: 'var(--background)',
                color: 'var(--foreground)', fontSize: 13, outline: 'none', boxSizing: 'border-box', width: '100%',
              }}
            >
              {LINEAS_CONFIG.map(l => (
                <option key={l.key} value={l.key}>{l.label}</option>
              ))}
            </select>
          </div>

          {/* Sublínea */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sublínea</label>
            <input
              value={form.sublinea}
              onChange={e => field('sublinea', e.target.value)}
              placeholder="Ej: Aeropuertos"
              style={{
                padding: '8px 10px', borderRadius: 7,
                border: '1px solid var(--border)', background: 'var(--background)',
                color: 'var(--foreground)', fontSize: 13, outline: 'none', boxSizing: 'border-box', width: '100%',
              }}
            />
          </div>

          {/* Dominio */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dominio</label>
            <input
              value={form.company_domain}
              onChange={e => field('company_domain', e.target.value)}
              placeholder="empresa.com"
              style={{
                padding: '8px 10px', borderRadius: 7,
                border: '1px solid var(--border)', background: 'var(--background)',
                color: 'var(--foreground)', fontSize: 13, outline: 'none', boxSizing: 'border-box', width: '100%',
              }}
            />
          </div>

          {error && (
            <p style={{ fontSize: 12, color: '#ef4444', margin: 0 }}>{error}</p>
          )}

          {/* Footer */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '7px 16px', borderRadius: 7, fontSize: 13, fontWeight: 500,
                border: '1px solid var(--border)', background: 'none',
                color: 'var(--muted-foreground)', cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              data-testid="modal-submit"
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 16px', borderRadius: 7, fontSize: 13, fontWeight: 600,
                border: 'none', background: 'var(--primary)',
                color: 'var(--primary-foreground)', cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />}
              {mode === 'add' ? 'Agregar' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteModal({
  empresa,
  onClose,
  onDeleted,
}: {
  empresa: EmpresaItem;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  async function handleDelete() {
    setError(null);
    setDeleting(true);
    try {
      const res  = await fetch(`/api/companies/${String(empresa.id)}`, { method: 'DELETE' });
      const data = await res.json() as Record<string, unknown>;
      if (!res.ok) throw new Error(String(data['error'] ?? 'Error al eliminar'));
      onDeleted();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Confirmar eliminación"
      data-testid="empresa-modal"
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: '100%', maxWidth: 380, background: 'var(--card)',
        border: '1px solid var(--border)', borderRadius: 12,
        padding: '24px', boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>Eliminar empresa</h2>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', padding: 4 }}
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 20 }}>
          ¿Confirmas eliminar <strong style={{ color: 'var(--foreground)' }}>{empresa.name}</strong>? Esta acción no se puede deshacer.
        </p>
        {error && (
          <p style={{ fontSize: 12, color: '#ef4444', marginBottom: 12 }}>{error}</p>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '7px 16px', borderRadius: 7, fontSize: 13, fontWeight: 500,
              border: '1px solid var(--border)', background: 'none',
              color: 'var(--muted-foreground)', cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => { void handleDelete(); }}
            disabled={deleting}
            data-testid="modal-delete-confirm"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 16px', borderRadius: 7, fontSize: 13, fontWeight: 600,
              border: 'none', background: '#dc2626',
              color: '#fff', cursor: deleting ? 'not-allowed' : 'pointer',
              opacity: deleting ? 0.7 : 1,
            }}
          >
            {deleting && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />}
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Summary cards ─────────────────────────────────────────────────────────────

interface SummaryCardProps {
  kicker: string;
  value:  React.ReactNode;
  sub:    string;
  icon:   React.ElementType;
  color:  string;
}

function SummaryCard({ kicker, value, sub, icon: Icon, color }: SummaryCardProps) {
  return (
    <div style={{
      borderRadius: 10, border: '1px solid var(--border)',
      background: 'var(--card)', padding: '14px 16px',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--muted-foreground)' }}>
          {kicker}
        </p>
        <div style={{ width: 28, height: 28, borderRadius: 7, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={13} style={{ color }} />
        </div>
      </div>
      <p style={{ fontSize: 26, fontWeight: 700, fontFamily: 'var(--font-mono-ui, monospace)', color: 'var(--foreground)', lineHeight: 1 }}>
        {value}
      </p>
      <p style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>{sub}</p>
    </div>
  );
}

// ── Company row ───────────────────────────────────────────────────────────────

function EmpresaRow({
  empresa,
  lineaColor,
  onSelect,
  onEdit,
  onDelete,
}: {
  empresa:    EmpresaItem;
  lineaColor: string;
  onSelect:   (e: EmpresaItem) => void;
  onEdit:     (e: EmpresaItem) => void;
  onDelete:   (e: EmpresaItem) => void;
}) {
  const tierStyles: Record<string, { bg: string; color: string }> = {
    ORO:       { bg: '#fef3c7', color: '#92400e' },
    MONITOREO: { bg: '#dbeafe', color: '#1e40af' },
    ARCHIVO:   { bg: '#f3f4f6', color: '#6b7280' },
  };
  const ts = empresa.tier ? (tierStyles[empresa.tier] ?? null) : null;

  return (
    <tr
      onClick={() => onSelect(empresa)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(empresa); } }}
      tabIndex={0}
      role="button"
      aria-label={`Ver detalle de ${empresa.name}`}
      data-testid="empresa-row"
      style={{ cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
      className="group hover-row"
    >
      {/* Empresa */}
      <td style={{ padding: '10px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6, flexShrink: 0,
            background: `${lineaColor}18`, color: lineaColor,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 700,
          }}>
            {initials(empresa.name)}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--foreground)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {empresa.name}
            </p>
            {empresa.domain && (
              <p style={{ fontSize: 10, color: 'var(--muted-foreground)', fontFamily: 'monospace', marginTop: 1 }}>
                {empresa.domain}
              </p>
            )}
          </div>
        </div>
      </td>

      {/* Pais */}
      <td style={{ padding: '10px 12px', fontSize: 11, color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>
        {empresa.country || '—'}
      </td>

      {/* Radar */}
      <td style={{ padding: '10px 12px' }}>
        {(empresa.senales ?? 0) > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: 'var(--foreground)', fontWeight: 600 }}>
              {empresa.senales} señale{empresa.senales !== 1 ? 's' : ''}
            </span>
          </div>
        ) : (
          <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Sin señales</span>
        )}
      </td>

      {/* Calificador */}
      <td style={{ padding: '10px 12px' }}>
        {ts && empresa.tier ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 700, background: ts.bg, color: ts.color }}>
              {empresa.tier}
            </span>
            {empresa.score !== undefined && (
              <span style={{ fontSize: 11, color: 'var(--muted-foreground)', fontFamily: 'monospace' }}>
                {empresa.score}/10
              </span>
            )}
          </div>
        ) : (
          <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>—</span>
        )}
      </td>

      {/* Contactos */}
      <td style={{ padding: '10px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Users size={10} style={{ color: 'var(--muted-foreground)' }} />
          <span style={{ fontSize: 11, color: 'var(--foreground)', fontFamily: 'monospace' }}>
            {empresa.contactos ?? 0}
          </span>
          {(empresa.contactos ?? 0) > 0 && (
            <span style={{ marginLeft: 4, fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 10, background: '#dcfce7', color: '#166534' }}>
              +{empresa.contactos} NUEVOS
            </span>
          )}
        </div>
      </td>

      {/* Actions */}
      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}
          onClick={e => e.stopPropagation()}
        >
          <button
            type="button"
            title="Editar"
            onClick={e => { e.stopPropagation(); onEdit(empresa); }}
            style={{
              width: 26, height: 26, borderRadius: 6, border: '1px solid var(--border)',
              background: 'none', cursor: 'pointer', color: 'var(--muted-foreground)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: 0, transition: 'opacity 0.1s',
            }}
            className="group-hover-show"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button
            type="button"
            title="Eliminar"
            onClick={e => { e.stopPropagation(); onDelete(empresa); }}
            style={{
              width: 26, height: 26, borderRadius: 6, border: '1px solid var(--border)',
              background: 'none', cursor: 'pointer', color: 'var(--muted-foreground)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: 0, transition: 'opacity 0.1s',
            }}
            className="group-hover-show"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
          <ChevronRight size={14} style={{ color: 'var(--muted-foreground)' }} />
        </div>
      </td>
    </tr>
  );
}

// ── Linea section ─────────────────────────────────────────────────────────────

function LineaSection({
  lineaKey,
  empresas,
  onSelect,
  onEdit,
  onDelete,
}: {
  lineaKey:  string;
  empresas:  EmpresaItem[];
  onSelect:  (e: EmpresaItem) => void;
  onEdit:    (e: EmpresaItem) => void;
  onDelete:  (e: EmpresaItem) => void;
}) {
  const [open, setOpen] = useState(true);
  const color = LINEA_COLORS[lineaKey] ?? '#71717a';
  const Icon  = LINEA_ICONS[lineaKey] ?? Building2;

  // Group by sublinea
  const bySublinea = empresas.reduce<Record<string, EmpresaItem[]>>((acc, e) => {
    const key = e.sublinea ?? 'Sin sublínea';
    return { ...acc, [key]: [...(acc[key] ?? []), e] };
  }, {});

  const sublineas = Object.keys(bySublinea);

  const oroCount     = empresas.filter(e => e.tier === 'ORO').length;
  const senalCount   = empresas.filter(e => (e.senales ?? 0) > 0).length;
  const contactCount = empresas.reduce((s, e) => s + (e.contactos ?? 0), 0);

  return (
    <div style={{ borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
      {/* Linea header */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 16px', background: `linear-gradient(90deg, ${color}10, transparent)`,
          border: 'none', cursor: 'pointer', textAlign: 'left',
          borderBottom: open ? '1px solid var(--border)' : 'none',
        }}
      >
        <ChevronRight
          size={14}
          style={{
            color, flexShrink: 0,
            transform: open ? 'rotate(90deg)' : 'none',
            transition: 'transform 0.15s',
          }}
        />
        <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}20`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={15} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--foreground)' }}>{lineaKey}</p>
          <p style={{ fontSize: 11.5, color: 'var(--muted-foreground)', marginTop: 1 }}>
            {empresas.length} empresa{empresas.length !== 1 ? 's' : ''} · {sublineas.length} sublínea{sublineas.length !== 1 ? 's' : ''}
          </p>
        </div>
        {/* Mini metrics */}
        <div style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
          {oroCount > 0 && (
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b', fontFamily: 'monospace' }}>{oroCount}</p>
              <p style={{ fontSize: 9, color: 'var(--muted-foreground)', textTransform: 'uppercase' }}>ORO</p>
            </div>
          )}
          {senalCount > 0 && (
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#22c55e', fontFamily: 'monospace' }}>{senalCount}</p>
              <p style={{ fontSize: 9, color: 'var(--muted-foreground)', textTransform: 'uppercase' }}>Señales</p>
            </div>
          )}
          {contactCount > 0 && (
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#71acd2', fontFamily: 'monospace' }}>{contactCount}</p>
              <p style={{ fontSize: 9, color: 'var(--muted-foreground)', textTransform: 'uppercase' }}>Contactos</p>
            </div>
          )}
        </div>
      </button>

      {open && (
        <div>
          {sublineas.map(sublinea => {
            const rows = bySublinea[sublinea] ?? [];
            return (
              <SublineaSection
                key={sublinea}
                sublinea={sublinea}
                empresas={rows}
                color={color}
                onSelect={onSelect}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Sublinea section ──────────────────────────────────────────────────────────

function SublineaSection({
  sublinea,
  empresas,
  color,
  onSelect,
  onEdit,
  onDelete,
}: {
  sublinea: string;
  empresas: EmpresaItem[];
  color:    string;
  onSelect: (e: EmpresaItem) => void;
  onEdit:   (e: EmpresaItem) => void;
  onDelete: (e: EmpresaItem) => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      {/* Sublinea header */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 16px 8px 48px',
          background: 'var(--muted)',
          border: 'none', cursor: 'pointer', textAlign: 'left',
          borderBottom: open ? '1px solid var(--border)' : 'none',
        }}
      >
        <ChevronRight
          size={12}
          style={{
            color: 'var(--muted-foreground)',
            transform: open ? 'rotate(90deg)' : 'none',
            transition: 'transform 0.15s',
            flexShrink: 0,
          }}
        />
        <p style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--foreground)' }}>{sublinea}</p>
        <span style={{
          marginLeft: 4, fontSize: 10, padding: '0 6px', borderRadius: 10,
          background: `${color}15`, color,
          fontWeight: 600, fontFamily: 'monospace',
        }}>
          {empresas.length}
        </span>
      </button>

      {open && (
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col />
            <col style={{ width: 100 }} />
            <col style={{ width: 140 }} />
            <col style={{ width: 150 }} />
            <col style={{ width: 120 }} />
            <col style={{ width: 40 }} />
          </colgroup>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--muted)' }}>
              {['EMPRESA', 'PAÍS', 'RADAR', 'CALIFICADOR', 'CONTACTOS', ''].map(h => (
                <th key={h} style={{ padding: '6px 12px', textAlign: 'left', fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted-foreground)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {empresas.map(e => (
              <EmpresaRow key={e.id} empresa={e} lineaColor={color} onSelect={onSelect} onEdit={onEdit} onDelete={onDelete} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function EmpresasComercialPage() {
  const [empresas,        setEmpresas]        = useState<EmpresaItem[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [search,          setSearch]          = useState('');
  const [tierFilter,      setTierFilter]      = useState<TierFilter>('ALL');
  const [selectedEmpresa, setSelectedEmpresa] = useState<EmpresaItem | null>(null);
  const [modalState,      setModalState]      = useState<ModalState>('idle');
  const [editTarget,      setEditTarget]      = useState<EmpresaItem | null>(null);
  const [deleteTarget,    setDeleteTarget]    = useState<EmpresaItem | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchEmpresas = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/comercial/companies?limit=200');
      const json = await res.json() as unknown;
      if (Array.isArray(json)) {
        setEmpresas(json.map((r: Record<string, unknown>) => ({
          id:       Number(r['id'] ?? 0),
          name:     String(r['name'] ?? r['company_name'] ?? ''),
          country:  String(r['country'] ?? r['pais'] ?? ''),
          tier:     r['tier'] != null ? String(r['tier']) : undefined,
          linea:    r['linea'] != null ? String(r['linea']) : undefined,
          sublinea: r['sublinea'] != null ? String(r['sublinea']) : undefined,
          domain:   r['domain'] != null ? String(r['domain']) : undefined,
          contactos:r['contactos'] != null ? Number(r['contactos']) : 0,
          senales:  r['senales'] != null ? Number(r['senales']) : 0,
        })));
      }
    } catch {
      // non-critical — show empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchEmpresas(); }, [fetchEmpresas]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function openAdd() {
    setEditTarget(null);
    setModalState('add');
  }

  function openEdit(e: EmpresaItem) {
    setEditTarget(e);
    setModalState('edit');
  }

  function openDelete(e: EmpresaItem) {
    setDeleteTarget(e);
    setModalState('delete');
  }

  function closeModal() {
    setModalState('idle');
    setEditTarget(null);
    setDeleteTarget(null);
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const filtered = empresas.filter(e => {
    const matchesSearch = !search || e.name.toLowerCase().includes(search.toLowerCase());
    const matchesTier   = matchesTierFilter(e, tierFilter);
    return matchesSearch && matchesTier;
  });

  // Group by all 6 lineas, resolving the parent from API linea field
  const byLinea = LINEAS_CONFIG.reduce<Record<string, EmpresaItem[]>>((acc, l) => {
    const rows = filtered.filter(e => resolveParentLinea(e.linea ?? '') === l.key);
    return { ...acc, [l.key]: rows };
  }, {});

  // Summary metrics
  const totalEmpresas  = empresas.length;
  const conSenal       = empresas.filter(e => (e.senales ?? 0) > 0).length;
  const calificadas    = empresas.filter(e => !!e.tier).length;
  const conContactos   = empresas.filter(e => (e.contactos ?? 0) > 0).length;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Inline hover style (cannot use CSS modules without config changes) */}
      <style>{`
        .hover-row { transition: background 0.1s; }
        .hover-row:hover { background: color-mix(in srgb, var(--muted) 60%, transparent); }
        .hover-row:focus-visible { outline: 2px solid var(--ring); outline-offset: -2px; }
        .hover-row:hover .group-hover-show { opacity: 1 !important; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>Empresas</h1>
            <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 4 }}>
              Vista unificada por línea y sublínea · Radar, Calificador y Contactos
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 500,
                border: '1px solid var(--border)', background: 'none',
                color: 'var(--muted-foreground)', cursor: 'pointer',
              }}
            >
              <Download size={13} />
              Exportar
            </button>
            <button
              type="button"
              data-testid="add-empresa-btn"
              onClick={openAdd}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                border: 'none', background: 'var(--primary)',
                color: 'var(--primary-foreground)', cursor: 'pointer',
              }}
            >
              <Plus size={13} />
              Agregar empresa
            </button>
          </div>
        </div>

        {/* ── Summary cards ────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <SummaryCard
            kicker="Empresas totales"
            value={loading ? '…' : totalEmpresas}
            sub={`en ${LINEAS_CONFIG.length} líneas`}
            icon={Building2}
            color="#0ea5e9"
          />
          <SummaryCard
            kicker="Último radar"
            value={loading ? '…' : conSenal}
            sub="con señales activas"
            icon={Radio}
            color="#71acd2"
          />
          <SummaryCard
            kicker="Calificadas"
            value={loading ? '…' : calificadas}
            sub="con tier asignado"
            icon={Star}
            color="#b9842a"
          />
          <SummaryCard
            kicker="Con contactos"
            value={loading ? '…' : conContactos}
            sub="prospectos encontrados"
            icon={Users}
            color="#19816a"
          />
        </div>

        {/* ── Filters ──────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: '0 0 280px' }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)', pointerEvents: 'none' }} />
            <input
              type="text"
              data-testid="search-input"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar empresa..."
              style={{
                width: '100%', padding: '7px 10px 7px 30px',
                borderRadius: 7, border: '1px solid var(--border)',
                background: 'var(--background)', color: 'var(--foreground)',
                fontSize: 12, outline: 'none', boxSizing: 'border-box',
              }}
              aria-label="Buscar empresa"
            />
          </div>

          {/* Tier pills */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {TIER_PILLS.map(p => (
              <button
                key={p.value}
                type="button"
                data-testid={`tier-filter-${p.value}`}
                onClick={() => setTierFilter(p.value)}
                style={{
                  padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                  border: `1px solid ${tierFilter === p.value ? 'var(--primary)' : 'var(--border)'}`,
                  background: tierFilter === p.value ? 'var(--primary)' : 'none',
                  color: tierFilter === p.value ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
                  cursor: 'pointer', transition: 'all 0.1s',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Hierarchical list ─────────────────────────────────────────────── */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ height: 60, borderRadius: 10, background: 'var(--muted)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {LINEAS_CONFIG.map(linea => {
              const rows = byLinea[linea.key] ?? [];
              if (rows.length === 0 && (search || tierFilter !== 'ALL')) return null;
              return (
                <LineaSection
                  key={linea.key}
                  lineaKey={linea.key}
                  empresas={rows}
                  onSelect={setSelectedEmpresa}
                  onEdit={openEdit}
                  onDelete={openDelete}
                />
              );
            })}

            {filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--muted-foreground)' }}>
                <Zap size={24} style={{ marginBottom: 8, opacity: 0.3, display: 'block', marginLeft: 'auto', marginRight: 'auto' }} />
                <p style={{ fontSize: 13 }}>
                  {search ? `Sin resultados para "${search}"` : 'Sin empresas con este filtro'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Drawer ──────────────────────────────────────────────────────────── */}
      {selectedEmpresa && (
        <CompanyDetailDrawer
          empresa={selectedEmpresa}
          onClose={() => setSelectedEmpresa(null)}
        />
      )}

      {/* ── Add / Edit Modal ─────────────────────────────────────────────────── */}
      {(modalState === 'add' || modalState === 'edit') && (
        <EmpresaModal
          mode={modalState}
          initial={editTarget}
          onClose={closeModal}
          onSaved={() => { void fetchEmpresas(); }}
        />
      )}

      {/* ── Delete Modal ─────────────────────────────────────────────────────── */}
      {modalState === 'delete' && deleteTarget && (
        <DeleteModal
          empresa={deleteTarget}
          onClose={closeModal}
          onDeleted={() => { void fetchEmpresas(); }}
        />
      )}
    </>
  );
}
