import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { pgQuery, pgLit, SCHEMA } from '@/lib/db/supabase/pg_client';

const S = SCHEMA;

// Maps UI line labels to DB identifiers.
// 'parent' = filter by lineas_negocio.codigo (matches all sub-lines under that parent).
// 'sub'    = filter by sub_lineas_negocio.codigo (specific sub-line only).
const LINE_FILTER: Record<string, { type: 'parent' | 'sub'; code: string }> = {
  'BHS':            { type: 'parent', code: 'bhs' },
  'Intralogística': { type: 'parent', code: 'intralogistica' },
  'Cartón':         { type: 'parent', code: 'carton_papel' },
  'Final de Línea': { type: 'sub',    code: 'final_linea' },
  'Motos':          { type: 'sub',    code: 'ensambladoras_motos' },
  'SOLUMAT':        { type: 'sub',    code: 'solumat' },
};

export async function GET(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const linea  = searchParams.get('linea');
  const limit  = Math.min(Number(searchParams.get('limit') ?? 200), 500);
  const search = searchParams.get('q');

  const where: string[] = [];

  if (linea && linea !== 'ALL') {
    const mapping = LINE_FILTER[linea];
    if (mapping) {
      if (mapping.type === 'parent') {
        where.push(`EXISTS (
          SELECT 1 FROM ${S}.empresa_sub_lineas esl
          JOIN ${S}.sub_lineas_negocio sl ON sl.id = esl.sub_linea_id
          JOIN ${S}.lineas_negocio ln ON ln.id = sl.linea_id
          WHERE esl.empresa_id = e.id
            AND ln.codigo = ${pgLit(mapping.code)}
        )`);
      } else {
        where.push(`EXISTS (
          SELECT 1 FROM ${S}.empresa_sub_lineas esl
          JOIN ${S}.sub_lineas_negocio sl ON sl.id = esl.sub_linea_id
          WHERE esl.empresa_id = e.id
            AND sl.codigo = ${pgLit(mapping.code)}
        )`);
      }
    } else {
      // Fallback: ILIKE on sub-line name
      where.push(`EXISTS (
        SELECT 1 FROM ${S}.empresa_sub_lineas esl
        JOIN ${S}.sub_lineas_negocio sl ON sl.id = esl.sub_linea_id
        WHERE esl.empresa_id = e.id
          AND sl.nombre ILIKE ${pgLit('%' + linea + '%')}
      )`);
    }
  }

  if (search) {
    where.push(`e.company_name ILIKE ${pgLit('%' + search + '%')}`);
  }

  try {
    const rows = await pgQuery<{
      id: number;
      company_name: string;
      pais: string;
      tier_actual: string | null;
      linea_negocio: string | null;
    }>(
      `SELECT
         e.id,
         e.company_name,
         e.pais::text,
         e.tier_actual::text,
         (SELECT sl2.nombre
            FROM ${S}.empresa_sub_lineas esl2
            JOIN ${S}.sub_lineas_negocio sl2 ON sl2.id = esl2.sub_linea_id
           WHERE esl2.empresa_id = e.id
           LIMIT 1) AS linea_negocio
       FROM ${S}.empresas e
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY e.company_name ASC
       LIMIT ${pgLit(limit)}`
    );

    return NextResponse.json(rows.map(r => ({
      id:      r.id,
      name:    r.company_name,
      country: r.pais ?? '',
      tier:    r.tier_actual ?? '',
      linea:   r.linea_negocio ?? '',
    })));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[/api/radar-v2/companies] Error:', msg);
    return NextResponse.json({ error: 'Error fetching companies' }, { status: 500 });
  }
}
