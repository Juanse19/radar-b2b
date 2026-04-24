import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { pgQuery, pgLit, SCHEMA } from '@/lib/db/supabase/pg_client';

const S = SCHEMA;

// Mock data returned when Supabase is not configured (local dev without DB).
const MOCK_COMPANIES = [
  { id: 1, name: 'Empresa Demo 1', country: 'Colombia', tier: 'ORO',       linea: 'BHS' },
  { id: 2, name: 'Empresa Demo 2', country: 'México',   tier: 'MONITOREO', linea: 'BHS' },
  { id: 3, name: 'Empresa Demo 3', country: 'Chile',    tier: '',          linea: 'Intralogística' },
  { id: 4, name: 'Empresa Demo 4', country: 'Colombia', tier: 'ORO',       linea: 'Intralogística' },
  { id: 5, name: 'Empresa Demo 5', country: 'Perú',     tier: '',          linea: 'Cartón' },
  { id: 6, name: 'Empresa Demo 6', country: 'Colombia', tier: 'MONITOREO', linea: 'Final de Línea' },
  { id: 7, name: 'Empresa Demo 7', country: 'México',   tier: '',          linea: 'Motos' },
  { id: 8, name: 'Empresa Demo 8', country: 'Colombia', tier: 'ORO',       linea: 'SOLUMAT' },
];

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

// Maps sub-line DB code → parent line DB code.
// Used by the mock fallback to resolve which sub-lines belong under a parent.
// Extend this when new sub-lines are added to LINE_FILTER.
const MOCK_PARENT_MAP: Record<string, string> = {
  'final_linea':         'carton_papel',
  'ensambladoras_motos': 'intralogistica',
  'solumat':             'carton_papel',
};

export async function GET(req: NextRequest) {
  // Return mock data when Supabase is not configured (local dev without DB).
  // Auth is skipped on this path — mock data is not sensitive.
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const lineaParam = decodeURIComponent(req.nextUrl.searchParams.get('linea') ?? '');
    const q          = req.nextUrl.searchParams.get('q')?.toLowerCase();
    let mock: typeof MOCK_COMPANIES;
    if (!lineaParam || lineaParam === 'ALL') {
      mock = MOCK_COMPANIES;
    } else {
      const mapping = LINE_FILTER[lineaParam];
      if (mapping?.type === 'parent') {
        // For a parent line, include all mock companies whose linea matches any
        // entry in LINE_FILTER that shares the same parent code, plus the
        // parent label itself. Since mock data uses UI labels as linea values,
        // we collect all UI labels whose LINE_FILTER code starts with the
        // parent code prefix (or equals it), then also include exact matches.
        // Simplest correct approach: include the parent label and every label
        // whose LINE_FILTER type is 'sub' and whose parent is this parent code.
        // Because mock data only has top-level labels we fall back to exact match
        // for sub entries, but always include the parent label.
        const parentCode = mapping.code;
        const matchingLabels = Object.entries(LINE_FILTER)
          .filter(([, v]) => v.code === parentCode || (v.type === 'sub' && MOCK_PARENT_MAP[v.code] === parentCode))
          .map(([label]) => label);
        mock = MOCK_COMPANIES.filter(c => matchingLabels.includes(c.linea));
      } else {
        // sub-line or unknown: exact label match
        mock = MOCK_COMPANIES.filter(c => c.linea === lineaParam);
      }
    }
    if (q) mock = mock.filter(c => c.name.toLowerCase().includes(q));
    return NextResponse.json(mock.map(({ linea: _l, ...rest }) => rest));
  }

  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  // Decode URI encoding (e.g. 'BHS%2CCart%C3%B3n' → 'BHS,Cartón') then split on comma
  const lineaRaw = searchParams.get('linea') ?? '';
  const lineaDecoded = decodeURIComponent(lineaRaw);
  const limit  = Math.min(Number(searchParams.get('limit') ?? 200), 500);
  const search = searchParams.get('q');

  const where: string[] = [];

  if (lineaDecoded && lineaDecoded !== 'ALL') {
    // Support comma-separated multi-line values (e.g. 'BHS,Cartón')
    const lines = lineaDecoded.split(',').map(l => l.trim()).filter(Boolean);
    const lineConditions: string[] = [];
    for (const line of lines) {
      const mapping = LINE_FILTER[line];
      if (mapping) {
        if (mapping.type === 'parent') {
          lineConditions.push(`EXISTS (
            SELECT 1 FROM ${S}.empresa_sub_lineas esl
            JOIN ${S}.sub_lineas_negocio sl ON sl.id = esl.sub_linea_id
            JOIN ${S}.lineas_negocio ln ON ln.id = sl.linea_id
            WHERE esl.empresa_id = e.id
              AND ln.codigo = ${pgLit(mapping.code)}
          )`);
        } else {
          lineConditions.push(`EXISTS (
            SELECT 1 FROM ${S}.empresa_sub_lineas esl
            JOIN ${S}.sub_lineas_negocio sl ON sl.id = esl.sub_linea_id
            WHERE esl.empresa_id = e.id
              AND sl.codigo = ${pgLit(mapping.code)}
          )`);
        }
      } else {
        // Fallback: ILIKE on sub-line name
        lineConditions.push(`EXISTS (
          SELECT 1 FROM ${S}.empresa_sub_lineas esl
          JOIN ${S}.sub_lineas_negocio sl ON sl.id = esl.sub_linea_id
          WHERE esl.empresa_id = e.id
            AND sl.nombre ILIKE ${pgLit('%' + line + '%')}
        )`);
      }
    }
    if (lineConditions.length === 1) {
      where.push(lineConditions[0]);
    } else if (lineConditions.length > 1) {
      where.push(`(${lineConditions.join(' OR ')})`);
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
    const msg   = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? (err.stack ?? '') : '';
    console.error('[/api/comercial/companies] DB query failed:', msg);
    if (stack) console.error('[/api/comercial/companies] Stack:', stack);
    return NextResponse.json({ error: 'Error fetching companies' }, { status: 500 });
  }
}
