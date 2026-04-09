'use client';
// hooks/admin/useUsuarios.ts
// React Query hooks for /api/admin/usuarios CRUD + pagination.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { fetchJson, fetchJsonSafe } from '@/lib/fetcher';

export interface AdminUser {
  id: string;
  nombre: string;
  email: string;
  rol: 'ADMIN' | 'COMERCIAL' | 'AUXILIAR';
  estado_acceso: 'ACTIVO' | 'PENDIENTE' | 'INACTIVO';
  created_at: string;
  aprobado_en?: string | null;
}

export interface AdminUsersResponse {
  usuarios: AdminUser[];
  total: number;
  page: number;
  totalPages: number;
}

const FALLBACK: AdminUsersResponse = { usuarios: [], total: 0, page: 1, totalPages: 1 };

export function useUsuarios(page = 1, limit = 10) {
  return useQuery<AdminUsersResponse>({
    queryKey: ['admin', 'usuarios', page, limit],
    queryFn: () =>
      fetchJsonSafe<AdminUsersResponse>(
        `/api/admin/usuarios?page=${page}&limit=${limit}`,
        FALLBACK,
      ),
    staleTime: 30_000,
    placeholderData: (prev) => prev, // keep previous page data during pagination
  });
}

export function useCreateUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      nombre: string;
      email: string;
      password: string;
      rol: string;
    }) =>
      fetchJson('/api/admin/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'usuarios'] });
      toast.success('Usuario creado correctamente');
    },
    onError: (err: Error) =>
      toast.error(err.message || 'Error al crear usuario'),
  });
}

export function useUpdateUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      nombre?: string;
      rol?: string;
      estado_acceso?: string;
    }) =>
      fetchJson(`/api/admin/usuarios/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'usuarios'] });
      toast.success('Usuario actualizado');
    },
    onError: (err: Error) =>
      toast.error(err.message || 'Error al actualizar usuario'),
  });
}

export function useDeleteUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson(`/api/admin/usuarios/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'usuarios'] });
      toast.success('Usuario eliminado');
    },
    onError: (err: Error) =>
      toast.error(err.message || 'Error al eliminar usuario'),
  });
}
