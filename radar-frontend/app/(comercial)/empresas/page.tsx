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
} from 'lucide-react';
import { getMainLineas } from '@/lib/comercial/lineas-config';
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
  BHS:           '#0ea5e9',
  'Cartón':      '#10b981',
  Intralogística:'#f59e0b',
};

const LINEA_ICONS: Record<string, React.ElementType> = {
  BHS:           Plane,
  'Cartón':      Package,
  Intralogística:Truck,
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
}: {
  empresa:    EmpresaItem;
  lineaColor: string;
  onSelect:   (e: EmpresaItem) => void;
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

      {/* Chevron */}
      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
        <ChevronRight size={14} style={{ color: 'var(--muted-foreground)' }} />
      </td>
    </tr>
  );
}

// ── Linea section ─────────────────────────────────────────────────────────────

function LineaSection({
  lineaKey,
  empresas,
  onSelect,
}: {
  lineaKey:  string;
  empresas:  EmpresaItem[];
  onSelect:  (e: EmpresaItem) => void;
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
}: {
  sublinea: string;
  empresas: EmpresaItem[];
  color:    string;
  onSelect: (e: EmpresaItem) => void;
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
              <EmpresaRow key={e.id} empresa={e} lineaColor={color} onSelect={onSelect} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function EmpresasComercialPage() {
  const [empresas,       setEmpresas]       = useState<EmpresaItem[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [search,         setSearch]         = useState('');
  const [tierFilter,     setTierFilter]     = useState<TierFilter>('ALL');
  const [selectedEmpresa, setSelectedEmpresa] = useState<EmpresaItem | null>(null);

  const mainLineas = getMainLineas();

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

  // ── Derived ────────────────────────────────────────────────────────────────

  const filtered = empresas.filter(e => {
    const matchesSearch = !search || e.name.toLowerCase().includes(search.toLowerCase());
    const matchesTier   = matchesTierFilter(e, tierFilter);
    return matchesSearch && matchesTier;
  });

  // Group by linea — only the 3 main ones
  const byLinea = mainLineas.reduce<Record<string, EmpresaItem[]>>((acc, l) => {
    const rows = filtered.filter(e => e.linea === l.key || e.linea === l.label);
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
            sub={`en ${mainLineas.length} líneas`}
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
            {mainLineas.map(linea => {
              const rows = byLinea[linea.key] ?? [];
              if (rows.length === 0 && (search || tierFilter !== 'ALL')) return null;
              return (
                <LineaSection
                  key={linea.key}
                  lineaKey={linea.key}
                  empresas={rows}
                  onSelect={setSelectedEmpresa}
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
    </>
  );
}
