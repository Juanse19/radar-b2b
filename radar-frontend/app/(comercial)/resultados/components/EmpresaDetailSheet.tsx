'use client';

import { useState } from 'react';
import {
  ExternalLink,
  Activity,
  Radio,
  Star,
  Users,
  History,
  Sparkles,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { TierBadge } from './TierBadge';
import { FeedbackButtons } from './FeedbackButtons';
import { EmpresaTimeline } from './EmpresaTimeline';
import type { EmpresaRollup } from '@/lib/comercial/types';

// ─── Agent accent colors ──────────────────────────────────────────────────────
const RADAR_COLOR      = '#71acd2';
const CALIFICADOR_COLOR = '#b9842a';
const CONTACTOS_COLOR  = '#19816a';
const HUBSPOT_COLOR    = '#ff7a59';

// ─── Line accent colors ───────────────────────────────────────────────────────
function lineaColor(linea: string | null): string {
  if (!linea) return '#142e47';
  const l = linea.toLowerCase();
  if (l.includes('bhs') || l.includes('aeropuerto') || l.includes('cargo')) return '#0ea5e9';
  if (l.includes('cart') || l.includes('papel') || l.includes('corrugado')) return '#10b981';
  if (l.includes('intral') || l.includes('cedi') || l.includes('wms')) return '#f59e0b';
  return '#142e47';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('es-CO', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function initials(name: string): string {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface DotCardProps {
  color: string;
  label: string;
  value: React.ReactNode;
  hint: string;
}

function DotCard({ color, label, value, hint }: DotCardProps) {
  return (
    <div style={{
      padding: '10px 12px',
      borderRadius: 9,
      background: 'var(--muted)',
      border: '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <p style={{
          margin: 0, fontSize: 10, fontWeight: 700,
          letterSpacing: '0.08em', color: 'var(--muted-foreground)',
          textTransform: 'uppercase',
        }}>{label}</p>
      </div>
      <p style={{
        margin: 0, fontSize: 18, fontWeight: 700, color,
        fontFamily: 'var(--font-mono, monospace)',
      }}>{value}</p>
      <p style={{ margin: 0, fontSize: 10, color: 'var(--muted-foreground)' }}>{hint}</p>
    </div>
  );
}

interface RowProps {
  label: string;
  value: React.ReactNode;
  accent?: string;
}

function Row({ label, value, accent }: RowProps) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      gap: 12, padding: '6px 0',
      borderBottom: '1px solid color-mix(in srgb, var(--border) 40%, transparent)',
    }}>
      <span style={{ fontSize: 12, color: 'var(--muted-foreground)', flexShrink: 0 }}>{label}</span>
      <span style={{
        fontSize: 12, textAlign: 'right', fontWeight: 500,
        color: accent ?? 'var(--foreground)',
      }}>
        {value ?? '—'}
      </span>
    </div>
  );
}

function EmptyState({ icon: Icon, msg }: { icon: React.ElementType; msg: string }) {
  return (
    <div style={{ padding: '40px 20px', textAlign: 'center' }}>
      <Icon size={28} style={{ color: 'var(--muted-foreground)', opacity: 0.4, margin: '0 auto' }} />
      <p style={{ margin: '12px 0 0', fontSize: 13, color: 'var(--muted-foreground)' }}>{msg}</p>
    </div>
  );
}

// ─── Tab type ─────────────────────────────────────────────────────────────────
type TabKey = 'resumen' | 'radar' | 'calificador' | 'contactos' | 'historial';

interface TabDef {
  k: TabKey;
  l: string;
  icon: React.ElementType;
  color: string;
}

const TABS: TabDef[] = [
  { k: 'resumen',     l: 'Resumen',     icon: Activity, color: 'var(--primary)' },
  { k: 'radar',       l: 'Radar',       icon: Radio,    color: RADAR_COLOR },
  { k: 'calificador', l: 'Calificador', icon: Star,     color: CALIFICADOR_COLOR },
  { k: 'contactos',   l: 'Contactos',   icon: Users,    color: CONTACTOS_COLOR },
  { k: 'historial',   l: 'Historial',   icon: History,  color: 'var(--muted-foreground)' },
];

