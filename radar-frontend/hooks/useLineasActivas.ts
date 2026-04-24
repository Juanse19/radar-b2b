// hooks/useLineasActivas.ts
//
// Fetches active business lines from the DB via GET /api/lineas.
// Falls back to LINEAS_FALLBACK if the API call fails (e.g., Supabase not
// configured in dev, or transient network error).
//
// staleTime: 5 minutes — lineas_negocio changes infrequently, no need to
// re-fetch on every navigation.

'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchJsonSafe } from '@/lib/fetcher';
import type { LineaRow } from '@/app/api/lineas/route';

export type { LineaRow };

export const LINEAS_FALLBACK: LineaRow[] = [
  { id: 'bhs',            codigo: 'bhs',            nombre: 'BHS',             color_hex: '#3b82f6', icono: 'Plane',     descripcion: 'Terminales, carruseles, sorters' },
  { id: 'carton',         codigo: 'carton_papel',   nombre: 'Cartón',           color_hex: '#f59e0b', icono: 'Package',   descripcion: 'Plantas corrugadoras, empaque' },
  { id: 'intralogistica', codigo: 'intralogistica', nombre: 'Intralogística',   color_hex: '#10b981', icono: 'Warehouse', descripcion: 'CEDI, WMS, ASRS, conveyor' },
  { id: 'final-linea',    codigo: 'final_linea',    nombre: 'Final de Línea',   color_hex: '#f97316', icono: 'Factory',   descripcion: 'Alimentos, bebidas, palletizado' },
  { id: 'motos',          codigo: 'motos',          nombre: 'Motos',            color_hex: '#f43f5e', icono: 'Bike',      descripcion: 'Ensambladoras, motocicletas' },
  { id: 'solumat',        codigo: 'solumat',        nombre: 'SOLUMAT',          color_hex: '#8b5cf6', icono: 'Truck',     descripcion: 'Plásticos, materiales industriales' },
];

export interface UseLineasActivasResult {
  lineas: LineaRow[];
  isLoading: boolean;
}

export function useLineasActivas(): UseLineasActivasResult {
  const { data, isLoading } = useQuery<LineaRow[]>({
    queryKey: ['lineas-activas'],
    queryFn: () => fetchJsonSafe<LineaRow[]>('/api/lineas', LINEAS_FALLBACK),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    lineas:    data ?? LINEAS_FALLBACK,
    isLoading,
  };
}
