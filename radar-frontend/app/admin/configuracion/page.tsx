'use client';
// app/admin/configuracion/page.tsx — System configuration (key-value)

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { fetchJson, ApiError } from '@/lib/fetcher';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Save, Pencil, X } from 'lucide-react';

interface ConfigEntry {
  clave: string;
  valor: unknown;
  descripcion: string | null;
  updated_at: string;
}

function valueToString(v: unknown): string {
  if (typeof v === 'string') return v;
  return JSON.stringify(v);
}

function stringToValue(s: string): unknown {
  try { return JSON.parse(s); } catch { return s; }
}

export default function ConfiguracionPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const { data: config = [], isLoading } = useQuery<ConfigEntry[]>({
    queryKey: ['admin-configuracion'],
    queryFn: () => fetchJson<ConfigEntry[]>('/api/admin/configuracion'),
  });

  const patchMutation = useMutation({
    mutationFn: ({ clave, valor }: { clave: string; valor: unknown }) =>
      fetchJson('/api/admin/configuracion', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clave, valor }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-configuracion'] });
      toast.success('Configuración guardada');
      setEditing(null);
    },
    onError: (err) => toast.error(`Error: ${err instanceof ApiError ? err.message : 'Desconocido'}`),
  });

  function startEdit(entry: ConfigEntry) {
    setEditing(entry.clave);
    setDraft(valueToString(entry.valor));
  }

  function saveEdit(clave: string) {
    patchMutation.mutate({ clave, valor: stringToValue(draft) });
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configuración</h1>
        <p className="text-sm text-muted-foreground">Parámetros globales del sistema Matec Radar B2B</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 p-8 text-muted-foreground">
              <Loader2 size={16} className="animate-spin" /> Cargando configuración…
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {config.map(entry => (
                <div key={entry.clave} className="px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-sm font-semibold text-foreground">{entry.clave}</p>
                      {entry.descripcion && (
                        <p className="text-xs text-muted-foreground mt-0.5">{entry.descripcion}</p>
                      )}
                    </div>
                    {editing !== entry.clave && (
                      <button
                        type="button"
                        onClick={() => startEdit(entry)}
                        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                        title="Editar"
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                  </div>

                  {editing === entry.clave ? (
                    <div className="mt-2 flex items-center gap-2">
                      <Input
                        value={draft}
                        onChange={e => setDraft(e.target.value)}
                        className="font-mono text-sm flex-1"
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === 'Enter') saveEdit(entry.clave);
                          if (e.key === 'Escape') setEditing(null);
                        }}
                      />
                      <Button size="sm" onClick={() => saveEdit(entry.clave)}
                        disabled={patchMutation.isPending}
                        className="gap-1 bg-blue-600 hover:bg-blue-700 shrink-0">
                        {patchMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                        Guardar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditing(null)} className="shrink-0">
                        <X size={12} />
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-1.5 font-mono text-xs text-blue-300 bg-blue-950/20 rounded-lg px-3 py-2 border border-blue-900/30 break-all">
                      {valueToString(entry.valor)}
                    </div>
                  )}

                  <p className="mt-1.5 text-[11px] text-muted-foreground/60">
                    Actualizado: {new Date(entry.updated_at).toLocaleString('es-CO')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