// ─── Tab: Resumen ─────────────────────────────────────────────────────────────
function TabResumen({ empresa }: { empresa: EmpresaRollup }) {
  const hasRadar = empresa.radar_activo === 'Sí';
  const califScore = empresa.calif_score ?? null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p style={{
        margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: '0.14em',
        color: 'var(--muted-foreground)', textTransform: 'uppercase',
      }}>
        RESUMEN INTEGRADO · 3 AGENTES
      </p>

      {/* Agent mini-cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {/* Radar */}
        <div style={{
          padding: 14, borderRadius: 11,
          background: `linear-gradient(135deg, ${RADAR_COLOR}10, transparent)`,
          border: `1px solid ${RADAR_COLOR}26`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{
              width: 24, height: 24, borderRadius: 6,
              background: `${RADAR_COLOR}26`, color: RADAR_COLOR,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Radio size={12} />
            </div>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: RADAR_COLOR, letterSpacing: '0.06em' }}>
              RADAR
            </p>
          </div>
          <p style={{
            margin: 0, fontSize: 22, fontWeight: 700,
            fontFamily: 'var(--font-mono, monospace)',
          }}>
            {hasRadar ? '1' : '0'}
          </p>
          <p style={{ margin: 0, fontSize: 11, color: 'var(--muted-foreground)' }}>
            {hasRadar ? 'señal activa' : 'sin actividad'}
          </p>
          <p style={{ margin: '6px 0 0', fontSize: 10, color: 'var(--muted-foreground)' }}>
            {formatDate(empresa.radar_at)}
          </p>
        </div>

        {/* Calificador */}
        <div style={{
          padding: 14, borderRadius: 11,
          background: `linear-gradient(135deg, ${CALIFICADOR_COLOR}10, transparent)`,
          border: `1px solid ${CALIFICADOR_COLOR}26`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{
              width: 24, height: 24, borderRadius: 6,
              background: `${CALIFICADOR_COLOR}26`, color: CALIFICADOR_COLOR,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Star size={12} />
            </div>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: CALIFICADOR_COLOR, letterSpacing: '0.06em' }}>
              CALIFICADOR
            </p>
          </div>
          <p style={{
            margin: 0, fontSize: 22, fontWeight: 700,
            fontFamily: 'var(--font-mono, monospace)',
          }}>
            {califScore !== null ? `${califScore}` : '—'}
          </p>
          <p style={{ margin: 0, fontSize: 11, color: 'var(--muted-foreground)' }}>
            {califScore !== null ? `${empresa.calif_tier ?? 'calificado'}` : 'pendiente'}
          </p>
          <p style={{ margin: '6px 0 0', fontSize: 10, color: 'var(--muted-foreground)' }}>
            {formatDate(empresa.calif_at)}
          </p>
        </div>

        {/* Contactos */}
        <div style={{
          padding: 14, borderRadius: 11,
          background: `linear-gradient(135deg, ${CONTACTOS_COLOR}10, transparent)`,
          border: `1px solid ${CONTACTOS_COLOR}26`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{
              width: 24, height: 24, borderRadius: 6,
              background: `${CONTACTOS_COLOR}26`, color: CONTACTOS_COLOR,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Users size={12} />
            </div>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: CONTACTOS_COLOR, letterSpacing: '0.06em' }}>
              CONTACTOS
            </p>
          </div>
          <p style={{
            margin: 0, fontSize: 22, fontWeight: 700,
            fontFamily: 'var(--font-mono, monospace)',
          }}>
            {empresa.contactos_total}
          </p>
          <p style={{ margin: 0, fontSize: 11, color: 'var(--muted-foreground)' }}>
            en base de datos
          </p>
          <p style={{ margin: '6px 0 0', fontSize: 10, color: 'var(--muted-foreground)' }}>
            {formatDate(empresa.ultima_prospeccion_at)}
          </p>
        </div>
      </div>

      {/* Señal reciente */}
      {hasRadar && (
        <div style={{
          padding: 14, borderRadius: 11,
          background: 'var(--card)',
          border: '1px solid var(--border)',
        }}>
          <p style={{
            margin: '0 0 10px', fontSize: 10, fontWeight: 700,
            letterSpacing: '0.12em', color: RADAR_COLOR, textTransform: 'uppercase',
          }}>
            SEÑAL RECIENTE
          </p>
          <div style={{ padding: '8px 0', borderTop: '1px solid var(--border)' }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'baseline', marginBottom: 2,
            }}>
              <p style={{ margin: 0, fontSize: 12.5, fontWeight: 500 }}>
                {empresa.tipo_senal ?? 'Señal detectada'}
              </p>
              <span style={{
                fontSize: 10, color: 'var(--muted-foreground)',
                fontFamily: 'var(--font-mono, monospace)',
              }}>
                {formatDate(empresa.radar_at)}
              </span>
            </div>
            {empresa.fuente_nombre && (
              <p style={{ margin: 0, fontSize: 11, color: 'var(--muted-foreground)' }}>
                {empresa.fuente_nombre}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Contactos lógica */}
      <div style={{
        padding: 14, borderRadius: 11,
        background: 'var(--card)',
        border: '1px solid var(--border)',
      }}>
        <p style={{
          margin: '0 0 10px', fontSize: 10, fontWeight: 700,
          letterSpacing: '0.12em', color: CONTACTOS_COLOR, textTransform: 'uppercase',
        }}>
          CONTACTOS · LÓGICA DE INCORPORACIÓN
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <DotCard
            color="var(--muted-foreground)"
            label="Existentes"
            value={empresa.contactos_total}
            hint="Ya en BD · no se duplican"
          />
          <DotCard
            color={CONTACTOS_COLOR}
            label="Nuevos"
            value={0}
            hint="Detectados y agregados"
          />
          <DotCard
            color={HUBSPOT_COLOR}
            label="HubSpot"
            value="—"
            hint="Pendiente sync"
          />
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Radar ───────────────────────────────────────────────────────────────
function TabRadar({ empresa }: { empresa: EmpresaRollup }) {
  const [expanded, setExpanded] = useState(false);
  const hasRadar = empresa.radar_activo === 'Sí';
  const descripcion = empresa.descripcion_resumen?.trim() ?? '';
  const isOro = empresa.tier_actual === 'A';

  return (
    <div>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 14,
      }}>
        <p style={{
          margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: '0.14em',
          color: RADAR_COLOR, textTransform: 'uppercase',
        }}>
          WF02 · RADAR B2B · {formatDate(empresa.radar_at)}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
        <DotCard
          color={RADAR_COLOR}
          label="Señales"
          value={hasRadar ? 1 : 0}
          hint="últimos 30 días"
        />
        <DotCard
          color="#d9a035"
          label="ORO"
          value={isOro ? 1 : 0}
          hint="alta confianza"
        />
        <DotCard
          color="#1f5d8d"
          label="MONITOREO"
          value={!isOro && hasRadar ? 1 : 0}
          hint="seguimiento"
        />
      </div>

      {hasRadar ? (
        <div style={{
          padding: 12, borderRadius: 11,
          background: 'var(--card)', border: '1px solid var(--border)',
          display: 'flex', gap: 10,
        }}>
          <div style={{
            width: 4, alignSelf: 'stretch',
            background: isOro ? '#d9a035' : '#1f5d8d',
            borderRadius: 2, flexShrink: 0,
          }} />
          <div style={{ flex: 1 }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'baseline', marginBottom: 6,
            }}>
              <span style={{
                padding: '2px 7px', borderRadius: 4,
                background: isOro ? 'rgba(217,160,53,0.16)' : 'rgba(31,93,141,0.12)',
                color: isOro ? '#d9a035' : '#1f5d8d',
                fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
              }}>
                {isOro ? 'ORO' : 'MONITOREO'}
              </span>
              <span style={{
                fontSize: 10, color: 'var(--muted-foreground)',
                fontFamily: 'var(--font-mono, monospace)',
              }}>
                {formatDate(empresa.radar_at)}
              </span>
            </div>

            {empresa.tipo_senal && (
              <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 500 }}>
                {empresa.tipo_senal}
              </p>
            )}

            {descripcion && (
              <div>
                <p style={{ margin: 0, fontSize: 11.5, color: 'var(--muted-foreground)', lineHeight: 1.55 }}>
                  {!expanded && descripcion.length > 240
                    ? `${descripcion.slice(0, 240)}…`
                    : descripcion}
                </p>
                {descripcion.length > 240 && (
                  <button
                    type="button"
                    onClick={() => setExpanded(e => !e)}
                    style={{
                      marginTop: 4, fontSize: 11, color: RADAR_COLOR,
                      background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                    }}
                  >
                    {expanded ? 'Ver menos' : 'Ver más'}
                  </button>
                )}
              </div>
            )}

            <div style={{ marginTop: 10 }}>
              <Row label="Monto"        value={empresa.monto_inversion}  accent="#d9a035" />
              <Row label="Ventana"      value={empresa.ventana_compra} />
              <Row label="Verificación" value={empresa.fuente_verificada} />
              {empresa.fuente_nombre && (
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                  gap: 12, padding: '6px 0',
                }}>
                  <span style={{ fontSize: 12, color: 'var(--muted-foreground)', flexShrink: 0 }}>Fuente</span>
                  {empresa.fuente_link && empresa.fuente_link !== 'No disponible' ? (
                    <a
                      href={empresa.fuente_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        fontSize: 12, color: RADAR_COLOR, textAlign: 'right',
                        textDecoration: 'none', maxWidth: 220, overflow: 'hidden',
                        textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}
                      aria-label={`Abrir fuente: ${empresa.fuente_nombre}`}
                    >
                      <ExternalLink size={10} />
                      {empresa.fuente_nombre}
                    </a>
                  ) : (
                    <span style={{ fontSize: 12, textAlign: 'right' }}>{empresa.fuente_nombre}</span>
                  )}
                </div>
              )}
            </div>

            {empresa.session_id && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                <FeedbackButtons resultadoId={empresa.session_id} />
              </div>
            )}
          </div>
        </div>
      ) : (
        <EmptyState icon={Radio} msg="Sin señales detectadas en este escaneo" />
      )}
    </div>
  );
}

