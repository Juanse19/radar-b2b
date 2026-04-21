import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { pgQuery, pgLit, SCHEMA } from '@/lib/db/supabase/pg_client';

const S = SCHEMA;

const LINE_FILTER: Record<string, { type: 'parent' | 'sub'; code: string }> = {
  'BHS':            { type: 'parent', code: 'bhs' },
  'Intralogística': { type: 'parent', code: 'intralogistica' },
  'Cartón':         { type: 'parent', code: 'carton_papel' },
  'Final de Línea': { type: 'sub',    code: 'final_linea' },
  'Motos':          { type: 'sub',    code: 'ensambladoras_motos' },
  'SOLUMAT':        { type: 'sub',    code: 'solumat' },
};

interface AutoSelectRequest {
  linea:    string;
  cantidad: number;  // 1-20
}

interface Empresa {
  id:      number;
  name:    string;
  country: string;
  tier:    string | null;
  linea:   string | null;
}

export async function POST(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: AutoSelectRequest;
  try {
    body = await req.json() as AutoSelectRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.linea || !body.cantidad || body.cantidad < 1 || body.cantidad > 20) {
    return NextResponse.json({ error: 'linea and cantidad (1-20) required' }, { status: 400 });
  }

  const where: string[] = [];

  // Support comma-separated multi-line values (e.g. 'BHS,Cartón')
  const lines = body.linea.split(',').map(l => l.trim()).filter(Boolean);
  const lineConditions: string[] = [];
  for (const line of lines) {
    const mapping = LINE_FILTER[line];
    if (mapping) {
      if (mapping.type === 'parent') {
        lineConditions.push(`EXISTS (
          SELECT 1 FROM ${S}.empresa_sub_lineas esl
          JOIN ${S}.sub_lineas_negocio sl ON sl.id = esl.sub_linea_id
          JOIN ${S}.lineas_negocio ln ON ln.id = sl.linea_id
          WHERE esl.empresa_id = e.id AND ln.codigo = ${pgLit(mapping.code)}
        )`);
      } else {
        lineConditions.push(`EXISTS (
          SELECT 1 FROM ${S}.empresa_sub_lineas esl
          JOIN ${S}.sub_lineas_negocio sl ON sl.id = esl.sub_linea_id
          WHERE esl.empresa_id = e.id AND sl.codigo = ${pgLit(mapping.code)}
        )`);
      }
    }
  }
  if (lineConditions.length === 1) {
    where.push(lineConditions[0]);
  } else if (lineConditions.length > 1) {
    where.push(`(${lineConditions.join(' OR ')})`);
  }

  try {
    const rows = await pgQuery<{
      id: number; company_name: string; pais: string; tier_actual: string | null;
    }>(
      `SELECT
         e.id, e.company_name, e.pais::text, e.tier_actual::text
       FROM ${S}.empresas e
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY
         CASE e.tier_actual::text
           WHEN 'ORO' THEN 1
           WHEN 'MONITOREO' THEN 2
           WHEN 'ARCHIVO' THEN 3
           ELSE 4
         END ASC,
         e.company_name ASC
       LIMIT ${pgLit(body.cantidad)}`
    );

    const empresas: Empresa[] = rows.map(r => ({
      id:      r.id,
      name:    r.company_name,
      country: r.pais ?? '',
      tier:    r.tier_actual ?? null,
      linea:   body.linea,
    }));

    return NextResponse.json({ empresas });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[/api/radar-v2/auto-select] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
