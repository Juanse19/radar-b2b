/**
 * GET /api/calificador/empresa/[id]/contactos
 * Devuelve hasta 20 contactos de Apollo guardados para la empresa.
 * Lazy-load desde el drawer del Calificador.
 */
import 'server-only';
import { NextResponse } from 'next/server';
import { pgQuery, SCHEMA, pgLit } from '@/lib/db/supabase/pg_client';
import { getCurrentSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

interface ContactoRow {
  id:         number;
  full_name:  string | null;
  title:      string | null;
  email:      string | null;
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
    const items = await pgQuery<ContactoRow>(
      `SELECT
         id,
         full_name,
         title,
         email
       FROM ${SCHEMA}.contactos
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
