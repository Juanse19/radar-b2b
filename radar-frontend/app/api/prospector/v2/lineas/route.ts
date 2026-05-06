/**
 * GET /api/prospector/v2/lineas — árbol de líneas → sub-líneas
 * desde matec_radar.lineas_negocio + matec_radar.sub_lineas_negocio.
 *
 * Lo consume el wizard Step 1 para renderizar el selector cascada.
 */
import { type NextRequest } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { getLineasTree } from '@/lib/prospector/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface SubLineaDto {
  codigo:      string;
  nombre:      string;
  id:          number;
  descripcion: string | null;
}

interface LineaDto {
  codigo:    string;
  nombre:    string;
  color_hex: string | null;
  sublineas: SubLineaDto[];
}

export async function GET(_req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const rows = await getLineasTree();
    const grouped = new Map<string, LineaDto>();

    for (const r of rows) {
      let group = grouped.get(r.linea_codigo);
      if (!group) {
        group = {
          codigo:    r.linea_codigo,
          nombre:    r.linea_nombre,
          color_hex: r.color_hex,
          sublineas: [],
        };
        grouped.set(r.linea_codigo, group);
      }
      group.sublineas.push({
        codigo:      r.sublinea_codigo,
        nombre:      r.sublinea_nombre,
        id:          r.sublinea_id,
        descripcion: r.descripcion,
      });
    }

    return Response.json({
      success: true,
      data:    Array.from(grouped.values()),
    });
  } catch (err) {
    console.error('[prospector v2 lineas]', err);
    return Response.json({
      success: false,
      error:   err instanceof Error ? err.message : 'Failed to load lineas tree',
    }, { status: 500 });
  }
}
