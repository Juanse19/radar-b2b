'use client';
// hooks/admin/useActividad.ts
// React Query hook for /api/admin/actividad with filtering and pagination.

import { useQuery } from '@tanstack/react-query';
import { fetchJsonSafe } from '@/lib/fetcher';

export interface ActividadRecord {
  id: string;
  usuario_id?: string | null;
  usuario_email?: string | null;
  tipo: string;
  descripcion?: string | null;
  resultado?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

export interface ActividadFiltros {
  email?: string;
  tipo?: string;
}

export function useActividad(filtros: ActividadFiltros = {}, page = 1) {
  const limit = 50;
  const offset = (page - 1) * limit;

  const params = new URLSearchParams();
  params.set('limit', String(limit));
  if (filtros.email) params.set('usuario_email', filtros.email);
  if (filtros.tipo) params.set('tipo', filtros.tipo);
  // The actividad route uses limit only (no offset pagination), pass offset for future use
  if (offset > 0) params.set('offset', String(offset));

  const url = `/api/admin/actividad?${params.toString()}`;

  return useQuery<ActividadRecord[]>({
    queryKey: ['admin', 'actividad', filtros, page],
    queryFn: () => fetchJsonSafe<ActividadRecord[]>(url, []),
    staleTime: 15_000,
  });
}
