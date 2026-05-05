'use client';

import { useState, useEffect } from 'react';
import { Database, Search, CheckCircle, Clock, AlertCircle, Send } from 'lucide-react';
import { getMainLineas } from '@/lib/comercial/lineas-config';

const LINEA_COLORS: Record<string, string> = {
  'BHS':            '#0ea5e9',
  'Cartón':         '#10b981',
  'Intralogística': '#f59e0b',
};

const AGENT_COLOR = 'var(--agent-contactos)';
const TOKENS_TOTAL = 2540;

const MINI_BTN: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--surface)', color: 'var(--foreground)',
  fontSize: 16, fontWeight: 600,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer',
};

interface Company  { id: number; name: string; country: string; }
interface JobTitle { id: number; titulo: string; nivel?: string; }
interface Contact  {
  id:            number;
  nombre:        string;
  cargo:         string;
  email:         string;
  telefono:      string;
  linkedinUrl:   string;
  empresaNombre: string;
  lineaNegocio:  string;
  hubspotStatus: 'sincronizado' | 'pendiente' | 'error' | null;
}

const MAIN_LINEAS = getMainLineas();

export function ContactosPanel() {
  const [linea, setLinea]                       = useState('BHS');
  const [modo, setModo]                         = useState<'lote' | 'manual'>('lote');
  const [batch, setBatch]                       = useState(8);
  const [contactosPorEmpresa, setContactosPorEmpresa] = useState(3);
  const [selectedEmpresas, setSelectedEmpresas] = useState<Set<number>>(new Set());
  const [selectedTitles, setSelectedTitles]     = useState<string[]>([]);
  const [statusFilter, setStatusFilter]         = useState('ALL');
  const [searching, setSearching]               = useState(false);

  const [companies, setCompanies]   = useState<Company[]>([]);
  const [jobTitles, setJobTitles]   = useState<JobTitle[]>([]);
  const [contacts, setContacts]     = useState<Contact[]>([]);
  const [loadingCo, setLoadingCo]   = useState(false);
  const [loadingCtx, setLoadingCtx] = useState(false);

  const accentColor   = LINEA_COLORS[linea] ?? AGENT_COLOR;
  const empresasCount = modo === 'lote' ? batch : selectedEmpresas.size;
  const tokensUsed    = empresasCount * contactosPorEmpresa;
  const tokensPct     = Math.min(100, (tokensUsed / TOKENS_TOTAL) * 100);

  useEffect(() => {
    setLoadingCo(true);
    setSelectedEmpresas(new Set());
    fetch(`/api/comercial/companies?linea=${encodeURIComponent(linea)}&limit=50`)
      .then(r => r.json())
      .then(d => setCompanies(Array.isArray(d) ? d : []))
      .catch(() => setCompanies([]))
      .finally(() => setLoadingCo(false));
  }, [linea]);

  useEffect(() => {
    fetch('/api/catalogos/job-titles')
      .then(r => r.json())
      .then(d => setJobTitles(Array.isArray(d) ? d : []))
      .catch(() => setJobTitles([]));
  }, []);

  useEffect(() => {
    setLoadingCtx(true);
    const p = new URLSearchParams({ linea, limit: '100' });
    if (statusFilter !== 'ALL') p.set('hubspot_status', statusFilter);
    fetch(`/api/contacts?${p}`)
      .then(r => r.json())
      .then(d => setContacts(Array.isArray(d) ? d : []))
      .catch(() => setContacts([]))
      .finally(() => setLoadingCtx(false));
  }, [linea, statusFilter]);

  const sincCount = contacts.filter(c => c.hubspotStatus === 'sincronizado').length;
  const pendCount = contacts.filter(c => c.hubspotStatus === 'pendiente').length;
  const errCount  = contacts.filter(c => c.hubspotStatus === 'error').length;

  async function handleProspectar() {
    setSearching(true);
    try {
      await fetch('/api/prospect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          linea,
          batchSize: empresasCount,
          contactosPorEmpresa,
          modo,
          jobTitles: selectedTitles,
          empresas: modo === 'manual'
            ? companies
                .filter(c => selectedEmpresas.has(c.id))
                .map(c => ({ empresa: c.name, pais: c.country }))
            : undefined,
        }),
      });
      const p = new URLSearchParams({ linea, limit: '100' });
      if (statusFilter !== 'ALL') p.set('hubspot_status', statusFilter);
      const res = await fetch(`/api/contacts?${p}`);
      const data = await res.json().catch(() => []);
      setContacts(Array.isArray(data) ? data : []);
    } finally {
      setSearching(false);
    }
  }

  function toggleEmpresa(id: number) {
    setSelectedEmpresas(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  function toggleTitle(titulo: string) {
    setSelectedTitles(prev =>
      prev.includes(titulo) ? prev.filter(t => t !== titulo) : [...prev, titulo]
    );
  }

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Two-column config */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14, marginBottom: 18 }}>
        {/* Left — CONFIGURACIÓN */}
        <div className="panel" style={{ padding: 18 }}>
          <p className="kicker" style={{ marginBottom: 10 }}>CONFIGURACIÓN</p>

          <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600 }}>Línea</p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            {MAIN_LINEAS.map(l => {
              const color  = LINEA_COLORS[l.key] ?? AGENT_COLOR;
              const active = linea === l.key;
              return (
                <button
                  key={l.key}
                  onClick={() => setLinea(l.key)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7,
                    padding: '6px 12px', borderRadius: 9,
                    border:      active ? `1.5px solid ${color}` : '1px solid var(--border)',
                    background:  active ? `${color}14` : 'var(--surface)',
                    color:       active ? color : 'var(--muted-fg)',
                    fontSize: 12.5, fontWeight: active ? 600 : 500, cursor: 'pointer',
                  }}
                >
                  {l.label}
                </button>
              );
            })}
          </div>

          {/* Mode toggle */}
          <div style={{
            display: 'inline-flex', padding: 3, borderRadius: 9,
            background: 'var(--surface-muted)', border: '1px solid var(--border)',
            marginBottom: 14,
          }}>
            {([
              { k: 'lote'   as const, l: 'Lote automático',  Icon: Database },
              { k: 'manual' as const, l: 'Selección manual',  Icon: Search   },
            ]).map(({ k, l, Icon }) => {
              const active = modo === k;
              return (
                <button
                  key={k}
                  onClick={() => setModo(k)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '6px 12px', borderRadius: 7,
                    background: active ? accentColor : 'transparent',
                    color:      active ? '#fff' : 'var(--muted-fg)',
                    border: 'none', fontSize: 12, fontWeight: active ? 600 : 500, cursor: 'pointer',
                  }}
                >
                  <Icon size={12} />{l}
                </button>
              );
            })}
          </div>

          {/* Lote content */}
          {modo === 'lote' && (
            <div style={{ padding: 14, borderRadius: 11, background: 'var(--surface-muted)' }}>
              <p style={{ margin: '0 0 12px', fontSize: 12.5 }}>
                Toma las <strong>{batch} empresas</strong> con mayor prioridad en línea{' '}
                <strong style={{ color: accentColor }}>{linea}</strong> y extrae contactos vía Apollo.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button onClick={() => setBatch(b => Math.max(1, b - 1))} style={MINI_BTN}>−</button>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, width: 36, textAlign: 'center' }}>{batch}</span>
                <button onClick={() => setBatch(b => Math.min(50, b + 1))} style={MINI_BTN}>+</button>
                <span style={{ fontSize: 11, color: 'var(--muted-fg)' }}>empresas · máx. 50</span>
              </div>
            </div>
          )}

          {/* Manual content */}
          {modo === 'manual' && (
            <div>
              <p style={{ margin: '0 0 6px', fontSize: 12, color: 'var(--muted-fg)' }}>
                {selectedEmpresas.size} empresa{selectedEmpresas.size !== 1 ? 's' : ''} seleccionada{selectedEmpresas.size !== 1 ? 's' : ''}
              </p>
              <div style={{
                maxHeight: 180, overflowY: 'auto', borderRadius: 10,
                border: '1px solid var(--border)', background: 'var(--surface)', marginBottom: 12,
              }}>
                {loadingCo ? (
                  <p style={{ padding: 16, textAlign: 'center', fontSize: 12, color: 'var(--muted-fg)' }}>Cargando…</p>
                ) : companies.map(c => {
                  const checked = selectedEmpresas.has(c.id);
                  return (
                    <label key={c.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                      borderBottom: '1px solid var(--border)', cursor: 'pointer',
                      background: checked ? `${accentColor}0d` : 'transparent',
                    }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleEmpresa(c.id)}
                        style={{ accentColor }}
                      />
                      <span style={{ fontSize: 12.5, fontWeight: 500, flex: 1 }}>{c.name}</span>
                      <span style={{ fontSize: 11, color: 'var(--muted-fg)' }}>{c.country}</span>
                    </label>
                  );
                })}
              </div>

              {jobTitles.length > 0 && (
                <div>
                  <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 600 }}>Cargos a buscar</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {jobTitles.slice(0, 24).map(jt => {
                      const active = selectedTitles.includes(jt.titulo);
                      return (
                        <button
                          key={jt.id}
                          onClick={() => toggleTitle(jt.titulo)}
                          style={{
                            padding: '4px 10px', borderRadius: 7, fontSize: 11.5,
                            border:     active ? `1.5px solid ${accentColor}` : '1px solid var(--border)',
                            background: active ? `${accentColor}14` : 'var(--surface)',
                            color:      active ? accentColor : 'var(--muted-fg)',
                            fontWeight: active ? 600 : 400, cursor: 'pointer',
                          }}
                        >
                          {jt.titulo}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right — PARÁMETROS */}
        <div className="panel" style={{ padding: 18, display: 'flex', flexDirection: 'column' }}>
          <p className="kicker" style={{ marginBottom: 10 }}>PARÁMETROS</p>

          <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600 }}>Contactos por empresa</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <button onClick={() => setContactosPorEmpresa(c => Math.max(1, c - 1))} style={MINI_BTN}>−</button>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, width: 32, textAlign: 'center' }}>
              {contactosPorEmpresa}
            </span>
            <button onClick={() => setContactosPorEmpresa(c => Math.min(5, c + 1))} style={MINI_BTN}>+</button>
            <span style={{ fontSize: 11, color: 'var(--muted-fg)' }}>máx. 5</span>
          </div>

          <div style={{ padding: 12, background: 'var(--surface-muted)', borderRadius: 10, marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <span className="kicker">TOKENS APOLLO</span>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700,
                color: tokensPct < 80 ? 'var(--success)' : 'var(--warning)',
              }}>
                {tokensUsed} / {TOKENS_TOTAL.toLocaleString()}
              </span>
            </div>
            <div style={{ height: 5, background: 'var(--surface)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                width: `${tokensPct}%`, height: '100%',
                background: tokensPct < 80 ? 'var(--success)' : 'var(--warning)',
                borderRadius: 3, transition: 'width .2s ease',
              }} />
            </div>
            <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--muted-fg)' }}>
              {empresasCount} empresa{empresasCount !== 1 ? 's' : ''} × {contactosPorEmpresa} contacto{contactosPorEmpresa !== 1 ? 's' : ''}
            </p>
          </div>

          <button
            onClick={handleProspectar}
            disabled={searching || empresasCount === 0}
            style={{
              marginTop: 'auto', padding: '12px 16px', borderRadius: 11,
              background: accentColor, color: '#fff', border: 'none',
              fontWeight: 600, fontSize: 14, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: `0 6px 18px ${accentColor}40`,
              opacity: (searching || empresasCount === 0) ? 0.55 : 1,
            }}
          >
            <Search size={16} />
            {searching ? 'Prospectando…' : 'Prospectar contactos'}
          </button>
        </div>
      </div>

      {/* Contacts table */}
      <div className="panel" style={{ overflow: 'hidden' }}>
        <div style={{
          padding: '14px 18px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid var(--border)',
        }}>
          <div>
            <h3 style={{ fontSize: 14 }}>Contactos prospectados</h3>
            <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--muted-fg)' }}>
              {contacts.length} contactos · {sincCount} sincronizados · {pendCount} pendientes · {errCount} con error
            </p>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { k: 'ALL',           l: 'Todos'         },
              { k: 'sincronizado',  l: 'Sincronizados' },
              { k: 'pendiente',     l: 'Pendientes'    },
              { k: 'error',         l: 'Errores'       },
            ].map(({ k, l }) => {
              const active = statusFilter === k;
              return (
                <button
                  key={k}
                  onClick={() => setStatusFilter(k)}
                  style={{
                    padding: '5px 11px', borderRadius: 7,
                    border:     active ? `1.5px solid ${AGENT_COLOR}` : '1px solid var(--border)',
                    background: active ? 'var(--agent-contactos-tint)' : 'var(--surface)',
                    color:      active ? AGENT_COLOR : 'var(--muted-fg)',
                    fontSize: 11.5, fontWeight: active ? 600 : 500, cursor: 'pointer',
                  }}
                >{l}</button>
              );
            })}
            <button style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '5px 12px', borderRadius: 7, fontSize: 12,
              border: '1px solid var(--border)', background: 'var(--surface)',
              color: 'var(--muted-fg)', cursor: 'pointer',
            }}>
              <Send size={12} /> Sync HubSpot
            </button>
          </div>
        </div>

        {loadingCtx ? (
          <p style={{ padding: 32, textAlign: 'center', color: 'var(--muted-fg)', fontSize: 12 }}>
            Cargando contactos…
          </p>
        ) : contacts.length === 0 ? (
          <p style={{ padding: 32, textAlign: 'center', color: 'var(--muted-fg)', fontSize: 12 }}>
            {statusFilter !== 'ALL'
              ? 'Sin contactos con este filtro.'
              : 'Aún no hay contactos para esta línea. Ejecuta una prospección.'}
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface-muted)' }}>
                {['Contacto', 'Empresa · Línea', 'Email', 'Teléfono', 'HubSpot'].map((h, i) => (
                  <th key={i} style={{
                    padding: '9px 14px', textAlign: 'left',
                    fontSize: 10.5, fontWeight: 700,
                    letterSpacing: '0.12em', textTransform: 'uppercase',
                    color: 'var(--muted-fg)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {contacts.map(c => {
                const initials   = c.nombre.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
                const lineaColor = LINEA_COLORS[c.lineaNegocio] ?? AGENT_COLOR;
                return (
                  <tr key={c.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '11px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 30, height: 30, borderRadius: '50%',
                          background: 'var(--agent-contactos-tint)',
                          color: 'var(--agent-contactos)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 700, flexShrink: 0,
                        }}>{initials || '?'}</div>
                        <div>
                          <p style={{ margin: 0, fontWeight: 600 }}>
                            {c.nombre}
                            {c.linkedinUrl && (
                              <span style={{
                                marginLeft: 6, fontSize: 9, padding: '1px 5px', borderRadius: 4,
                                background: '#0a66c224', color: '#0a66c2', fontWeight: 700,
                              }}>in</span>
                            )}
                          </p>
                          <p style={{ margin: 0, fontSize: 11, color: 'var(--muted-fg)' }}>{c.cargo}</p>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <p style={{ margin: 0, fontWeight: 500 }}>{c.empresaNombre}</p>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        marginTop: 2, fontSize: 10.5, color: lineaColor, fontWeight: 600,
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: lineaColor }} />
                        {c.lineaNegocio}
                      </span>
                    </td>
                    <td style={{
                      padding: '11px 14px', fontSize: 12,
                      fontFamily: 'var(--font-mono)',
                      color: !c.email ? 'var(--muted-fg)' : 'inherit',
                    }}>{c.email || '—'}</td>
                    <td style={{
                      padding: '11px 14px', fontSize: 12,
                      fontFamily: 'var(--font-mono)',
                      color: !c.telefono ? 'var(--muted-fg)' : 'inherit',
                    }}>{c.telefono || '—'}</td>
                    <td style={{ padding: '11px 14px' }}>
                      <HubspotBadge status={c.hubspotStatus} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function HubspotBadge({ status }: { status: string | null }) {
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
    border: '1px solid transparent',
  };
  if (status === 'sincronizado') return (
    <span style={{ ...base, background: 'rgba(25,129,106,0.10)', color: 'var(--success)', borderColor: 'rgba(25,129,106,0.25)' }}>
      <CheckCircle size={11} /> Sincronizado
    </span>
  );
  if (status === 'pendiente') return (
    <span style={{ ...base, background: 'rgba(154,109,29,0.10)', color: '#9a6b1d', borderColor: 'rgba(154,109,29,0.25)' }}>
      <Clock size={11} /> Pendiente
    </span>
  );
  if (status === 'error') return (
    <span style={{ ...base, background: 'rgba(148,25,65,0.08)', color: 'var(--danger)', borderColor: 'rgba(148,25,65,0.22)' }}>
      <AlertCircle size={11} /> Error
    </span>
  );
  return <span style={{ fontSize: 11, color: 'var(--muted-fg)' }}>—</span>;
}
