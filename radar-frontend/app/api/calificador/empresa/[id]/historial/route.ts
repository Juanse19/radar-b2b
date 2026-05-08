/**
 * GET /api/calificador/empresa/[id]/historial
 * Devuelve hasta 20 calificaciones previas de la empresa (timeline).
 * Lazy-load desde el drawer del Calificador.
 */
import 'server-only';
import { NextResponse } from 'next/server';
import { pgQuery, SCHEMA, pgLit } from '@/lib/db/supabase/pg_client';
import { getCurrentSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

interface HistRow {
  id:               number;
  tier_calculado:   string;
  score_total:      number | string | null;
  created_at:       string;
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
    const items = await pgQuery<HistRow>(
      `SELECT
         id,
         tier_calculado::TEXT AS tier_calculado,
         score_total,
         created_at::TEXT     AS created_at
       FROM ${SCHEMA}.calificaciones
       WHERE empresa_id = ${pgLit(empresaId)}
       ORDER BY created_at DESC
       LIMIT 20`,
    );
    return NextResponse.json({ items }, {
      headers: { 'Cache-Control': 'private, max-age=20' },
    });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
