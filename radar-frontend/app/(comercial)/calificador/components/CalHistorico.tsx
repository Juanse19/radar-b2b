'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { X, ChevronRight, Search, Download, RefreshCw, Users } from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const AGENT_COLOR = 'var(--agent-calificador, #b9842a)';
const AGENT_TINT  = 'var(--agent-calificador-tint, rgba(185,132,42,0.08))';

const CIRCUMFERENCE = 2 * Math.PI * 34; // ≈ 213.63

type TierKey = 'A' | 'B' | 'C' | 'D';

const TIER_LABEL: Record<TierKey, string> = {
  A: 'ORO',
  B: 'MONITOREO',
  C: 'ARCHIVO',
  D: 'DESCARTAR',
};

const TIER_STYLE: Record<TierKey, { color: string; bg: string }> = {
  A: { color: 'var(--gold, #b9842a)', bg: 'rgba(185,132,42,0.10)' },
  B: { color: '#1f5d8d',              bg: 'rgba(31,93,141,0.10)'  },
  C: { color: '#5c6f81',              bg: 'rgba(92,111,129,0.10)' },
  D: { color: '#8b1a3c',              bg: 'rgba(139,26,60,0.08)'  },
};

const DIM_CONFIG: Array<{ key: keyof CalificacionItem; label: string }> = [
  { key: 'score_impacto',           label: 'Impacto presupuesto' },
  { key: 'score_multiplanta',       label: 'Multiplanta'         },
  { key: 'score_recurrencia',       label: 'Recurrencia'         },
  { key: 'score_referente',         label: 'Referente mercado'   },
  { key: 'score_acceso_al_decisor', label: 'Acceso al decisor'   },
  { key: 'score_anio',              label: 'Año objetivo'        },
  { key: 'score_prioridad',         label: 'Prioridad comercial' },
  { key: 'score_cuenta_estrategica',label: 'Cuenta estratégica'  },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface CalificacionItem {
  id:                       number;
  empresa_nombre:           string;
  pais:                     string;
  linea_negocio:            string;
  tier_calculado:           TierKey;
  score_total:              number;
  score_impacto:            number;
  score_multiplanta:        number;
  score_recurrencia:        number;
  score_referente:          number;
  score_acceso_al_decisor:  number;
  score_anio:               number;
  score_ticket:             number | null;
  score_prioridad:          number;
  score_cuenta_estrategica: number;
  created_at:               string;
  senales_count?:           number;
  contactos_count?:         number;
}

type SortField = 'empresa_nombre' | 'score_total' | 'created_at';
type SortDir   = 'asc' | 'desc';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toTierKey(raw: string): TierKey {
  if (raw === 'A' || raw === 'B' || raw === 'C' || raw === 'D') return raw;
  // Backwards compat: legacy sub-tier rows (B-Alta / B-Baja) → B.
  if (raw === 'B-Alta' || raw === 'B-Baja') return 'B';
  return 'C';
}

function dashOffset(score: number): number {
  const clamped = Math.max(0, Math.min(10, score));
  return CIRCUMFERENCE - (clamped / 10) * CIRCUMFERENCE;
}

function scoreBarWidth(score: number): string {
  return `${Math.min(100, Math.max(0, score * 10))}%`;
}

function dimBarColor(score: number): string {
  if (score >= 8) return '#b9842a';
  if (score >= 5) return '#1f5d8d';
  return '#8fa3b5';
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function exportCsv(items: CalificacionItem[]): void {
  const headers = [
    'Empresa', 'País', 'Línea', 'Tier', 'Score',
    'Señales', 'Contactos', 'Fecha',
  ];
  const rows = items.map(i => [
    i.empresa_nombre, i.pais, i.linea_negocio,
    TIER_LABEL[i.tier_calculado],
    i.score_total.toFixed(1),
    String(i.senales_count ?? 0),
    String(i.contactos_count ?? 0),
    formatDate(i.created_at),
  ]);
  const csv = [headers, ...rows]
    .map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href     = url;
  link.download = 'calificaciones.csv';
  link.click();
  URL.revokeObjectURL(url);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface TierBadgeProps {
  tier: TierKey;
  small?: boolean;
}

function TierBadge({ tier, small = false }: TierBadgeProps) {
  const s = TIER_STYLE[tier];
  return (
    <span style={{
      display:       'inline-flex',
      alignItems:    'center',
      padding:       small ? '1px 6px' : '2px 8px',
      borderRadius:  999,
      fontSize:      small ? 10 : 11,
      fontWeight:    600,
      letterSpacing: '0.04em',
      color:         s.color,
      background:    s.bg,
      border:        `1px solid ${s.color}33`,
      whiteSpace:    'nowrap',
    }}>
      {TIER_LABEL[tier]}
    </span>
  );
}

interface ScoreGaugeProps {
  score: number;
  tier:  TierKey;
}

function ScoreGauge({ score, tier }: ScoreGaugeProps) {
  const color  = TIER_STYLE[tier].color;
  const offset = dashOffset(score);

  return (
    <div style={{ position: 'relative', width: 88, height: 88 }}>
      <svg width={88} height={88} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={44} cy={44} r={34}
          fill="none"
          stroke="rgba(0,0,0,0.08)"
          strokeWidth={7}
        />
        <circle
          cx={44} cy={44} r={34}
          fill="none"
          stroke={color}
          strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray={`${CIRCUMFERENCE}`}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.16,1,0.3,1)' }}
        />
      </svg>
      <div style={{
        position:   'absolute',
        inset:       0,
        display:    'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap:         0,
      }}>
        <span style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>
          {score.toFixed(1)}
        </span>
        <span style={{ fontSize: 10, color: '#8fa3b5', letterSpacing: '0.04em' }}>/ 10</span>
      </div>
    </div>
  );
}

// ─── Drawer ───────────────────────────────────────────────────────────────────

interface DrawerProps {
  item:     CalificacionItem | null;
  onClose:  () => void;
  onRescan: (item: CalificacionItem) => void;
  onSearch: (item: CalificacionItem) => void;
}

function DetailDrawer({ item, onClose, onRescan, onSearch }: DrawerProps) {
  const visible = item !== null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position:   'fixed',
          inset:       0,
          background: 'rgba(0,0,0,0.25)',
          zIndex:      40,
          opacity:     visible ? 1 : 0,
          pointerEvents: visible ? 'auto' : 'none',
          transition: 'opacity 0.2s ease',
        }}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={item ? `Detalle: ${item.empresa_nombre}` : 'Detalle empresa'}
        style={{
          position:   'fixed',
          top:         0,
          right:       0,
          bottom:      0,
          width:       460,
          maxWidth:   '95vw',
          background: 'var(--background, #fff)',
          borderLeft: '1px solid var(--border, #e5e7eb)',
          zIndex:      50,
          display:    'flex',
          flexDirection: 'column',
          transform:  visible ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.28s cubic-bezier(0.16,1,0.3,1)',
          boxShadow:  '-8px 0 32px rgba(0,0,0,0.10)',
        }}
      >
        {item && (
          <>
            {/* Header */}
            <div style={{
              padding:        '20px 20px 16px',
              borderBottom:  '1px solid var(--border, #e5e7eb)',
              display:       'flex',
              alignItems:    'flex-start',
              gap:            12,
              background:    AGENT_TINT,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 17, fontWeight: 700, marginBottom: 4, lineHeight: 1.2 }}>
                  {item.empresa_nombre}
                </p>
                <p style={{ fontSize: 12, color: '#8fa3b5', marginBottom: 6 }}>
                  {item.pais} · {item.linea_negocio}
                </p>
                <TierBadge tier={item.tier_calculado} />
              </div>
              <button
                onClick={onClose}
                aria-label="Cerrar panel"
                style={{
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  width:           32,
                  height:          32,
                  borderRadius:    8,
                  border:         '1px solid var(--border, #e5e7eb)',
                  background:     'var(--background, #fff)',
                  cursor:         'pointer',
                  flexShrink:      0,
                  color:          '#8fa3b5',
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Scrollable body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

              {/* Score gauge */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
                <ScoreGauge score={item.score_total} tier={item.tier_calculado} />
              </div>

              {/* Dimension bars */}
              <div style={{ marginBottom: 24 }}>
                <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#8fa3b5', marginBottom: 12 }}>
                  Dimensiones
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {DIM_CONFIG.map(({ key, label }) => {
                    const val = item[key] as number;
                    return (
                      <div key={key}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                          <span style={{ color: 'var(--foreground, #111)' }}>{label}</span>
                          <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: dimBarColor(val) }}>
                            {val.toFixed(1)}
                          </span>
                        </div>
                        <div style={{ height: 5, borderRadius: 999, background: 'rgba(0,0,0,0.07)', overflow: 'hidden' }}>
                          <div style={{
                            height:           '100%',
                            borderRadius:      999,
                            width:             scoreBarWidth(val),
                            background:        dimBarColor(val),
                            transition:       'width 0.6s cubic-bezier(0.16,1,0.3,1)',
                          }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Stats cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 8 }}>
                <div style={{
                  padding:      '12px 16px',
                  borderRadius:  10,
                  border:       '1px solid var(--border, #e5e7eb)',
                  textAlign:    'center',
                }}>
                  <p style={{ fontSize: 24, fontWeight: 700, color: AGENT_COLOR, lineHeight: 1 }}>
                    {item.senales_count ?? 0}
                  </p>
                  <p style={{ fontSize: 11, color: '#8fa3b5', marginTop: 4 }}>Señales</p>
                </div>
                <div style={{
                  padding:      '12px 16px',
                  borderRadius:  10,
                  border:       '1px solid var(--border, #e5e7eb)',
                  textAlign:    'center',
                }}>
                  <p style={{ fontSize: 24, fontWeight: 700, color: '#1f5d8d', lineHeight: 1 }}>
                    {item.contactos_count ?? 0}
                  </p>
                  <p style={{ fontSize: 11, color: '#8fa3b5', marginTop: 4 }}>Contactos</p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{
              padding:       '16px 20px',
              borderTop:    '1px solid var(--border, #e5e7eb)',
              display:      'flex',
              gap:           10,
            }}>
              <button
                onClick={() => onRescan(item)}
                style={{
                  flex:           1,
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  gap:             6,
                  height:          38,
                  borderRadius:    8,
                  border:         '1px solid var(--border, #e5e7eb)',
                  background:     'transparent',
                  cursor:         'pointer',
                  fontSize:        13,
                  fontWeight:      500,
                  color:          'var(--foreground, #111)',
                }}
              >
                <RefreshCw size={14} />
                Re-escanear
              </button>
              <button
                onClick={() => onSearch(item)}
                style={{
                  flex:           1,
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  gap:             6,
                  height:          38,
                  borderRadius:    8,
                  border:         'none',
                  background:     '#0e7f7f',
                  cursor:         'pointer',
                  fontSize:        13,
                  fontWeight:      600,
                  color:          '#fff',
                }}
              >
                <Users size={14} />
                Buscar contactos
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CalHistorico() {
  const [items, setItems]           = useState<CalificacionItem[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [search, setSearch]         = useState('');
  const [tierFilter, setTierFilter] = useState<TierKey | null>(null);
  const [sortField, setSortField]   = useState<SortField>('created_at');
  const [sortDir, setSortDir]       = useState<SortDir>('desc');
  const [selected, setSelected]     = useState<CalificacionItem | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/calificaciones?limit=200');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { data?: unknown[]; items?: unknown[] } | unknown[];
      const raw: unknown[] = Array.isArray(json)
        ? json
        : (json as { data?: unknown[]; items?: unknown[] }).data
          ?? (json as { items?: unknown[] }).items
          ?? [];

      const parsed: CalificacionItem[] = raw.map((r: unknown) => {
        const row = r as Record<string, unknown>;
        return {
          id:                Number(row['id'] ?? 0),
          empresa_nombre:    String(row['empresa_nombre'] ?? row['empresa'] ?? ''),
          pais:              String(row['pais'] ?? ''),
          linea_negocio:     String(row['linea_negocio'] ?? ''),
          tier_calculado:    toTierKey(String(row['tier_calculado'] ?? row['tier'] ?? 'C')),
          score_total:       Number(row['score_total'] ?? 0),
          score_impacto:     Number(row['score_impacto'] ?? 0),
          score_multiplanta: Number(row['score_multiplanta'] ?? 0),
          score_recurrencia: Number(row['score_recurrencia'] ?? 0),
          score_referente:   Number(row['score_referente'] ?? 0),
          score_acceso_al_decisor:  Number(row['score_acceso_al_decisor'] ?? 0),
          score_anio:               Number(row['score_anio'] ?? 0),
          score_ticket:             row['score_ticket'] != null ? Number(row['score_ticket']) : null,
          score_prioridad:          Number(row['score_prioridad'] ?? 0),
          score_cuenta_estrategica: Number(row['score_cuenta_estrategica'] ?? 0),
          created_at:        String(row['created_at'] ?? new Date().toISOString()),
          senales_count:     row['senales_count'] != null ? Number(row['senales_count']) : undefined,
          contactos_count:   row['contactos_count'] != null ? Number(row['contactos_count']) : undefined,
        };
      });
      setItems(parsed);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar historial');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  // Tier counts
  const tierCounts = useMemo(() => {
    const counts: Record<TierKey, number> = { A: 0, B: 0, C: 0, D: 0 };
    for (const item of items) counts[item.tier_calculado]++;
    return counts;
  }, [items]);

  // Filtered + sorted
  const visible = useMemo(() => {
    let list = items;
    if (tierFilter) list = list.filter(i => i.tier_calculado === tierFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(i =>
        i.empresa_nombre.toLowerCase().includes(q) ||
        i.pais.toLowerCase().includes(q) ||
        i.linea_negocio.toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'empresa_nombre') {
        cmp = a.empresa_nombre.localeCompare(b.empresa_nombre);
      } else if (sortField === 'score_total') {
        cmp = a.score_total - b.score_total;
      } else {
        cmp = a.created_at.localeCompare(b.created_at);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [items, tierFilter, search, sortField, sortDir]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  }

  function handleRescan(item: CalificacionItem) {
    setSelected(null);
    // Navigate to empresa tab pre-filled — best effort
    const params = new URLSearchParams(window.location.search);
    params.set('tab', 'empresa');
    window.history.replaceState(null, '', `?${params.toString()}`);
  }

  function handleSearch(item: CalificacionItem) {
    setSelected(null);
    const params = new URLSearchParams(window.location.search);
    params.set('tab', 'empresa');
    window.history.replaceState(null, '', `?${params.toString()}`);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const summaryCards: Array<{ tier: TierKey }> = [
    { tier: 'A' as const }, { tier: 'B' as const }, { tier: 'C' as const }, { tier: 'D' as const },
  ];

  return (
    <div style={{ position: 'relative' }}>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {summaryCards.map(({ tier }) => {
          const s       = TIER_STYLE[tier];
          const count   = tierCounts[tier];
          const active  = tierFilter === tier;
          return (
            <button
              key={tier}
              onClick={() => setTierFilter(active ? null : tier)}
              aria-pressed={active}
              style={{
                padding:       '14px 16px',
                borderRadius:   10,
                border:        `1.5px solid ${active ? s.color : 'var(--border, #e5e7eb)'}`,
                background:    active ? s.bg : 'var(--background, #fff)',
                cursor:        'pointer',
                textAlign:     'left',
                transition:    'border-color 0.15s, background 0.15s',
              }}
            >
              <p style={{ fontSize: 24, fontWeight: 700, color: s.color, lineHeight: 1, marginBottom: 4, fontVariantNumeric: 'tabular-nums' }}>
                {count}
              </p>
              <p style={{ fontSize: 11, fontWeight: 600, color: s.color, letterSpacing: '0.05em' }}>
                {TIER_LABEL[tier]}
              </p>
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search
            size={14}
            style={{
              position:  'absolute',
              left:       10,
              top:       '50%',
              transform: 'translateY(-50%)',
              color:     '#8fa3b5',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            placeholder="Buscar empresa, país o línea…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width:        '100%',
              height:        36,
              paddingLeft:   32,
              paddingRight:  12,
              borderRadius:   8,
              border:        '1px solid var(--border, #e5e7eb)',
              background:    'var(--background, #fff)',
              fontSize:       13,
              color:         'var(--foreground, #111)',
              outline:       'none',
              boxSizing:     'border-box',
            }}
          />
        </div>
        <button
          onClick={() => exportCsv(visible)}
          disabled={visible.length === 0}
          style={{
            display:        'flex',
            alignItems:     'center',
            gap:             6,
            height:          36,
            paddingInline:   12,
            borderRadius:    8,
            border:         '1px solid var(--border, #e5e7eb)',
            background:     'var(--background, #fff)',
            cursor:          visible.length === 0 ? 'not-allowed' : 'pointer',
            fontSize:        13,
            fontWeight:      500,
            color:          visible.length === 0 ? '#8fa3b5' : 'var(--foreground, #111)',
            opacity:         visible.length === 0 ? 0.5 : 1,
            whiteSpace:     'nowrap',
          }}
        >
          <Download size={14} />
          Exportar
        </button>
      </div>

      {/* States */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#8fa3b5', fontSize: 13 }}>
          Cargando historial…
        </div>
      )}

      {error && !loading && (
        <div style={{
          padding:       '14px 16px',
          borderRadius:   8,
          border:        '1px solid rgba(139,26,60,0.30)',
          background:    'rgba(139,26,60,0.06)',
          color:         '#8b1a3c',
          fontSize:       13,
          marginBottom:   12,
        }}>
          {error}
        </div>
      )}

      {!loading && !error && visible.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#8fa3b5', fontSize: 13 }}>
          {items.length === 0 ? 'No hay empresas calificadas aún.' : 'No hay resultados para este filtro.'}
        </div>
      )}

      {/* Table */}
      {!loading && visible.length > 0 && (
        <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--border, #e5e7eb)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--muted, #f5f5f5)' }}>
                {(
                  [
                    { label: 'Empresa', field: 'empresa_nombre' as SortField },
                    { label: 'País',    field: null },
                    { label: 'Línea',   field: null },
                    { label: 'Tier',    field: null },
                    { label: 'Score',   field: 'score_total' as SortField },
                    { label: 'Señales', field: null },
                    { label: 'Contactos', field: null },
                    { label: '',        field: null },
                  ] as Array<{ label: string; field: SortField | null }>
                ).map(({ label, field }, i) => (
                  <th
                    key={i}
                    onClick={() => field && toggleSort(field)}
                    style={{
                      padding:       '9px 14px',
                      textAlign:     'left',
                      fontWeight:     600,
                      fontSize:       11,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color:         '#8fa3b5',
                      cursor:        field ? 'pointer' : 'default',
                      userSelect:    'none',
                      whiteSpace:    'nowrap',
                      borderBottom:  '1px solid var(--border, #e5e7eb)',
                    }}
                  >
                    {label}
                    {field && sortField === field && (
                      <span style={{ marginLeft: 4, fontSize: 10 }}>{sortDir === 'asc' ? '▲' : '▼'}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((item, idx) => {
                const ts = TIER_STYLE[item.tier_calculado];
                return (
                  <tr
                    key={item.id}
                    onClick={() => setSelected(item)}
                    style={{
                      cursor:     'pointer',
                      background: idx % 2 === 0 ? 'var(--background, #fff)' : 'var(--muted, #f9f9f9)',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = AGENT_TINT)}
                    onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? 'var(--background, #fff)' : 'var(--muted, #f9f9f9)')}
                  >
                    {/* Empresa */}
                    <td style={{ padding: '10px 14px', fontWeight: 600, maxWidth: 200 }}>
                      <span style={{
                        display:     'block',
                        overflow:    'hidden',
                        textOverflow:'ellipsis',
                        whiteSpace:  'nowrap',
                      }}>
                        {item.empresa_nombre}
                      </span>
                    </td>

                    {/* País */}
                    <td style={{ padding: '10px 14px', color: '#8fa3b5', whiteSpace: 'nowrap' }}>
                      {item.pais}
                    </td>

                    {/* Línea */}
                    <td style={{ padding: '10px 14px', color: '#8fa3b5', whiteSpace: 'nowrap', maxWidth: 140 }}>
                      <span style={{
                        display:     'block',
                        overflow:    'hidden',
                        textOverflow:'ellipsis',
                        whiteSpace:  'nowrap',
                      }}>
                        {item.linea_negocio}
                      </span>
                    </td>

                    {/* Tier badge */}
                    <td style={{ padding: '10px 14px' }}>
                      <TierBadge tier={item.tier_calculado} small />
                    </td>

                    {/* Score */}
                    <td style={{ padding: '10px 14px', minWidth: 110 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          flex:         1,
                          height:        5,
                          borderRadius:  999,
                          background:   'rgba(0,0,0,0.07)',
                          overflow:     'hidden',
                        }}>
                          <div style={{
                            height:      '100%',
                            borderRadius: 999,
                            width:        scoreBarWidth(item.score_total),
                            background:   ts.color,
                          }} />
                        </div>
                        <span style={{
                          fontVariantNumeric: 'tabular-nums',
                          fontWeight:          600,
                          fontSize:            12,
                          color:               ts.color,
                          minWidth:            28,
                          textAlign:          'right',
                        }}>
                          {item.score_total.toFixed(1)}
                        </span>
                      </div>
                    </td>

                    {/* Señales */}
                    <td style={{ padding: '10px 14px', textAlign: 'center', color: '#8fa3b5' }}>
                      {item.senales_count ?? '—'}
                    </td>

                    {/* Contactos */}
                    <td style={{ padding: '10px 14px', textAlign: 'center', color: '#8fa3b5' }}>
                      {item.contactos_count ?? '—'}
                    </td>

                    {/* Chevron */}
                    <td style={{ padding: '10px 10px 10px 0', textAlign: 'right' }}>
                      <ChevronRight size={14} style={{ color: '#8fa3b5' }} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Row count */}
      {!loading && visible.length > 0 && (
        <p style={{ marginTop: 10, fontSize: 11, color: '#8fa3b5', textAlign: 'right' }}>
          {visible.length} empresa{visible.length !== 1 ? 's' : ''}{tierFilter || search ? ' (filtrado)' : ''}
        </p>
      )}

      {/* Detail drawer */}
      <DetailDrawer
        item={selected}
        onClose={() => setSelected(null)}
        onRescan={handleRescan}
        onSearch={handleSearch}
      />
    </div>
  );
}
