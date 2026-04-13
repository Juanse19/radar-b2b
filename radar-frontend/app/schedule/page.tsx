'use client';
import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Save, CheckCircle, Loader2, Calendar, Clock,
  PlayCircle, AlertCircle, Plane, Package, Warehouse,
  ClipboardCheck, Radar, Users, Layers,
} from 'lucide-react';
import type { ScheduleConfig, DiaSemana, LineaSchedule } from '@/lib/types';
import { fetchJson, ApiError } from '@/lib/fetcher';
import { AgentPipelineCard } from '@/components/tracker/AgentPipelineCard';
import { useInflightExecutions } from '@/hooks/useInflightExecutions';
import { useLineasActivas } from '@/hooks/useLineasActivas';
import { toast } from 'sonner';
import type { AgentType } from '@/lib/db/types';

// ── Constants ─────────────────────────────────────────────────────────────────

const DIAS: DiaSemana[] = [
  'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo',
];

const DIAS_ABBR: Record<DiaSemana, string> = {
  Lunes: 'Lun', Martes: 'Mar', Miércoles: 'Mié',
  Jueves: 'Jue', Viernes: 'Vie', Sábado: 'Sáb', Domingo: 'Dom',
};

// Static special options always present at the end of the weekly rotation
// selector, regardless of what the DB returns.
const LINEAS_SEMANA_EXTRA: { value: LineaSchedule; label: string }[] = [
  { value: 'Todas',      label: 'Todas las líneas' },
  { value: 'ALL_TIER_A', label: 'Tier A (todas)' },
  { value: 'Descanso',   label: 'Descanso' },
];

const DEFAULT_ROTACION: Partial<Record<DiaSemana, LineaSchedule>> = {
  Lunes:     'BHS',
  Martes:    'Cartón',
  Miércoles: 'Intralogística',
  Jueves:    'BHS',
  Viernes:   'Cartón',
  Sábado:    'Descanso',
  Domingo:   'Descanso',
};

