'use client';
// app/admin/actividad/page.tsx — Activity audit log (read-only)

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchJson } from '@/lib/fetcher';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, CheckCircle, XCircle, AlertTriangle, X } from 'lucide-react';
import { AdminBreadcrumb } from '@/components/admin/AdminBreadcrumb';

interface ActividadEntry {
  id: number;
  usuario_email: string | null;
  tipo: string;
  descripcion: string | null;
  resultado: 'ok' | 'error' | 'warn' | null;
  metadata: unknown;
  created_at: string;
}

const TIPO_STYLES: Record<string, string> = {
  login:          'bg-green-500/15 text-green-300 border-green-500/30',
  logout:         'bg-gray-500/15 text-gray-400 border-gray-500/30',
  disparo_agente: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  error:          'bg-red-500/15 text-red-300 border-red-500/30',
  warn:           'bg-amber-500/15 text-amber-300 border-amber-500/30',
  config_change:  'bg-violet-500/15 text-violet-300 border-violet-500/30',
};

const QUICK_TIPOS = ['login', 'logout', 'disparo_agente', 'error', 'config_change'];

function TipoBadge({ tipo }: { tipo: string }) {
  const cls = TIPO_STYLES[tipo] ?? 'bg-surface-muted text-muted-foreground border-border';
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium shrink-0 ${cls}`}>
      {tipo}
    </span>
  );
}

function ResultIcon({ resultado }: { resultado: string | null }) {
  if (resultado === 'ok')    return <CheckCircle size={14} className="text-green-400 shrink-0" />;
  if (resultado === 'error') return <XCircle size={14} className="text-red-400 shrink-0" />;
  if (resultado === 'warn')  return <AlertTriangle size={14} className="text-amber-400 shrink-0" />;
  return <span className="w-3.5 h-3.5 rounded-full bg-gray-600 inline-block shrink-0" />;
}

export default function ActividadPage() {
  const [emailFilter, setEmailFilter] = useState('');
  const [tipoFilter,  setTipoFilter]  = useState('');

  const params = new URLSearchParams({ limit: '100' });
  if (emailFilter.trim()) params.set('usuario_email', emailFilter.trim());
  if (tipoFilter.trim())  params.set('tipo', tipoFilter.trim());

  const { data: actividad = [], isLoading } = useQuery<ActividadEntry[]>({
    queryKey: ['admin-actividad', emailFilter, tipoFilter],
    queryFn: () => fetchJson<ActividadEntry[]>(`/api/admin/actividad?${params}`),
    refetchInterval: 30_000, // auto-refresh every 30s
  });

  return (
    <div className="space-y-5 max-w-5xl">
      <AdminBreadcrumb
        crumbs={[
          { label: 'Administración', href: '/admin' },
          { label: 'Actividad' },
        ]}
      />

      <div>
        <h1 className="text-2xl font-bold text-foreground">Log de actividad</h1>
        <p className="text-sm text-muted-foreground">Auditoría de acciones del sistema</p>
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex gap-2 flex-wrap">
          <Input placeholder="Filtrar por email..." value={emailFilter}
            onChange={e => setEmailFilter(e.target.value)}
            className="w-52" />
          <Input placeholder="Tipo (texto libre...)" value={tipoFilter}
            onChange={e => setTipoFilter(e.target.value)}
            className="w-44" />
          {(emailFilter || tipoFilter) && (
            <button
              type="button"
              onClick={() => { setEmailFilter(''); setTipoFilter(''); }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={12} /> Limpiar
            </button>
          )}
        </div>
        {/* Quick-filter chips */}
        <div className="flex gap-1.5 flex-wrap">
          {QUICK_TIPOS.map(t => {
            const cls = TIPO_STYLES[t] ?? 'bg-surface-muted text-muted-foreground border-border';
            const active = tipoFilter === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTipoFilter(active ? '' : t)}
                className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium transition-all ${cls} ${
                  active ? 'ring-2 ring-white/20 scale-105' : 'opacity-60 hover:opacity-100'
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 p-8 text-muted-foreground">
              <Loader2 size={16} className="animate-spin" /> Cargando actividad…
            </div>
          ) : actividad.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No hay registros de actividad todavía.
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {actividad.map(entry => (
                <div key={entry.id} className="flex items-start gap-3 px-4 py-3 hover:bg-surface-muted/30">
                  <ResultIcon resultado={entry.resultado} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <TipoBadge tipo={entry.tipo} />
                      {entry.usuario_email && (
                        <span className="text-xs text-muted-foreground">{entry.usuario_email}</span>
                      )}
                    </div>
                    {entry.descripcion && (
                      <p className="text-sm text-foreground mt-0.5">{entry.descripcion}</p>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground/60 tabular-nums shrink-0">
                    {new Date(entry.created_at).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
