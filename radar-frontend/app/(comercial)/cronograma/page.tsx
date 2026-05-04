'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CalendarClock, Settings2, PlayCircle, PauseCircle,
  Loader2, CheckCircle2, Clock, Calendar, List,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import type { ScheduleConfig, DiaSemana, LineaSchedule } from '@/lib/types';
import { cn } from '@/lib/utils';

// ── Constants ─────────────────────────────────────────────────────────────────

const DIAS: DiaSemana[] = [
  'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo',
];

const DIAS_ABBR: Record<DiaSemana, string> = {
  Lunes: 'LUN', Martes: 'MAR', Miércoles: 'MIÉ',
  Jueves: 'JUE', Viernes: 'VIE', Sábado: 'SÁB', Domingo: 'DOM',
};

const LINEA_OPTIONS: { value: LineaSchedule; label: string }[] = [
  { value: 'BHS',             label: 'BHS' },
  { value: 'Cartón',          label: 'Cartón' },
  { value: 'Intralogística',  label: 'Intralogística' },
  { value: 'Final de Línea',  label: 'Final de Línea' },
  { value: 'Motos',           label: 'Motos' },
  { value: 'Todas',           label: 'Todas las líneas' },
  { value: 'ALL_TIER_A',      label: 'Tier A (todas)' },
  { value: 'Descanso',        label: 'Descanso' },
];

// CSS-variable-safe accent colors per linea
const LINEA_ACCENT: Record<string, { color: string; bg: string; border: string }> = {
  BHS:              { color: 'var(--agent-radar)',       bg: 'var(--agent-radar-tint)',       border: 'color-mix(in srgb, var(--agent-radar) 40%, transparent)' },
  'Cartón':         { color: 'var(--agent-calificador)', bg: 'var(--agent-calificador-tint)', border: 'color-mix(in srgb, var(--agent-calificador) 40%, transparent)' },
  'Intralogística': { color: 'var(--agent-contactos)',   bg: 'var(--agent-contactos-tint)',   border: 'color-mix(in srgb, var(--agent-contactos) 40%, transparent)' },
  'Final de Línea': { color: '#8b5cf6',                  bg: '#f5f3ff',                       border: '#c4b5fd' },
  'Motos':          { color: '#f97316',                  bg: '#fff7ed',                       border: '#fdba74' },
  Todas:            { color: '#6366f1',                  bg: '#eef2ff',                       border: '#a5b4fc' },
  ALL_TIER_A:       { color: '#a855f7',                  bg: '#faf5ff',                       border: '#d8b4fe' },
  Descanso:         { color: 'var(--muted-foreground)',  bg: 'var(--muted)',                  border: 'var(--border)' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getNextDays(rotacion: Partial<Record<DiaSemana, LineaSchedule>>, hora: string, count = 14) {
  const result: Array<{ date: Date; dia: DiaSemana; linea: LineaSchedule }> = [];
  const now = new Date();
  // JS day index (0=Sun) → DiaSemana index (0=Lunes)
  const jsToIdx: Record<number, number> = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 0: 6 };
  for (let i = 0; i < 30 && result.length < count; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    // Skip if today past the scheduled hour
    if (i === 0) {
      const [h, m] = hora.split(':').map(Number);
      const scheduled = new Date(d);
      scheduled.setHours(h ?? 7, m ?? 0, 0, 0);
      if (now > scheduled) continue;
    }
    const diaIdx = jsToIdx[d.getDay()] ?? 0;
    const dia = DIAS[diaIdx]!;
    const linea = rotacion[dia] ?? 'Descanso';
    if (linea !== 'Descanso') {
      result.push({ date: d, dia, linea });
    }
  }
  return result;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });
}

function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

// ── Day card ─────────────────────────────────────────────────────────────────