// ─── Tab: Calificador ─────────────────────────────────────────────────────────
function TabCalificador({ empresa }: { empresa: EmpresaRollup }) {
  const score = empresa.calif_score;
  const tier  = empresa.calif_tier;

  if (score === null && !tier) {
    return <EmptyState icon={Star} msg="Empresa aún no calificada · ejecuta WF01 para evaluar" />;
  }

  const tierColor = CALIFICADOR_COLOR;
  // conic-gradient expects degrees out of 360; score is 0-10
  const deg = score !== null ? (score / 10) * 360 : 0;

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <p style={{
          margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: '0.14em',
          color: CALIFICADOR_COLOR, textTransform: 'uppercase',
        }}>
          WF01 · CALIFICADOR · {formatDate(empresa.calif_at)}
        </p>
      </div>

      {/* Score circle + tier */}
      <div style={{
        padding: 18, borderRadius: 11, marginBottom: 14,
        background: 'var(--card)', border: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          {/* Conic-gradient circle — no SVG */}
          <div style={{
            width: 90, height: 90, borderRadius: '50%', flexShrink: 0,
            background: `conic-gradient(${tierColor} ${deg}deg, var(--muted) 0)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              width: 70, height: 70, borderRadius: '50%',
              background: 'var(--card)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{
                fontSize: 22, fontWeight: 700, color: tierColor,
                fontFamily: 'var(--font-mono, monospace)',
              }}>
                {score ?? '—'}
              </span>
              <span style={{ fontSize: 9, color: 'var(--muted-foreground)', letterSpacing: '0.1em' }}>
                / 10
              </span>
            </div>
          </div>

          <div style={{ flex: 1 }}>
            <p style={{
              margin: 0, fontSize: 11, fontWeight: 700,
              letterSpacing: '0.1em', color: 'var(--muted-foreground)',
            }}>
              TIER ASIGNADO
            </p>
            <p style={{
              margin: '2px 0 6px', fontSize: 26, fontWeight: 700, color: tierColor,
            }}>
              {tier ?? '—'}
            </p>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.5 }}>
              {tier === 'ORO'
                ? 'Empresa de alto valor estratégico. Priorizar en outreach.'
                : tier === 'MONITOREO'
                ? 'Buen prospecto. Mantener seguimiento activo.'
                : tier === 'ARCHIVO'
                ? 'Bajo encaje actual. Re-evaluar trimestralmente.'
                : 'Score calculado por el Agente Calificador.'}
            </p>
          </div>
        </div>
      </div>

      {/* Dimension bars placeholder */}
      <div style={{ padding: 14, borderRadius: 11, background: 'var(--card)', border: '1px solid var(--border)' }}>
        <p style={{
          margin: '0 0 12px', fontSize: 10, fontWeight: 700,
          letterSpacing: '0.1em', color: 'var(--muted-foreground)', textTransform: 'uppercase',
        }}>
          EVALUACIÓN POR DIMENSIÓN
        </p>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--muted-foreground)', fontStyle: 'italic' }}>
          Detalle de dimensiones no disponible en la vista de empresa consolidada.
          Consulta el informe individual de calificación para ver los 7 factores ponderados.
        </p>
        <div style={{ marginTop: 12 }}>
          <Row label="Score global"      value={score !== null ? `${score}/10` : '—'} accent={CALIFICADOR_COLOR} />
          <Row label="Tier"              value={tier} />
          <Row label="Fecha evaluación"  value={formatDate(empresa.calif_at)} />
          <Row label="Scans totales"     value={empresa.scans_total} />
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Contactos ───────────────────────────────────────────────────────────
function TabContactos({ empresa }: { empresa: EmpresaRollup }) {
  const total = empresa.contactos_total;

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <p style={{
          margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: '0.14em',
          color: CONTACTOS_COLOR, textTransform: 'uppercase',
        }}>
          WF03 · CONTACTOS · {formatDate(empresa.ultima_prospeccion_at)}
        </p>
      </div>

      {/* Anti-duplication banner */}
      <div style={{
        padding: 14, borderRadius: 11, marginBottom: 14,
        background: `linear-gradient(135deg, ${CONTACTOS_COLOR}10, transparent)`,
        border: `1px solid ${CONTACTOS_COLOR}26`,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <Sparkles size={14} style={{ color: CONTACTOS_COLOR, marginTop: 2, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: CONTACTOS_COLOR }}>
              Lógica de incorporación
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.5 }}>
              Antes de generar contactos, el agente valida los existentes en HubSpot.
              {' '}<strong>Los duplicados no se vuelven a crear; solo se incorporan los nuevos.</strong>
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 12 }}>
          <DotCard
            color="var(--muted-foreground)"
            label="Total"
            value={total}
            hint="contactos en BD"
          />
          <DotCard
            color="var(--muted-foreground)"
            label="Existentes"
            value={total}
            hint="omitidos · ya en HubSpot"
          />
          <DotCard
            color={CONTACTOS_COLOR}
            label="Nuevos"
            value={0}
            hint="incorporados a HubSpot"
          />
        </div>
      </div>

      {/* Contact list */}
      {total > 0 ? (
        <div style={{ borderRadius: 11, background: 'var(--card)', border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px' }}>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--muted-foreground)' }}>
              {total} contacto{total !== 1 ? 's' : ''} registrado{total !== 1 ? 's' : ''} en base de datos.
              Ejecuta WF03 para ver la lista detallada.
            </p>
          </div>
        </div>
      ) : (
        <EmptyState icon={Users} msg="Sin contactos · ejecuta WF03 para buscar decisores" />
      )}
    </div>
  );
}

// ─── Tab: Historial ───────────────────────────────────────────────────────────
function TabHistorial({ empresa }: { empresa: EmpresaRollup }) {
  return (
    <div>
      <p style={{
        margin: '0 0 14px', fontSize: 10, fontWeight: 700, letterSpacing: '0.14em',
        color: 'var(--muted-foreground)', textTransform: 'uppercase',
      }}>
        HISTORIAL DE EJECUCIONES · 3 AGENTES
      </p>

      <EmpresaTimeline empresaId={empresa.empresa_id} />

      {/* Audit trail from rollup timestamps */}
      <div style={{ marginTop: 16 }}>
        <p style={{
          margin: '0 0 10px', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
          color: 'var(--muted-foreground)', textTransform: 'uppercase',
        }}>
          MARCAS DE TIEMPO
        </p>
        <div style={{
          borderRadius: 11, background: 'var(--card)',
          border: '1px solid var(--border)', overflow: 'hidden',
        }}>
          {empresa.radar_at && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px', borderBottom: '1px solid var(--border)',
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                background: `${RADAR_COLOR}20`, color: RADAR_COLOR,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Radio size={12} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>Radar escaneado</p>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--muted-foreground)' }}>
                  {empresa.tipo_senal ?? 'Señal detectada'}
                </p>
              </div>
              <span style={{ fontSize: 11, color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono, monospace)' }}>
                {formatDate(empresa.radar_at)}
              </span>
            </div>
          )}

          {empresa.calif_at && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px', borderBottom: empresa.ultima_prospeccion_at ? '1px solid var(--border)' : 'none',
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                background: `${CALIFICADOR_COLOR}20`, color: CALIFICADOR_COLOR,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Star size={12} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>Calificación ejecutada</p>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--muted-foreground)' }}>
                  {empresa.calif_tier ?? '—'}{empresa.calif_score !== null ? ` · ${empresa.calif_score}/10` : ''}
                </p>
              </div>
              <span style={{ fontSize: 11, color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono, monospace)' }}>
                {formatDate(empresa.calif_at)}
              </span>
            </div>
          )}

          {empresa.ultima_prospeccion_at && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px',
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                background: `${CONTACTOS_COLOR}20`, color: CONTACTOS_COLOR,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Users size={12} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>Prospección ejecutada</p>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--muted-foreground)' }}>
                  {empresa.contactos_total} contacto{empresa.contactos_total !== 1 ? 's' : ''} encontrado{empresa.contactos_total !== 1 ? 's' : ''}
                </p>
              </div>
              <span style={{ fontSize: 11, color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono, monospace)' }}>
                {formatDate(empresa.ultima_prospeccion_at)}
              </span>
            </div>
          )}

          {!empresa.radar_at && !empresa.calif_at && !empresa.ultima_prospeccion_at && (
            <div style={{ padding: '12px 14px' }}>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--muted-foreground)', fontStyle: 'italic' }}>
                Sin marcas de tiempo disponibles
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface EmpresaDetailSheetProps {
  empresa: EmpresaRollup | null;
  onClose: () => void;
}

export function EmpresaDetailSheet({ empresa, onClose }: EmpresaDetailSheetProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('resumen');

  if (!empresa) return null;

  const accent = lineaColor(empresa.linea_negocio);
  const avatarInitials = initials(empresa.empresa_evaluada);
  const hasRadar = empresa.radar_activo === 'Sí';

  return (
    <Sheet open={!!empresa} onOpenChange={open => { if (!open) onClose(); }}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-lg overflow-hidden"
        aria-label={`Detalle de ${empresa.empresa_evaluada}`}
      >
        {/* ── Header ── */}
        <SheetHeader
          className="border-b border-border px-5 pt-5 pb-0"
          style={{ background: `linear-gradient(135deg, ${accent}10, transparent)` }}
        >
          {/* Top row: avatar + name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12, flexShrink: 0,
              background: `${accent}20`, color: accent,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 700,
            }}>
              {avatarInitials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <SheetTitle
                className="truncate text-base leading-snug"
                style={{ margin: 0 }}
              >
                {empresa.empresa_evaluada}
              </SheetTitle>
              <p style={{
                margin: '2px 0 0', fontSize: 12,
                color: 'var(--muted-foreground)',
                fontFamily: 'var(--font-mono, monospace)',
              }}>
                {empresa.pais ?? '—'}
              </p>
            </div>
          </div>

          {/* Chips row */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {empresa.linea_negocio && (
              <span style={{
                padding: '3px 9px', borderRadius: 6,
                background: `${accent}1a`, color: accent,
                fontSize: 11, fontWeight: 600,
              }}>
                {empresa.linea_negocio}
              </span>
            )}
            {hasRadar && (
              <span style={{
                padding: '3px 9px', borderRadius: 6,
                background: `${RADAR_COLOR}14`, color: RADAR_COLOR,
                fontSize: 11, fontWeight: 600,
              }}>
                Señal activa
              </span>
            )}
            <span style={{ marginLeft: 'auto' }}>
              <TierBadge tier={empresa.tier_actual} size="sm" />
            </span>
            {empresa.calif_score !== null && (
              <span style={{
                padding: '3px 9px', borderRadius: 6,
                background: 'rgba(217,160,53,0.14)', color: CALIFICADOR_COLOR,
                fontSize: 11, fontWeight: 700,
              }}>
                {empresa.calif_score}/10
              </span>
            )}
          </div>

          {/* Tab strip */}
          <div style={{
            display: 'flex', gap: 0,
            marginLeft: -20, marginRight: -20, paddingLeft: 20,
            borderTop: '1px solid var(--border)',
          }}>
            {TABS.map(tab => {
              const active = activeTab === tab.k;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.k}
                  type="button"
                  onClick={() => setActiveTab(tab.k)}
                  aria-selected={active}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '10px 12px',
                    background: 'transparent', border: 'none',
                    borderBottom: active ? `2px solid ${tab.color}` : '2px solid transparent',
                    color: active ? tab.color : 'var(--muted-foreground)',
                    fontSize: 12, fontWeight: active ? 600 : 500,
                    cursor: 'pointer', transition: 'color 0.15s, border-color 0.15s',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Icon size={12} /> {tab.l}
                </button>
              );
            })}
          </div>
        </SheetHeader>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto" style={{ padding: '20px 20px' }}>
          {activeTab === 'resumen'     && <TabResumen     empresa={empresa} />}
          {activeTab === 'radar'       && <TabRadar       empresa={empresa} />}
          {activeTab === 'calificador' && <TabCalificador empresa={empresa} />}
          {activeTab === 'contactos'   && <TabContactos   empresa={empresa} />}
          {activeTab === 'historial'   && <TabHistorial   empresa={empresa} />}
        </div>

        {/* ── Footer ── */}
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', gap: 8,
          background: 'var(--card)',
        }}>
          <button
            type="button"
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border border-border',
              'px-3 py-1.5 text-xs font-medium text-muted-foreground',
              'hover:bg-muted hover:text-foreground transition-colors',
            )}
          >
            <ExternalLink size={12} /> Ver en HubSpot
          </button>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md border border-border',
                'px-3 py-1.5 text-xs font-medium text-muted-foreground',
                'hover:bg-muted hover:text-foreground transition-colors',
              )}
            >
              <Radio size={12} /> Re-escanear
            </button>
            <button
              type="button"
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md',
                'px-3 py-1.5 text-xs font-medium',
                'bg-primary text-primary-foreground hover:bg-primary/90 transition-colors',
              )}
            >
              <Sparkles size={12} /> 3 Agentes
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
