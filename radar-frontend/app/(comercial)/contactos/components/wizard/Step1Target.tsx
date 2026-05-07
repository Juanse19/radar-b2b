'use client';

import { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Plane, Package, Boxes, Layers, Zap, Target, Check } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ProspectorWizardState } from './state';

interface LineaTreeSubLinea {
  codigo:      string;
  nombre:      string;
  id:          number;
  descripcion: string | null;
}

interface LineaTreeLinea {
  codigo:    string;
  nombre:    string;
  color_hex: string | null;
  sublineas: LineaTreeSubLinea[];
}

interface Props {
  state:    ProspectorWizardState;
  onChange: (updates: Partial<ProspectorWizardState>) => void;
}

const ICON_MAP: Record<string, LucideIcon> = {
  bhs:            Plane,
  carton_papel:   Package,
  intralogistica: Boxes,
};

const ACCENT      = 'var(--agent-contactos)';
const ACCENT_TINT = 'var(--agent-contactos-tint)';

export function Step1Target({ state, onChange }: Props) {
  const [tree,    setTree]    = useState<LineaTreeLinea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/prospector/v2/lineas');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!alive) return;
        setTree(json.data ?? []);
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : 'Error cargando líneas');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const lineasSeleccionadas = state.lineas;
  const lineasSet = new Set(lineasSeleccionadas);

  function toggleLinea(codigo: string) {
    const next = lineasSet.has(codigo)
      ? lineasSeleccionadas.filter(c => c !== codigo)
      : [...lineasSeleccionadas, codigo];

    // Filter sub-líneas seleccionadas a solo las que pertenecen a las líneas activas.
    const lineasNext = new Set(next);
    const sublineasValidas = tree
      .filter(l => lineasNext.has(l.codigo))
      .flatMap(l => l.sublineas.map(s => s.codigo));
    const sublineasNext = state.sublineas.filter(s => sublineasValidas.includes(s));

    const sublineaIdsNext = tree
      .flatMap(l => l.sublineas)
      .filter(s => sublineasNext.includes(s.codigo))
      .map(s => s.id);

    onChange({ lineas: next, sublineas: sublineasNext, sublineaIds: sublineaIdsNext });
  }

  function toggleSublinea(sub: LineaTreeSubLinea) {
    const isActive = state.sublineas.includes(sub.codigo);
    const sublineas = isActive
      ? state.sublineas.filter(s => s !== sub.codigo)
      : [...state.sublineas, sub.codigo];

    const sublineaIds = isActive
      ? state.sublineaIds.filter(id => id !== sub.id)
      : [...state.sublineaIds, sub.id];

    onChange({ sublineas, sublineaIds });
  }

  // ── Loading / error ─────────────────────────────────────────────────────────
  if (loading) {
    return <div className="h-48 animate-pulse rounded-lg bg-muted" />;
  }
  if (error) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        Error: {error}
      </div>
    );
  }

  const sublineasDisponibles = tree
    .filter(l => lineasSet.has(l.codigo))
    .flatMap(l => l.sublineas);

  // ── Empty: no línea ─────────────────────────────────────────────────────────
  if (lineasSeleccionadas.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <Label className="mb-3 block">Línea de negocio</Label>
          <p className="mb-4 text-sm text-muted-foreground">
            Selecciona una o varias líneas para continuar.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {tree.map(linea => (
              <LineaCard
                key={linea.codigo}
                linea={linea}
                active={false}
                onClick={() => toggleLinea(linea.codigo)}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── With selection ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div>
        <Label className="mb-2 block">Líneas de negocio</Label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {tree.map(linea => (
            <LineaCard
              key={linea.codigo}
              linea={linea}
              active={lineasSet.has(linea.codigo)}
              onClick={() => toggleLinea(linea.codigo)}
            />
          ))}
        </div>
      </div>

      {sublineasDisponibles.length > 0 && (
        <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Sub-líneas <span className="font-normal">(opcional · multi-select · vacío = todas)</span>
              {state.sublineas.length > 0 && (
                <span className="ml-2 text-foreground">{state.sublineas.length} seleccionada{state.sublineas.length !== 1 ? 's' : ''}</span>
              )}
            </span>
            {state.sublineas.length > 0 && (
              <button
                type="button"
                onClick={() => onChange({ sublineas: [], sublineaIds: [] })}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Limpiar
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {sublineasDisponibles.map(sub => {
              const isActive = state.sublineas.includes(sub.codigo);
              return (
                <button
                  key={sub.codigo}
                  type="button"
                  onClick={() => toggleSublinea(sub)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-xs transition-all duration-150',
                    isActive ? 'font-medium' : 'border-border text-muted-foreground hover:text-foreground',
                  )}
                  style={isActive
                    ? { borderColor: ACCENT, color: ACCENT, background: `color-mix(in srgb, ${ACCENT} 12%, transparent)` }
                    : undefined
                  }
                  title={sub.descripcion ?? undefined}
                >
                  {sub.nombre}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <Label className="mb-2 block">Modo de búsqueda</Label>
        <div className="grid grid-cols-2 gap-2">
          <ModeCard
            mode="auto"
            active={state.modo === 'auto'}
            icon={Zap}
            title="Automático"
            subtitle="N empresas por tier · seleccionadas al azar"
            onClick={() => onChange({ modo: 'auto' })}
          />
          <ModeCard
            mode="manual"
            active={state.modo === 'manual'}
            icon={Target}
            title="Manual"
            subtitle="Tú eliges las empresas"
            onClick={() => onChange({ modo: 'manual' })}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────────────────

interface LineaCardProps {
  linea:   LineaTreeLinea;
  active:  boolean;
  onClick: () => void;
}

function LineaCard({ linea, active, onClick }: LineaCardProps) {
  const Icon = ICON_MAP[linea.codigo] ?? Layers;
  const accent = linea.color_hex ?? ACCENT;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative flex flex-col gap-2 rounded-xl border-2 p-4 text-left transition-all duration-200',
        active ? 'shadow-sm' : 'border-border bg-muted/20 hover:bg-muted/40',
      )}
      style={active
        ? { borderColor: accent, background: `color-mix(in srgb, ${accent} 12%, transparent)` }
        : undefined
      }
    >
      {active && (
        <span
          aria-hidden
          className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full text-white"
          style={{ background: accent }}
        >
          <Check size={12} strokeWidth={3} />
        </span>
      )}
      <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: active ? `color-mix(in srgb, ${accent} 20%, transparent)` : undefined }}>
        <Icon size={18} style={{ color: active ? accent : undefined }} />
      </div>
      <div>
        <p className="text-sm font-semibold leading-tight" style={{ color: active ? accent : undefined }}>
          {linea.nombre}
        </p>
        <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
          {linea.sublineas.length} sub-línea{linea.sublineas.length !== 1 ? 's' : ''}
        </p>
      </div>
    </button>
  );
}

interface ModeCardProps {
  mode:     'auto' | 'manual';
  active:   boolean;
  icon:     LucideIcon;
  title:    string;
  subtitle: string;
  onClick:  () => void;
}

function ModeCard({ active, icon: Icon, title, subtitle, onClick }: ModeCardProps) {
  return (
    <Card
      role="button"
      tabIndex={0}
      aria-pressed={active}
      onClick={onClick}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        'relative cursor-pointer border-2 p-4 text-center transition-all',
        !active && 'border-border hover:bg-muted/40',
      )}
      style={active ? { borderColor: ACCENT, background: ACCENT_TINT } : undefined}
    >
      {active && (
        <span
          aria-hidden
          className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full text-white"
          style={{ background: ACCENT }}
        >
          <Check size={12} strokeWidth={3} />
        </span>
      )}
      <Icon size={24} className="mx-auto mb-1" style={{ color: active ? ACCENT : undefined }} />
      <p className="text-sm font-semibold" style={{ color: active ? ACCENT : undefined }}>
        {title}
      </p>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
    </Card>
  );
}
