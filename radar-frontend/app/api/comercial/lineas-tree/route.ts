import { NextResponse } from 'next/server';
import { pgQuery, SCHEMA } from '@/lib/db/supabase/pg_client';

export interface SubLineaItem {
  id:          number | null;
  value:       string;
  label:       string;
  description: string;
}

export interface ParentLineaItem {
  id:          number | null;
  code:        string;
  label:       string;
  description: string;
  subLineas:   SubLineaItem[];
}

// Static fallback tree — sourced from LINE_FILTER in companies/route.ts and CLAUDE.md.
// Used when Supabase is not configured (local dev).
const FALLBACK_TREE: ParentLineaItem[] = [
  {
    id:          null,
    code:        'bhs',
    label:       'BHS',
    description: 'Aeropuertos y terminales',
    subLineas: [
      { id: null, value: 'BHS', label: 'BHS', description: 'Terminales, carruseles, sorters' },
    ],
  },
  {
    id:          null,
    code:        'intralogistica',
    label:       'Intralogística',
    description: 'CEDI, WMS, Supply Chain',
    subLineas: [
      { id: null, value: 'Intralogística', label: 'Intralogística', description: 'CEDI, WMS, Supply Chain' },
      { id: null, value: 'Motos',          label: 'Motos',          description: 'Ensambladoras, motocicletas' },
    ],
  },
  {
    id:          null,
    code:        'carton_papel',
    label:       'Cartón',
    description: 'Corrugado, Empaque',
    subLineas: [
      { id: null, value: 'Cartón',         label: 'Cartón',         description: 'Corrugadoras, empaque' },
      { id: null, value: 'Final de Línea', label: 'Final de Línea', description: 'Alimentos, bebidas' },
      { id: null, value: 'SOLUMAT',        label: 'Solumat',        description: 'Plásticos, materiales' },
    ],
  },
];

interface LineasTreeRow {
  parent_id:          number;
  parent_codigo:      string;
  parent_nombre:      string;
  parent_descripcion: string | null;
  sub_id:             number | null;
  sub_nombre:         string | null;
  sub_codigo:         string | null;
  sub_descripcion:    string | null;
}

export async function GET() {
  // Líneas tree is reference/config data — not sensitive.
  // No auth guard; individual sensitive routes (companies, calificar) still require auth.
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(FALLBACK_TREE);
  }

  const S = SCHEMA;

  try {
    const rows = await pgQuery<LineasTreeRow>(`
      SELECT
        ln.id          AS parent_id,
        ln.codigo      AS parent_codigo,
        ln.nombre      AS parent_nombre,
        ln.descripcion AS parent_descripcion,
        sl.id          AS sub_id,
        sl.nombre      AS sub_nombre,
        sl.codigo      AS sub_codigo,
        sl.descripcion AS sub_descripcion
      FROM ${S}.lineas_negocio ln
      LEFT JOIN ${S}.sub_lineas_negocio sl ON sl.linea_id = ln.id
      ORDER BY ln.orden ASC NULLS LAST, ln.id ASC, sl.orden ASC NULLS LAST, sl.id ASC
    `);

    // Group rows into the ParentLineaItem tree structure.
    const parentMap = new Map<number, ParentLineaItem>();

    for (const row of rows) {
      if (!parentMap.has(row.parent_id)) {
        parentMap.set(row.parent_id, {
          id:          row.parent_id,
          code:        row.parent_codigo,
          label:       row.parent_nombre,
          description: row.parent_descripcion ?? '',
          subLineas:   [],
        });
      }

      if (row.sub_id !== null && row.sub_nombre !== null) {
        const parent = parentMap.get(row.parent_id)!;
        parent.subLineas.push({
          id:          row.sub_id,
          value:       row.sub_nombre,
          label:       row.sub_nombre,
          description: row.sub_descripcion ?? '',
        });
      }
    }

    return NextResponse.json(Array.from(parentMap.values()));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: 'Error fetching lineas tree', detail: msg },
      { status: 500 },
    );
  }
}
