// app/api/lineas/route.ts
//
// GET /api/lineas — returns active business lines ordered by `orden`.
//
// Requires an authenticated session (matec_session cookie). If Supabase is
// not configured (missing env vars) the request falls back to the hardcoded
// LINEAS_FALLBACK array so local dev without Supabase keeps working.
//
// Response shape:
//   [{ id, nombre, color_hex, icono, descripcion }, ...]

import { NextResponse } from 'next/server';
import { ensureSession } from '@/lib/auth/session';

export interface LineaRow {
  id: string;
  nombre: string;
  color_hex: string | null;
  icono: string | null;
  descripcion: string | null;
}

// Fallback used when Supabase is not configured (dev without DB).
const LINEAS_FALLBACK: LineaRow[] = [
  { id: 'bhs',            nombre: 'BHS',             color_hex: '#3b82f6', icono: 'Plane',     descripcion: 'Terminales, carruseles, sorters' },
  { id: 'carton',         nombre: 'Cartón',           color_hex: '#f59e0b', icono: 'Package',   descripcion: 'Plantas corrugadoras, empaque' },
  { id: 'intralogistica', nombre: 'Intralogística',   color_hex: '#10b981', icono: 'Warehouse', descripcion: 'CEDI, WMS, ASRS, conveyor' },
  { id: 'final-linea',    nombre: 'Final de Línea',   color_hex: '#f97316', icono: 'Factory',   descripcion: 'Alimentos, bebidas, palletizado' },
  { id: 'motos',          nombre: 'Motos',            color_hex: '#f43f5e', icono: 'Bike',      descripcion: 'Ensambladoras, motocicletas' },
  { id: 'solumat',        nombre: 'SOLUMAT',          color_hex: '#8b5cf6', icono: 'Truck',     descripcion: 'Plásticos, materiales industriales' },
];

export async function GET() {
  // Auth guard — redirects to /login if no valid session.
  try {
    await ensureSession();
  } catch {
    // ensureSession() calls redirect() which throws a Next.js NEXT_REDIRECT
    // error. Re-throw so Next.js handles it correctly; only swallow
    // non-redirect errors (e.g., DB issues) to apply the fallback below.
    throw new Error('Unauthorized');
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // If Supabase is not configured, return the hardcoded fallback immediately.
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(LINEAS_FALLBACK);
  }

  try {
    const { getAdminDb } = await import('@/lib/db/supabase/admin');
    const db = getAdminDb();

    const { data, error } = await db
      .from('lineas_negocio')
      .select('id, nombre, color_hex, icono, descripcion')
      .eq('activo', true)
      .order('orden', { ascending: true });

    if (error) {
      console.error('[api/lineas] Supabase error:', error.message);
      return NextResponse.json(LINEAS_FALLBACK);
    }

    return NextResponse.json((data ?? []) as LineaRow[]);
  } catch (err) {
    console.error('[api/lineas] Unexpected error:', err);
    return NextResponse.json(LINEAS_FALLBACK);
  }
}
