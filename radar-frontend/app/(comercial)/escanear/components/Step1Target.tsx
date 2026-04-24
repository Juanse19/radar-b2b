'use client';

import { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Zap, Target, LayoutGrid, Check, Building2, Radio } from 'lucide-react';
import { Card } from '@/components/ui/card';
import type { WizardState } from '@/lib/comercial/wizard-state';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SubLinea {
  id: number;
  codigo: string;
  nombre: string;
  linea: { id: number; codigo: string; nombre: string; color_hex: string | null };
}

interface LineaGroup {
  codigo: string;
  nombre: string;
  color_hex: string | null;
  sublíneas: SubLinea[];
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  state:    WizardState;
  onChange: (updates: Partial<WizardState>) => void;
}

export function Step1Target({ state, onChange }: Props) {
  const [subLineas, setSubLineas] = useState<SubLinea[]>([]);

  useEffect(() => {
    fetch('/api/sub-lineas')
      .then(r => r.json())
      .then((data: SubLinea[]) => setSubLineas(Array.isArray(data) ? data : []))
      .catch(() => { /* keep empty — user can't filter but wizard still shows */ });
  }, []);

  // Group sub-líneas by parent linea
  const groups: LineaGroup[] = subLineas.reduce<LineaGroup[]>((acc, sl) => {
    const existing = acc.find(g => g.codigo === sl.linea.codigo);
    if (existing) {
      existing.sublíneas.push(sl);
    } else {
      acc.push({ codigo: sl.linea.codigo, nombre: sl.linea.nombre, color_hex: sl.linea.color_hex, sublíneas: [sl] });
    }
    return acc;
  }, []);

  const allCodigoss = subLineas.map(s => s.codigo);
  const selectedLines: string[] = state.line ? state.line.split(',').filter(Boolean) : [];
  const allSelected = allCodigoss.length > 0 && allCodigoss.every(c => selectedLines.includes(c));

  function toggleLine(codigo: string) {
    const next = selectedLines.includes(codigo)
      ? selectedLines.filter(x => x !== codigo)
      : [...selectedLines, codigo];
    onChange({ line: next.join(',') });
  }

  function toggleGroup(group: LineaGroup) {
    const groupCodes = group.sublíneas.map(s => s.codigo);
    const allGroupSelected = groupCodes.every(c => selectedLines.includes(c));
    const next = allGroupSelected
      ? selectedLines.filter(c => !groupCodes.includes(c))
      : [...new Set([...selectedLines, ...groupCodes])];
    onChange({ line: next.join(',') });
  }

  function selectAll() { onChange({ line: allCodigoss.join(',') }); }
  function clearAll()   { onChange({ line: '' }); }

  return (
    <div className="space-y-6">

      {/* ── Scan mode ──────────────────────────────────────────────────────── */}
      <div>
        <Label className="mb-2 block">Tipo de escaneo</Label>
        <div className="grid grid-cols-2 gap-2">
          <Card
            role="button"
            tabIndex={0}
            aria-pressed={state.scanMode === 'empresa'}
            onClick={() => onChange({ scanMode: 'empresa' })}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange({ scanMode: 'empresa' }); } }}
            className={cn(
              'relative cursor-pointer border-2 p-4 text-center transition-all',
              state.scanMode === 'empresa'
                ? 'border-primary bg-primary/30 shadow-lg shadow-primary/20 ring-2 ring-primary'
                : 'border-border hover:border-primary/60 hover:bg-muted/40',
            )}
          >
            {state.scanMode === 'empresa' && (
              <span aria-hidden className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check size={12} strokeWidth={3} />
              </span>
            )}
            <Building2 size={22} className={cn('mx-auto mb-1', state.scanMode === 'empresa' ? 'text-primary' : 'text-muted-foreground')} />
            <p className={cn('text-sm font-semibold', state.scanMode === 'empresa' ? 'text-primary' : 'text-foreground')}>Por Empresa</p>
            <p className="text-xs text-muted-foreground mt-0.5">Califica empresas de tu BD</p>
          </Card>

          <Card
            role="button"
            tabIndex={0}
            aria-pressed={state.scanMode === 'senal'}
            onClick={() => onChange({ scanMode: 'senal' })}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange({ scanMode: 'senal' }); } }}
            className={cn(
              'relative cursor-pointer border-2 p-4 text-center transition-all',
              state.scanMode === 'senal'
                ? 'border-primary bg-primary/30 shadow-lg shadow-primary/20 ring-2 ring-primary'
                : 'border-border hover:border-primary/60 hover:bg-muted/40',
            )}
          >
            {state.scanMode === 'senal' && (
              <span aria-hidden className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check size={12} strokeWidth={3} />
              </span>
            )}
            <Radio size={22} className={cn('mx-auto mb-1', state.scanMode === 'senal' ? 'text-primary' : 'text-muted-foreground')} />
            <p className={cn('text-sm font-semibold', state.scanMode === 'senal' ? 'text-primary' : 'text-foreground')}>Por Señal</p>
            <p className="text-xs text-muted-foreground mt-0.5">Detecta señales CAPEX / licitación</p>
          </Card>
        </div>
      </div>

      {/* ── Sub-línea selector ─────────────────────────────────────────────── */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label>Línea de negocio</Label>
          <div className="flex items-center gap-3 text-xs">
            {selectedLines.length > 0 && (
              <span className="text-muted-foreground">
                {selectedLines.length} seleccionada{selectedLines.length !== 1 ? 's' : ''}
              </span>
            )}
            {!allSelected && subLineas.length > 0 && (
              <button type="button" onClick={selectAll} className="flex items-center gap-1 font-medium text-primary hover:underline">
                <LayoutGrid size={12} />
                Todas
              </button>
            )}
            {selectedLines.length > 0 && (
              <button type="button" onClick={clearAll} className="text-muted-foreground hover:text-foreground hover:underline">
                Limpiar
              </button>
            )}
          </div>
        </div>

        {subLineas.length === 0 ? (
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-14 rounded-lg bg-muted/30 border border-border animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map(group => {
              const groupCodes = group.sublíneas.map(s => s.codigo);
              const groupAllSelected = groupCodes.every(c => selectedLines.includes(c));
              const groupSomeSelected = groupCodes.some(c => selectedLines.includes(c));
              return (
                <div key={group.codigo}>
                  {/* Group header */}
                  <button
                    type="button"
                    onClick={() => toggleGroup(group)}
                    className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: group.color_hex ?? '#6b7280' }}
                    />
                    {group.nombre}
                    {groupSomeSelected && (
                      <span className={cn('ml-1 text-[10px] font-normal', groupAllSelected ? 'text-primary' : 'text-muted-foreground')}>
                        ({groupAllSelected ? 'todas' : `${groupCodes.filter(c => selectedLines.includes(c)).length}/${groupCodes.length}`})
                      </span>
                    )}
                  </button>
                  {/* Sub-línea cards */}
                  <div className="grid grid-cols-3 gap-2">
                    {group.sublíneas.map(sl => {
                      const selected = selectedLines.includes(sl.codigo);
                      return (
                        <button
                          key={sl.codigo}
                          type="button"
                          onClick={() => toggleLine(sl.codigo)}
                          aria-pressed={selected}
                          className={cn(
                            'relative rounded-lg border-2 px-3 py-2.5 text-left text-sm transition-all duration-200',
                            selected
                              ? 'border-primary bg-primary/30 font-semibold ring-2 ring-primary shadow-lg shadow-primary/20'
                              : 'border-border bg-muted/30 hover:border-primary/60 hover:bg-muted/50',
                          )}
                        >
                          {selected && (
                            <span aria-hidden className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                              <Check size={10} strokeWidth={3} />
                            </span>
                          )}
                          <span className={cn('block font-medium leading-tight text-[13px]', selected ? 'text-primary' : 'text-foreground')}>
                            {sl.nombre}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {selectedLines.length === 0 && subLineas.length > 0 && (
          <button
            type="button"
            onClick={selectAll}
            className="mt-2 w-full rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground hover:border-primary/40 hover:bg-muted/20 hover:text-foreground transition-all text-center"
          >
            Seleccionar todas las líneas (LATAM completo)
          </button>
        )}
      </div>

      {/* ── Modo de selección ──────────────────────────────────────────────── */}
      <div>
        <Label className="mb-2 block">Modo de selección</Label>
        <div className="grid grid-cols-2 gap-2">
          <Card
            role="button"
            tabIndex={0}
            aria-pressed={state.mode === 'auto'}
            onClick={() => onChange({ mode: 'auto' })}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange({ mode: 'auto' }); } }}
            className={cn(
              'relative cursor-pointer border-2 p-4 text-center transition-all',
              state.mode === 'auto'
                ? 'border-primary bg-primary/30 shadow-lg shadow-primary/20 ring-2 ring-primary'
                : 'border-border hover:border-primary/60 hover:bg-muted/40',
            )}
          >
            {state.mode === 'auto' && (
              <span aria-hidden className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check size={12} strokeWidth={3} />
              </span>
            )}
            <Zap size={24} className="mx-auto mb-1 text-primary" />
            <p className={cn('text-sm font-semibold', state.mode === 'auto' && 'text-primary')}>Automático</p>
            <p className="text-xs text-muted-foreground">Seleccionar N empresas</p>
          </Card>

          <Card
            role="button"
            tabIndex={0}
            aria-pressed={state.mode === 'manual'}
            onClick={() => onChange({ mode: 'manual' })}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange({ mode: 'manual' }); } }}
            className={cn(
              'relative cursor-pointer border-2 p-4 text-center transition-all',
              state.mode === 'manual'
                ? 'border-primary bg-primary/30 shadow-lg shadow-primary/20 ring-2 ring-primary'
                : 'border-border hover:border-primary/60 hover:bg-muted/40',
            )}
          >
            {state.mode === 'manual' && (
              <span aria-hidden className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check size={12} strokeWidth={3} />
              </span>
            )}
            <Target size={24} className={cn('mx-auto mb-1', state.mode === 'manual' ? 'text-primary' : 'text-foreground')} />
            <p className={cn('text-sm font-semibold', state.mode === 'manual' && 'text-primary')}>Manual</p>
            <p className="text-xs text-muted-foreground">Elegir empresas</p>
          </Card>
        </div>
      </div>

    </div>
  );
}