function DayCard({ dia, linea, hora, isToday }: {
  dia: DiaSemana;
  linea: LineaSchedule;
  hora: string;
  isToday: boolean;
}) {
  const accent = LINEA_ACCENT[linea] ?? LINEA_ACCENT['Descanso']!;
  const isRest = linea === 'Descanso';

  return (
    <div
      className={cn(
        'flex flex-col rounded-xl border p-3 transition-all',
        isRest ? 'border-border/50 bg-muted/20' : 'border',
        isToday && !isRest && 'ring-2',
      )}
      style={!isRest ? {
        borderColor: accent.border,
        background: accent.bg,
        ...(isToday ? { '--tw-ring-color': accent.color } as React.CSSProperties : {}),
      } : undefined}
    >
      <div className="mb-2 flex items-center justify-between">
        <span
          className={cn(
            'text-[10px] font-bold tracking-widest',
            isRest ? 'text-muted-foreground/50' : '',
          )}
          style={!isRest ? { color: accent.color } : undefined}
        >
          {DIAS_ABBR[dia]}
        </span>
        {isToday && (
          <span
            className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold text-white"
            style={{ background: accent.color }}
          >
            HOY
          </span>
        )}
      </div>

      <p
        className={cn('text-sm font-semibold leading-tight', isRest ? 'text-muted-foreground/40' : '')}
        style={!isRest ? { color: accent.color } : undefined}
      >
        {isRest ? '—' : linea}
      </p>

      {!isRest && (
        <div className="mt-2 flex items-center gap-1">
          <Clock size={10} style={{ color: accent.color }} />
          <span className="text-[10px]" style={{ color: accent.color }}>{hora}</span>
        </div>
      )}
    </div>
  );
}

// ── Mes cell ─────────────────────────────────────────────────────────────────

