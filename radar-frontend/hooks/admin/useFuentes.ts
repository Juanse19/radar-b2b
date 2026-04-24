'use client';
// hooks/admin/useFuentes.ts
// React Query hooks for /api/admin/fuentes CRUD.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { fetchJson, fetchJsonSafe } from '@/lib/fetcher';

export interface AdminFuente {
  id: string;
  nombre: string;
  url_base?: string | null;
  tipo?: string | null;
  lineas?: string[];
  priority_score?: number;
  activa?: boolean;
  notas?: string | null;
}

export function useFuentes() {
  return useQuery<AdminFuente[]>({
    queryKey: ['admin', 'fuentes'],
    queryFn: () =>
      fetchJsonSafe<AdminFuente[]>('/api/admin/fuentes', []),
    staleTime: 60_000,
  });
}

export function useCreateFuente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      nombre: string;
      url_base?: string;
      tipo?: string;
      lineas?: string[];
      priority_score?: number;
      notas?: string;
    }) =>
      fetchJson('/api/admin/fuentes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'fuentes'] });
      toast.success('Fuente creada correctamente');
    },
    onError: (err: Error) =>
      toast.error(err.message || 'Error al crear fuente'),
  });
}

export function useUpdateFuente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      nombre?: string;
      url_base?: string;
      tipo?: string;
      lineas?: string[];
      priority_score?: number;
      activa?: boolean;
      notas?: string;
    }) =>
      fetchJson(`/api/admin/fuentes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'fuentes'] });
      toast.success('Fuente actualizada');
    },
    onError: (err: Error) =>
      toast.error(err.message || 'Error al actualizar fuente'),
  });
}
