/**
 * GET /api/calificador/empresa/[id]/senales
 * Devuelve hasta 20 señales recientes de la empresa (radar_v2_results).
 * Lazy-load desde el drawer del Calificador.
 */
import 'server-only';
import { NextResponse } from 'next/server';
import { pgQuery, SCHEMA, pgLit } from '@/lib/db/supabase/pg_client';
import { getCurrentSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

interface SenalRow {
  id:               number;
  tipo_senal:       string | null;
  descripcion:      string | null;
  created_at:       string | null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: rawId } = await params;
  const empresaId = Number(rawId);
  if (!empresaId || Number.isNaN(empresaId)) {
    return NextResponse.json({ items: [] });
  }

  try {
    const items = await pgQuery<SenalRow>(
      `SELECT
         id,
         tipo_senal,
         descripcion_resumen AS descripcion,
         NULL::TEXT          AS created_at
       FROM ${SCHEMA}.radar_v2_results
       WHERE empresa_id = ${pgLit(empresaId)}
       ORDER BY id DESC
       LIMIT 20`,
    );
    return NextResponse.json({ items }, {
      headers: { 'Cache-Control': 'private, max-age=20' },
    });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