function MesCell({ date, linea }: { date: Date; linea: LineaSchedule | null }) {
  const accent = linea ? (LINEA_ACCENT[linea] ?? LINEA_ACCENT['Descanso']!) : null;
  const isToday = date.toDateString() === new Date().toDateString();

  return (
    <div
      className={cn(
        'relative min-h-[52px] rounded-lg border p-1.5 text-xs transition-all',
        isToday ? 'border-primary/50 bg-primary/5' : 'border-border/40 bg-muted/10',
      )}
    >
      <span className={cn('font-medium', isToday ? 'text-primary' : 'text-muted-foreground')}>
        {date.getDate()}
      </span>
      {linea && linea !== 'Descanso' && accent && (
        <div
          className="mt-1 rounded px-1 py-0.5 text-[9px] font-semibold leading-tight"
          style={{ background: accent.bg, color: accent.color, border: `1px solid ${accent.border}` }}
        >
          {linea === 'ALL_TIER_A' ? 'Tier A' : linea === 'Todas' ? 'Todas' : linea}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type ViewType = 'semana' | 'mes' | 'lista';

export default function CronogramaPage() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<ViewType>('semana');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draft, setDraft] = useState<ScheduleConfig | null>(null);

  const { data: config, isLoading } = useQuery<ScheduleConfig>({
    queryKey: ['schedule'],
    queryFn: () => fetch('/api/schedule').then(r => r.json()),
    staleTime: 30_000,
  });

  const saveMutation = useMutation({
    mutationFn: (data: ScheduleConfig) =>
      fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
      toast.success('Programación guardada');
      setDrawerOpen(false);
    },
    onError: () => toast.error('Error al guardar la programación'),
  });

  function openDrawer() {
    if (config) setDraft({ ...config, rotacion: { ...config.rotacion } });
    setDrawerOpen(true);
  }

  // Today's day-of-week index for highlighting
  const todayDia: DiaSemana | null = useMemo(() => {
    const jsToIdx: Record<number, number> = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 0: 6 };
    const idx = jsToIdx[new Date().getDay()];
    return idx !== undefined ? (DIAS[idx] ?? null) : null;
  }, []);

  // Lista view data
  const nextRuns = useMemo(() => {
    if (!config) return [];
    return getNextDays(config.rotacion, config.hora, 14);
  }, [config]);

  // Mes view data
  const now = new Date();
  const [mesYear, setMesYear] = useState(now.getFullYear());
  const [mesMonth, setMesMonth] = useState(now.getMonth());
  const mesLabel = new Date(mesYear, mesMonth, 1)
    .toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });

  const mesDays = useMemo(() => getDaysInMonth(mesYear, mesMonth), [mesYear, mesMonth]);
  const firstDayOffset = useMemo(() => {
    const firstDay = mesDays[0]!.getDay();
    // JS: 0=Sun → adjust to Mon-first
    return firstDay === 0 ? 6 : firstDay - 1;
  }, [mesDays]);

  const jsToIdx: Record<number, number> = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 0: 6 };

  function prevMes() {
    if (mesMonth === 0) { setMesMonth(11); setMesYear(y => y - 1); }
    else setMesMonth(m => m - 1);
  }
  function nextMes() {
    if (mesMonth === 11) { setMesMonth(0); setMesYear(y => y + 1); }
    else setMesMonth(m => m + 1);
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-12 text-muted-foreground text-sm">
        <Loader2 size={18} className="animate-spin" /> Cargando programación...
      </div>
    );
  }

  const rotacion = config?.rotacion ?? {};
  const hora = config?.hora ?? '07:00';
  const activo = config?.activo ?? false;

  return (
    <div className="space-y-6">
      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{ background: 'var(--agent-radar-tint)', color: 'var(--agent-radar)' }}
          >
            <CalendarClock size={18} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--agent-radar)' }}>
              Automatización
            </p>
            <h1 className="text-xl font-semibold leading-tight text-foreground">Cronograma</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Escaneos automáticos por línea · hora configurada:{' '}
              <span className="font-medium text-foreground">{hora}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Status chip */}
          <div
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
              activo
                ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                : 'border-border bg-muted/30 text-muted-foreground',
            )}
          >
            {activo
              ? <><PlayCircle size={12} /> Activo</>
              : <><PauseCircle size={12} /> Inactivo</>
            }
          </div>
          <Button
            onClick={openDrawer}
            size="sm"
            className="gap-1.5"
            style={{ background: 'var(--agent-radar)', color: '#fff' }}
          >
            <Settings2 size={14} />
            Configurar
          </Button>
        </div>
      </div>

      {/* ── View toggle ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/20 p-1 w-fit">
        {([
          { id: 'semana', label: 'Semana', icon: Calendar },
          { id: 'mes',    label: 'Mes',    icon: CalendarClock },
          { id: 'lista',  label: 'Lista',  icon: List },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all',
              view === id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Semana view ────────────────────────────────────────────────────── */}
      {view === 'semana' && (
        <div className="grid grid-cols-7 gap-2">
          {DIAS.map(dia => (
            <DayCard
              key={dia}
              dia={dia}
              linea={rotacion[dia] ?? 'Descanso'}
              hora={hora}
              isToday={dia === todayDia}
            />
          ))}
        </div>
      )}

      {/* ── Mes view ───────────────────────────────────────────────────────── */}
      {view === 'mes' && (
        <div className="space-y-3">
          {/* Month nav */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={prevMes}
              className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              ←
            </button>
            <span className="text-sm font-semibold capitalize text-foreground">{mesLabel}</span>
            <button
              type="button"
              onClick={nextMes}
              className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              →
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1">
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
              <div key={d} className="py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty cells for offset */}
            {Array.from({ length: firstDayOffset }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {mesDays.map(date => {
              const diaIdx = jsToIdx[date.getDay()] ?? 0;
              const dia = DIAS[diaIdx]!;
              const linea = rotacion[dia] ?? 'Descanso';
              return (
                <MesCell
                  key={date.toISOString()}
                  date={date}
                  linea={linea}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* ── Lista view ─────────────────────────────────────────────────────── */}
      {view === 'lista' && (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="grid grid-cols-[1fr_100px_120px_80px] gap-3 border-b border-border bg-muted/40 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Fecha</span>
            <span>Día</span>
            <span>Línea</span>
            <span>Hora</span>
          </div>
          {nextRuns.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No hay escaneos programados próximamente.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {nextRuns.map(({ date, dia, linea }, i) => {
                const accent = LINEA_ACCENT[linea] ?? LINEA_ACCENT['Descanso']!;
                const isToday = date.toDateString() === new Date().toDateString();
                return (
                  <div
                    key={i}
                    className={cn(
                      'grid grid-cols-[1fr_100px_120px_80px] gap-3 items-center px-4 py-3 transition-colors',
                      isToday ? 'bg-muted/20' : 'hover:bg-muted/10',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {isToday && (
                        <span className="rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground">
                          HOY
                        </span>
                      )}
                      <span className="text-sm text-foreground capitalize">{formatDate(date)}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{dia}</span>
                    <span>
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{ background: accent.bg, color: accent.color, border: `1px solid ${accent.border}` }}
                      >
                        <CheckCircle2 size={10} className="mr-1" />
                        {linea}
                      </span>
                    </span>
                    <span className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock size={12} />
                      {hora}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Config drawer ──────────────────────────────────────────────────── */}
      <Sheet open={drawerOpen} onOpenChange={v => { if (!v) setDrawerOpen(false); }}>
        <SheetContent
          className="flex flex-col gap-0 overflow-hidden p-0 sm:max-w-[480px]"
          showCloseButton
        >
          <div className="h-0.5 w-full shrink-0" style={{ background: 'var(--agent-radar)' }} />
          <SheetHeader className="shrink-0 border-b border-border px-5 py-4">
            <SheetTitle>Configurar programación</SheetTitle>
            <p className="text-xs text-muted-foreground">
              Define qué línea escanear cada día y a qué hora.
            </p>
          </SheetHeader>

          {draft && (
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {/* Active toggle */}
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Escaneo automático</p>
                  <p className="text-xs text-muted-foreground">Activa o pausa todos los escaneos</p>
                </div>
                <Switch
                  checked={draft.activo}
                  onCheckedChange={v => setDraft(d => d ? { ...d, activo: v } : d)}
                />
              </div>

              {/* Hour */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Hora de ejecución
                </Label>
                <Input
                  type="time"
                  value={draft.hora}
                  onChange={e => setDraft(d => d ? { ...d, hora: e.target.value } : d)}
                  className="w-36 text-sm"
                />
              </div>

              {/* Weekly rotation */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Rotación semanal
                </Label>
                <div className="space-y-2">
                  {DIAS.map(dia => (
                    <div key={dia} className="flex items-center gap-3">
                      <span className="w-20 text-sm font-medium text-foreground">{dia}</span>
                      <Select
                        value={draft.rotacion[dia] ?? 'Descanso'}
                        onValueChange={v =>
                          setDraft(d =>
                            d ? { ...d, rotacion: { ...d.rotacion, [dia]: v as LineaSchedule } } : d,
                          )
                        }
                      >
                        <SelectTrigger className="flex-1 h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LINEA_OPTIONS.map(o => (
                            <SelectItem key={o.value} value={o.value} className="text-sm">
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Batch size */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Batch size (por defecto)
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={draft.batchSize}
                  onChange={e => setDraft(d => d ? { ...d, batchSize: Number(e.target.value) } : d)}
                  className="w-24 text-sm"
                />
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="shrink-0 border-t border-border px-5 py-3 flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDrawerOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={!draft || saveMutation.isPending}
              onClick={() => { if (draft) saveMutation.mutate(draft); }}
              style={{ background: 'var(--agent-radar)', color: '#fff' }}
            >
              {saveMutation.isPending && <Loader2 size={13} className="mr-1.5 animate-spin" />}
              Guardar
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
