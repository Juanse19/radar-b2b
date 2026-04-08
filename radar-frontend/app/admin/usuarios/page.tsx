'use client';
// app/admin/usuarios/page.tsx — User management

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { fetchJson, ApiError } from '@/lib/fetcher';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, UserPlus, Check, X } from 'lucide-react';
import { roleBadgeClass } from '@/components/AppShell';

interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  estado_acceso: string;
  created_at: string;
}

const ROLES = ['ADMIN', 'COMERCIAL', 'AUXILIAR'] as const;
const ESTADOS = ['ACTIVO', 'PENDIENTE', 'INACTIVO'] as const;

function estadoBadge(estado: string) {
  if (estado === 'ACTIVO')   return 'bg-green-900/40 text-green-300 border border-green-700/50';
  if (estado === 'PENDIENTE') return 'bg-amber-900/40 text-amber-300 border border-amber-700/50';
  return 'bg-gray-800/60 text-gray-400 border border-gray-700/50';
}

export default function UsuariosPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ nombre: '', email: '', rol: 'AUXILIAR', password: '' });

  const { data: usuarios = [], isLoading } = useQuery<Usuario[]>({
    queryKey: ['admin-usuarios'],
    queryFn: () => fetchJson<Usuario[]>('/api/admin/usuarios'),
  });

  const patchMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Record<string, string> }) =>
      fetchJson(`/api/admin/usuarios/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-usuarios'] });
      toast.success('Usuario actualizado');
    },
    onError: (err) => toast.error(`Error: ${err instanceof ApiError ? err.message : 'Desconocido'}`),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) =>
      fetchJson('/api/admin/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-usuarios'] });
      toast.success('Usuario creado');
      setShowCreate(false);
      setForm({ nombre: '', email: '', rol: 'AUXILIAR', password: '' });
    },
    onError: (err) => toast.error(`Error: ${err instanceof ApiError ? err.message : 'Desconocido'}`),
  });

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Usuarios</h1>
          <p className="text-sm text-muted-foreground">Gestión de acceso al sistema</p>
        </div>
        <Button onClick={() => setShowCreate(v => !v)} className="gap-2 bg-blue-600 hover:bg-blue-700">
          <UserPlus size={15} /> Crear usuario
        </Button>
      </div>

      {/* Create form */}
      {showCreate && (
        <Card className="border-blue-700/50 bg-blue-950/20">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-semibold text-foreground">Nuevo usuario</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <Input placeholder="Nombre completo" value={form.nombre}
                onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} />
              <Input placeholder="Email" type="email" value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
              <Input placeholder="Contraseña temporal" type="password" value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
              <select
                value={form.rol}
                onChange={e => setForm(p => ({ ...p, rol: e.target.value }))}
                className="rounded-md border border-border bg-surface-muted px-3 py-2 text-sm text-foreground"
              >
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => createMutation.mutate(form)}
                disabled={createMutation.isPending || !form.nombre || !form.email}
                className="bg-blue-600 hover:bg-blue-700 gap-2">
                {createMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                Crear
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowCreate(false)} className="gap-2">
                <X size={13} /> Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Users table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 p-8 text-muted-foreground">
              <Loader2 size={16} className="animate-spin" /> Cargando usuarios…
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-surface-muted/50">
                <tr className="text-left">
                  {['Nombre', 'Email', 'Rol', 'Estado', 'Acciones'].map(h => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {usuarios.map(u => (
                  <tr key={u.id} className="hover:bg-surface-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{u.nombre}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3">
                      <select
                        value={u.rol}
                        onChange={e => patchMutation.mutate({ id: u.id, updates: { rol: e.target.value } })}
                        className={`rounded-md px-2 py-1 text-xs font-semibold border cursor-pointer ${roleBadgeClass[u.rol] ?? roleBadgeClass.AUXILIAR} bg-transparent`}
                      >
                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={u.estado_acceso}
                        onChange={e => patchMutation.mutate({ id: u.id, updates: { estado_acceso: e.target.value } })}
                        className={`rounded-md px-2 py-1 text-xs font-semibold border cursor-pointer ${estadoBadge(u.estado_acceso)} bg-transparent`}
                      >
                        {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString('es-CO')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
