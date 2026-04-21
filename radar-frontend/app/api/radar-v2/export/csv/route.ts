import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { pgQuery, pgLit, SCHEMA } from '@/lib/db/supabase/pg_client';

const S = SCHEMA;

const CSV_HEADERS = [
  'empresa',
  'pais',
  'linea_negocio',
  'radar_activo',
  'score_radar',
  'criterios_cumplidos',
  'resumen',
  'created_at',
] as const;

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // Wrap in quotes if the value contains a comma, quote, or newline
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const linea       = searchParams.get('linea')        ?? '';
  const radarActivo = searchParams.get('radar_activo') ?? '';
  const ventana     = searchParams.get('ventana')      ?? '';
  const from        = searchParams.get('from')         ?? '';
  const to          = searchParams.get('to')           ?? '';

  const where: string[] = [];
  if (linea)       where.push(`linea_negocio = ${pgLit(linea)}`);
  if (radarActivo) where.push(`radar_activo = ${pgLit(radarActivo)}`);
  if (ventana)     where.push(`ventana_compra = ${pgLit(ventana)}`);
  if (from)        where.push(`created_at >= ${pgLit(from)}`);
  if (to)          where.push(`created_at <= ${pgLit(to)}`);

  try {
    type Row = {
      empresa_evaluada:    string;
      pais:                string | null;
      linea_negocio:       string | null;
      radar_activo:        string;
      score_radar:         number | null;
      criterios_cumplidos: unknown;
      descripcion_resumen: string | null;
      created_at:          string;
    };

    const rows = await pgQuery<Row>(
      `SELECT
         empresa_evaluada,
         pais,
         linea_negocio,
         radar_activo,
         total_criterios  AS score_radar,
         criterios_cumplidos,
         descripcion_resumen,
         created_at
       FROM ${S}.radar_v2_results
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY created_at DESC
       LIMIT 5000`,
    );

    const csvRows: string[] = [CSV_HEADERS.join(',')];
    for (const r of rows) {
      const criterios = Array.isArray(r.criterios_cumplidos)
        ? (r.criterios_cumplidos as string[]).join('; ')
        : String(r.criterios_cumplidos ?? '');
      csvRows.push([
        escapeCSV(r.empresa_evaluada),
        escapeCSV(r.pais),
        escapeCSV(r.linea_negocio),
        escapeCSV(r.radar_activo),
        escapeCSV(r.score_radar),
        escapeCSV(criterios),
        escapeCSV(r.descripcion_resumen),
        escapeCSV(r.created_at),
      ].join(','));
    }

    const csv = csvRows.join('\n');
    const filename = `radar-v2-resultados-${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type':        'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control':       'no-store',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[/api/radar-v2/export/csv] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