// Line color tokens
const LINEA_STYLE: Record<string, { bg: string; border: string; text: string; dot: string; label: string }> = {
  BHS:              { bg: 'bg-blue-950/60',    border: 'border-blue-700',    text: 'text-blue-300',    dot: 'bg-blue-400',    label: 'BHS' },
  'Cartón':         { bg: 'bg-amber-950/60',   border: 'border-amber-700',   text: 'text-amber-300',   dot: 'bg-amber-400',   label: 'Cartón' },
  'Intralogística': { bg: 'bg-emerald-950/60', border: 'border-emerald-700', text: 'text-emerald-300', dot: 'bg-emerald-400', label: 'Intra' },
  'Final de Línea': { bg: 'bg-violet-950/60',  border: 'border-violet-700',  text: 'text-violet-300',  dot: 'bg-violet-400',  label: 'Final L.' },
  'Motos':          { bg: 'bg-orange-950/60',  border: 'border-orange-700',  text: 'text-orange-300',  dot: 'bg-orange-400',  label: 'Motos' },
  'SOLUMAT':        { bg: 'bg-cyan-950/60',    border: 'border-cyan-700',    text: 'text-cyan-300',    dot: 'bg-cyan-400',    label: 'SOLUMAT' },
  Todas:            { bg: 'bg-indigo-950/60',  border: 'border-indigo-700',  text: 'text-indigo-300',  dot: 'bg-indigo-400',  label: 'Todas' },
  ALL_TIER_A:       { bg: 'bg-purple-950/60',  border: 'border-purple-700',  text: 'text-purple-300',  dot: 'bg-purple-400',  label: 'Tier A' },
  Descanso:         { bg: 'bg-surface-muted/30',    border: 'border-border',    text: 'text-gray-600',    dot: 'bg-gray-600',    label: 'Descanso' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatHora(hora: string): string {
  if (!hora) return '—';
  return hora;
}

function nextRunLabel(hora: string, rotacion: Partial<Record<DiaSemana, LineaSchedule>>): string {
  const now = new Date();
  const todayIndex = now.getDay();
  const jsToIdx: Record<number, number> = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 0: 6 };
  const todayIdx = jsToIdx[todayIndex] ?? 0;

  const parts = hora.split(':').map(Number);
  const h = parts[0] ?? 7;
  const m = parts[1] ?? 0;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const schedMinutes = h * 60 + m;

  for (let offset = 0; offset < 7; offset++) {
    const idx = (todayIdx + offset) % 7;
    const dia = DIAS[idx];
    const linea = rotacion[dia];
    if (!linea || linea === 'Descanso') continue;
    if (offset === 0 && nowMinutes >= schedMinutes) continue;
    const runDate = new Date(now);
    runDate.setDate(runDate.getDate() + offset);
    runDate.setHours(h, m, 0, 0);
    return `${dia} ${runDate.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })} a las ${hora}`;
  }
  return 'Sin días activos';
}

function getTodayIdx(): number {
  const jsToIdx: Record<number, number> = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 0: 6 };
  return jsToIdx[new Date().getDay()] ?? 0;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SchedulePage() {
  const queryClient = useQueryClient();
  const [savedConfig, setSavedConfig]     = useState(false);
  const [savedWeek, setSavedWeek]         = useState(false);
  const [runningNow, setRunningNow]       = useState(false);
  const [runError, setRunError]           = useState<string | null>(null);
  const [runSuccess, setRunSuccess]       = useState(false);
  // Which agent to fire with "Ejecutar ahora"
  const [agentToRun, setAgentToRun]       = useState<AgentType | 'cascade'>('calificador');
  // Execution id returned after firing — shows an inline tracker card.
  const [lastExecId, setLastExecId]       = useState<string | null>(null);
  const { invalidate: invalidateTray }    = useInflightExecutions();

  const { lineas: lineasActivas } = useLineasActivas();

  // Build the select options for the weekly rotation: DB-active lines first,
  // then the fixed special options (Todas, ALL_TIER_A, Descanso).
  const lineasSemana = useMemo<{ value: LineaSchedule; label: string }[]>(() => {
    const dbLines = lineasActivas.map(l => ({
      value: l.nombre as LineaSchedule,
      label: l.nombre,
    }));
    return [...dbLines, ...LINEAS_SEMANA_EXTRA];
  }, [lineasActivas]);

  const { data: schedule, isLoading } = useQuery<ScheduleConfig>({
    queryKey: ['schedule'],
    queryFn: () => fetchJson<ScheduleConfig>('/api/schedule'),
  });

  const [draftConfig, setDraftConfig]     = useState<Partial<ScheduleConfig> | null>(null);
  const [draftRotacion, setDraftRotacion] = useState<Partial<Record<DiaSemana, LineaSchedule>> | null>(null);

  useEffect(() => {
    if (schedule && !draftConfig) {
      setDraftConfig({
        activo:     schedule.activo,
        hora:       schedule.hora,
        batchSizes: { ...schedule.batchSizes },
      });
    }
    if (schedule && !draftRotacion) {
      const rot = schedule.rotacion ?? {};
      const hasSpanish = DIAS.some(d => d in rot);
      if (hasSpanish) {
        setDraftRotacion({ ...DEFAULT_ROTACION, ...rot } as Partial<Record<DiaSemana, LineaSchedule>>);
      } else {
        setDraftRotacion({ ...DEFAULT_ROTACION });
      }
    }
  }, [schedule, draftConfig, draftRotacion]);

  const saveMutation = useMutation({
    mutationFn: (data: Partial<ScheduleConfig>) =>
      fetchJson<ScheduleConfig>('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
    },
  });

  async function saveConfig() {
    if (!draftConfig) return;
    await saveMutation.mutateAsync(draftConfig);
    setSavedConfig(true);
    setTimeout(() => setSavedConfig(false), 3000);
  }

  async function saveWeek() {
    if (!draftRotacion) return;
    await saveMutation.mutateAsync({ rotacion: draftRotacion });
    setSavedWeek(true);
    setTimeout(() => setSavedWeek(false), 3000);
  }

  async function saveAll() {
    if (!draftConfig || !draftRotacion) return;
    await saveMutation.mutateAsync({ ...draftConfig, rotacion: draftRotacion });
    setSavedConfig(true);
    setSavedWeek(true);
    setTimeout(() => { setSavedConfig(false); setSavedWeek(false); }, 3000);
  }

  // Agent labels for the selector
  const AGENT_OPTIONS: { value: AgentType | 'cascade'; label: string; Icon: React.ElementType; desc: string }[] = [
    { value: 'calificador', label: 'Calificación',   Icon: ClipboardCheck, desc: 'WF01 — califica el siguiente batch de empresas' },
    { value: 'radar',       label: 'Radar',          Icon: Radar,          desc: 'WF02 — detecta señales CAPEX (requiere empresa específica)' },
    { value: 'prospector',  label: 'Prospección',    Icon: Users,          desc: 'WF03 — busca contactos con Apollo.io' },
    { value: 'cascade',     label: 'Cascada completa', Icon: Layers,       desc: 'WF01 → WF02 → WF03 — pipeline completo (WF01 activa los siguientes)' },
  ];

  async function ejecutarAhora() {
    setRunningNow(true);
    setRunError(null);
    setRunSuccess(false);
    setLastExecId(null);

    // Cascada: dispara solo WF01 — n8n se encarga de activar WF02 y WF03
    // automáticamente para las empresas que califican.
    const agentPayload = agentToRun === 'cascade' ? 'calificador' : agentToRun;
    const todayLinea = (() => {
      const todayIdx = getTodayIdx();
      const dia = DIAS[todayIdx];
      const linea = draftRotacion?.[dia] ?? 'BHS';
      return linea === 'Descanso' || linea === 'Todas' || linea === 'ALL_TIER_A' ? 'BHS' : linea;
    })();

    try {
      const result = await fetchJson<{ execution_id: string; pipeline_id: string }>('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent:     agentPayload,
          linea:     todayLinea,
          batchSize: draftConfig?.batchSizes?.BHS ?? 10,
        }),
      });
      setLastExecId(result.execution_id);
      setRunSuccess(true);
      invalidateTray(); // wake the global tracker tray
      toast.success(`${AGENT_OPTIONS.find(o => o.value === agentToRun)?.label ?? 'Agente'} iniciado`);
      setTimeout(() => setRunSuccess(false), 8000);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Error desconocido';
      setRunError(msg);
      toast.error(`Error: ${msg}`);
    } finally {
      setRunningNow(false);
    }
  }

  if (isLoading || !draftConfig || !draftRotacion) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 size={20} className="animate-spin" />
          <span>Cargando configuración...</span>
        </div>
      </div>
    );
  }

  const activo  = draftConfig.activo ?? true;
  const hora    = draftConfig.hora ?? '07:00';
  const bs      = draftConfig.batchSizes ?? { BHS: 10, Carton: 10, Intralogistica: 10, FinalLinea: 10, Motos: 10, Solumat: 10 };
  const nextRun = activo ? nextRunLabel(hora, draftRotacion) : 'Escaneo automático desactivado';
  const todayIdx = getTodayIdx();

  return (
    <div className="space-y-6">

      {/* ── Status header bar ─────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto mb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Title */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-surface-muted rounded-lg border border-border">
              <Calendar size={20} className="text-muted-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground tracking-tight">Cronograma</h1>
              <p className="text-muted-foreground text-sm">Escaneo automático diario del Radar de Inversión B2B</p>
            </div>
          </div>

          {/* Run now */}
          <div className="flex flex-col items-end gap-3">
            {/* Agent selector */}
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {AGENT_OPTIONS.map(opt => {
                const isActive = agentToRun === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    title={opt.desc}
                    onClick={() => setAgentToRun(opt.value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-orange-900/60 border-orange-600 text-orange-200'
                        : 'bg-surface border-border text-muted-foreground hover:border-border'
                    }`}
                  >
                    <opt.Icon size={12} />
                    {opt.label}
                  </button>
                );
              })}
            </div>

            <Button
              onClick={ejecutarAhora}
              disabled={runningNow}
              className="bg-orange-600 hover:bg-orange-500 gap-2 h-10 px-5 font-semibold shadow-lg shadow-orange-900/30"
            >
              {runningNow ? (
                <><Loader2 size={15} className="animate-spin" /> Iniciando...</>
              ) : (
                <><PlayCircle size={15} /> Ejecutar ahora</>
              )}
            </Button>

            {runSuccess && (
              <div className="flex items-center gap-1.5 text-green-400 text-xs">
                <CheckCircle size={12} /> Iniciado — sigue el progreso abajo o en el tracker ↘
              </div>
            )}
            {runError && (
              <div className="flex items-center gap-1.5 text-red-400 text-xs">
                <AlertCircle size={12} /> {runError}
              </div>
            )}
          </div>
        </div>

        {/* Inline stats bar */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex items-center gap-3 px-4 py-3 bg-surface border border-border rounded-xl">
            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${activo ? 'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)]' : 'bg-gray-600'}`} />
            <div>
              <p className="text-xs text-gray-600 uppercase tracking-wider">Estado</p>
              <p className={`text-sm font-semibold ${activo ? 'text-green-400' : 'text-muted-foreground'}`}>
                {activo ? 'Activo' : 'Inactivo'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3 bg-surface border border-border rounded-xl">
            <Clock size={16} className="text-gray-600 flex-shrink-0" />
            <div>
              <p className="text-xs text-gray-600 uppercase tracking-wider">Hora programada</p>
              <p className="text-sm font-semibold text-foreground">{formatHora(hora)} <span className="text-gray-600 font-normal text-xs">(UTC-5)</span></p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3 bg-surface border border-border rounded-xl">
            <Calendar size={16} className="text-blue-500 flex-shrink-0" />
            <div>
              <p className="text-xs text-gray-600 uppercase tracking-wider">Próxima ejecución</p>
              <p className="text-sm font-medium text-muted-foreground truncate">{nextRun}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Inline tracker — shows the execution just fired ─────────────────── */}
      {lastExecId && (
        <div className="max-w-6xl mx-auto mt-4">
          <div className="rounded-xl border border-orange-800/50 bg-orange-950/20 p-4 space-y-2">
            <p className="text-xs font-semibold text-orange-300 uppercase tracking-wide">
              Ejecución en curso
            </p>
            <AgentPipelineCard executionId={lastExecId} />
          </div>
        </div>
      )}

      {/* ── Main grid ───────────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* ─────────── LEFT COLUMN — 2/5 ─────────── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Toggle activo */}
          <Card className="bg-surface border-border">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-200">Escaneo automático</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Ejecuta el radar diariamente</p>
                </div>
                <Switch
                  checked={activo}
                  onCheckedChange={v => setDraftConfig(prev => prev ? { ...prev, activo: v } : prev)}
                />
              </div>
              {!activo && (
                <p className="mt-3 text-xs text-amber-500/80 bg-amber-950/30 border border-amber-900/50 rounded-lg px-3 py-2">
                  El escaneo automatico esta desactivado. Las empresas no seran procesadas diariamente.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Hora de ejecución */}
          <Card className="bg-surface border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-muted-foreground text-xs uppercase tracking-widest font-semibold flex items-center gap-2">
                <Clock size={12} /> Hora de ejecución
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <Input
                    type="time"
                    value={hora}
                    onChange={e => setDraftConfig(prev => prev ? { ...prev, hora: e.target.value } : prev)}
                    className="bg-surface-muted border-border text-foreground text-2xl h-12 font-mono tabular-nums"
                  />
                </div>
                <div className="pb-1">
                  <p className="text-xs text-gray-600">Colombia</p>
                  <p className="text-xs text-gray-600">UTC-5</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Batch sizes por línea — horizontal cards */}
          <Card className="bg-surface border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-muted-foreground text-xs uppercase tracking-widest font-semibold">
                Empresas por ejecución
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {/* BHS */}
              <div className="flex items-center gap-3 px-3 py-2.5 bg-blue-950/30 border border-blue-900/50 rounded-xl">
                <div className="p-1.5 rounded-lg bg-blue-900/50">
                  <Plane size={14} className="text-blue-400" />
                </div>
                <Label className="text-blue-300 text-xs font-medium flex-1">BHS</Label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={bs.BHS}
                  onChange={e => setDraftConfig(prev => prev ? {
                    ...prev,
                    batchSizes: { ...(prev.batchSizes ?? { BHS: 10, Carton: 10, Intralogistica: 10, FinalLinea: 10, Motos: 10, Solumat: 10 }), BHS: Number(e.target.value) },
                  } : prev)}
                  className="bg-surface-muted border-border text-foreground w-20 h-8 text-sm text-center"
                />
              </div>

              {/* Cartón */}
              <div className="flex items-center gap-3 px-3 py-2.5 bg-amber-950/30 border border-amber-900/50 rounded-xl">
                <div className="p-1.5 rounded-lg bg-amber-900/50">
                  <Package size={14} className="text-amber-400" />
                </div>
                <Label className="text-amber-300 text-xs font-medium flex-1">Cartón</Label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={bs.Carton}
                  onChange={e => setDraftConfig(prev => prev ? {
                    ...prev,
                    batchSizes: { ...(prev.batchSizes ?? { BHS: 10, Carton: 10, Intralogistica: 10, FinalLinea: 10, Motos: 10, Solumat: 10 }), Carton: Number(e.target.value) },
                  } : prev)}
                  className="bg-surface-muted border-border text-foreground w-20 h-8 text-sm text-center"
                />
              </div>

              {/* Intralogística */}
              <div className="flex items-center gap-3 px-3 py-2.5 bg-emerald-950/30 border border-emerald-900/50 rounded-xl">
                <div className="p-1.5 rounded-lg bg-emerald-900/50">
                  <Warehouse size={14} className="text-emerald-400" />
                </div>
                <Label className="text-emerald-300 text-xs font-medium flex-1">Intralogística</Label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={bs.Intralogistica}
                  onChange={e => setDraftConfig(prev => prev ? {
                    ...prev,
                    batchSizes: { ...(prev.batchSizes ?? { BHS: 10, Carton: 10, Intralogistica: 10, FinalLinea: 10, Motos: 10, Solumat: 10 }), Intralogistica: Number(e.target.value) },
                  } : prev)}
                  className="bg-surface-muted border-border text-foreground w-20 h-8 text-sm text-center"
                />
              </div>

            </CardContent>
          </Card>

          {/* Última ejecución */}
          {schedule?.ultimaEjecucion && (
            <div className="px-4 py-3 bg-surface border border-border rounded-xl">
              <p className="text-xs text-gray-600 uppercase tracking-wider mb-1">Última ejecución</p>
              <p className="text-sm text-muted-foreground">{schedule.ultimaEjecucion}</p>
            </div>
          )}
        </div>

        {/* ─────────── RIGHT COLUMN — 3/5 — Weekly calendar ─────────── */}
        <div className="lg:col-span-3">
          <Card className="bg-surface border-border h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-muted-foreground text-xs uppercase tracking-widest font-semibold flex items-center gap-2">
                <Calendar size={12} /> Rotación semanal
              </CardTitle>
              <p className="text-xs text-gray-600 mt-1">
                Asigna una línea de negocio a cada día. Los días en Descanso no ejecutan el escaneo.
              </p>
            </CardHeader>
            <CardContent className="pt-0">
              {/* 7-column calendar grid */}
              <div className="grid grid-cols-7 gap-1.5">
                {DIAS.map((dia, idx) => {
                  const val = (draftRotacion[dia] ?? 'Descanso') as LineaSchedule;
                  const style = LINEA_STYLE[val] ?? LINEA_STYLE['Descanso']!;
                  const isToday = idx === todayIdx;

                  return (
                    <div
                      key={dia}
                      className={`
                        relative flex flex-col rounded-xl border transition-all
                        ${style.bg} ${style.border}
                        ${isToday ? 'ring-2 ring-offset-1 ring-offset-gray-950 ring-white/20' : ''}
                      `}
                    >
                      {/* Day header */}
                      <div className="px-2 pt-2.5 pb-1.5 text-center">
                        <p className={`text-xs font-bold ${isToday ? 'text-white' : 'text-muted-foreground'}`}>
                          {DIAS_ABBR[dia]}
                        </p>
                        {isToday && (
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 mt-0.5" />
                        )}
                      </div>

                      {/* Color dot */}
                      <div className="flex justify-center py-1">
                        <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                      </div>

                      {/* Line badge */}
                      <div className="px-1.5 pb-1.5 text-center">
                        <span className={`text-xs font-semibold ${style.text} leading-tight`}>
                          {style.label}
                        </span>
                      </div>

                      {/* Select */}
                      <div className="px-1 pb-2">
                        <Select
                          value={val}
                          onValueChange={v =>
                            setDraftRotacion(prev => prev ? { ...prev, [dia]: v as LineaSchedule } : prev)
                          }
                        >
                          <SelectTrigger className="bg-surface/80 border-border text-muted-foreground h-7 text-xs px-1.5 w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-surface-muted border-border">
                            {lineasSemana.map(l => (
                              <SelectItem key={l.value} value={l.value} className="text-gray-100 text-xs">
                                {l.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5">
                {Object.entries(LINEA_STYLE).map(([key, s]) => (
                  <div key={key} className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                    <span className="text-xs text-gray-600">{s.label}</span>
                  </div>
                ))}
                <div className="flex items-center gap-1.5 ml-auto">
                  <span className="w-2 h-2 rounded-full bg-green-400" />
                  <span className="text-xs text-gray-600">Hoy</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Save all — full width ─────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto mt-6">
        <div className="flex items-center gap-4">
          <Button
            onClick={saveAll}
            disabled={saveMutation.isPending}
            className={`
              flex-1 h-12 text-base font-semibold gap-3 transition-all
              ${savedConfig && savedWeek
                ? 'bg-green-700 hover:bg-green-600'
                : 'bg-green-800 hover:bg-green-700'}
              shadow-lg shadow-green-900/30
            `}
          >
            {savedConfig && savedWeek ? (
              <><CheckCircle size={18} /> Todo guardado</>
            ) : saveMutation.isPending ? (
              <><Loader2 size={18} className="animate-spin" /> Guardando...</>
            ) : (
              <><Save size={18} /> Guardar todo</>
            )}
          </Button>

          {/* Individual save buttons — smaller, secondary */}
          <Button
            onClick={saveConfig}
            disabled={saveMutation.isPending}
            className="h-12 px-5 bg-surface-muted hover:bg-surface-muted border border-border text-muted-foreground text-sm gap-2"
          >
            {savedConfig ? <CheckCircle size={14} /> : <Save size={14} />}
            Config
          </Button>
          <Button
            onClick={saveWeek}
            disabled={saveMutation.isPending}
            className="h-12 px-5 bg-surface-muted hover:bg-surface-muted border border-border text-muted-foreground text-sm gap-2"
          >
            {savedWeek ? <CheckCircle size={14} /> : <Calendar size={14} />}
            Semana
          </Button>
        </div>
      </div>
    </div>
  );
}
