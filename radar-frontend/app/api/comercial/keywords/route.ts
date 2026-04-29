import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { pgQuery, pgLit, SCHEMA } from '@/lib/db/supabase/pg_client';

const S = SCHEMA;

interface KeywordResult {
  id:              number;
  sub_linea_nombre: string;
  palabra:         string;
  tipo:            string;
  peso:            number;
}

// Sub-line name → id mapping (from DB)
const SUB_LINEA_IDS: Record<string, number> = {
  'Aeropuertos':           1,
  'Cargo / ULD':           2,
  'Cartón Corrugado':      3,
  'Final de Línea':        4,
  'Ensambladoras de Motos': 5,
  'Solumat':               6,
  'Logística':             9,
};

// Line key → sub-line names mapping (mirrors LINEAS_CONFIG)
const LINEA_TO_SUBLINEAS: Record<string, string[]> = {
  BHS:            ['Aeropuertos', 'Cargo / ULD'],
  Cartón:         ['Cartón Corrugado'],
  Intralogística: ['Final de Línea', 'Ensambladoras de Motos', 'Solumat', 'Logística'],
};

export async function GET(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const sublinea = searchParams.get('sublinea');
  const linea    = searchParams.get('linea');

  // Determine which sub_linea_ids to query
  let sublineaIds: number[] = [];

  if (sublinea) {
    const id = SUB_LINEA_IDS[sublinea];
    if (id !== undefined) sublineaIds = [id];
  } else if (linea && linea !== 'ALL') {
    const names = LINEA_TO_SUBLINEAS[linea] ?? [];
    sublineaIds = names
      .map((n) => SUB_LINEA_IDS[n])
      .filter((id): id is number => id !== undefined);
  }

  if (sublineaIds.length === 0) {
    return NextResponse.json([] as KeywordResult[]);
  }

  const idList = sublineaIds.map((id) => pgLit(id)).join(', ');

  try {
    const rows = await pgQuery<KeywordResult>(`
      SELECT
        pc.id,
        sl.nombre  AS sub_linea_nombre,
        pc.palabra,
        pc.tipo,
        pc.peso
      FROM ${S}.palabras_clave_por_linea pc
      JOIN ${S}.sub_lineas_negocio sl ON sl.id = pc.sub_linea_id
      WHERE pc.activo   = TRUE
        AND pc.tipo    != 'exclusion'
        AND pc.sub_linea_id IN (${idList})
      ORDER BY pc.peso DESC, pc.palabra
      LIMIT 50
    `);

    return NextResponse.json(rows);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[/api/comercial/keywords] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
