'use client';
// hooks/admin/useLineas.ts
// React Query hooks for /api/admin/lineas CRUD.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { fetchJson, fetchJsonSafe } from '@/lib/fetcher';

export interface AdminLinea {
  id: string;
  nombre: string;
  descripcion?: string | null;
  color_hex?: string | null;
  icono?: string | null;
  activo?: boolean;
  orden?: number;
}

export function useLineasAdmin() {
  return useQuery<AdminLinea[]>({
    queryKey: ['admin', 'lineas'],
    queryFn: () =>
      fetchJsonSafe<AdminLinea[]>('/api/admin/lineas', []),
    staleTime: 60_000,
  });
}

export function useCreateLinea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      nombre: string;
      descripcion?: string;
      color_hex?: string;
      icono?: string;
      orden?: number;
    }) =>
      fetchJson('/api/admin/lineas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'lineas'] });
      toast.success('Línea creada correctamente');
    },
    onError: (err: Error) =>
      toast.error(err.message || 'Error al crear línea'),
  });
}

export function useUpdateLinea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      nombre?: string;
      descripcion?: string;
      color_hex?: string;
      icono?: string;
      activo?: boolean;
      orden?: number;
    }) =>
      fetchJson(`/api/admin/lineas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'lineas'] });
      toast.success('Línea actualizada');
    },
    onError: (err: Error) =>
      toast.error(err.message || 'Error al actualizar línea'),
  });
}
