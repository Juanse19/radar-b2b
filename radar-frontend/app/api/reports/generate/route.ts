/**
 * GET /api/reports/generate — Informe consolidado (v5).
 *
 * Devuelve la "vista Paola" — empresas + dimensiones TIER + señal radar +
 * fuentes. Formatos soportados:
 *   - csv  (default, UTF-8 BOM, Excel-friendly)
 *   - xlsx (Office Open XML, una hoja "Informe")
 *   - json (datos crudos + headers para preview UI)
 *
 * Querystring:
 *   ?linea=...&sublinea=...&tier=...&pais=...&radar=true|false
 *   &formato=csv|xlsx|json
 */
import 'server-only';
import { NextRequest } from 'next/server';
import { pgQuery, pgLit, SCHEMA } from '@/lib/db/supabase/pg_client';
import * as XLSX from 'xlsx';

const S = SCHEMA;

interface ReportRow {
  empresa: string;
  pais: string | null;
  linea: string | null;
  sub_linea: string | null;
  tier: string;
  score_total: number | null;
  score_radar: number | null;
  composite: number | null;
  // 7 dimensiones (last calificación)
  d_impacto: number | null;
  d_multiplanta: number | null;
  d_recurrencia: number | null;
  d_referente: number | null;
  d_anio: number | null;
  d_ticket: number | null;
  d_prioridad: number | null;
  // Señal
  senal_activa: string;
  tipo_senal: string | null;
  ventana_compra: string | null;
  monto_inversion: string | null;
  fuentes: string | null;
  fecha_senal: string | null;
}

const HEADERS: Array<[keyof ReportRow, string]> = [
  ['empresa',         'Empresa'],
  ['pais',            'País'],
  ['linea',           'Línea'],
  ['sub_linea',       'Sub-línea'],
  ['tier',            'TIER'],
  ['score_total',     'Score TIER'],
  ['d_impacto',       'D1 · Impacto presupuesto'],
  ['d_multiplanta',   'D2 · Multiplanta'],
  ['d_recurrencia',   'D3 · Recurrencia'],
  ['d_referente',     'D4 · Referente mercado'],
  ['d_anio',          'D5 · Año objetivo'],
  ['d_ticket',        'D6 · Ticket estimado'],
  ['d_prioridad',     'D7 · Prioridad comercial'],
  ['score_radar',     'Score Radar'],
  ['composite',       'Composite'],
  ['senal_activa',    'Señal'],
  ['tipo_senal',      'Tipo señal'],
  ['ventana_compra',  'Ventana de compra'],
  ['monto_inversion', 'Monto'],
  ['fuentes',         'Fuentes'],
  ['fecha_senal',     'Fecha señal'],
];

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replaceAll('"', '""')}"`;
  }
  return s;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const linea    = sp.get('linea')    ?? undefined;
  const sublinea = sp.get('sublinea') ?? undefined;
  const tier     = sp.get('tier')     ?? undefined;
  const pais     = sp.get('pais')     ?? undefined;
  const radar    = sp.get('radar');
  const formato  = sp.get('formato') ?? 'csv';

  const where: string[] = [];
  if (linea)    where.push(`(meta->>'linea' = ${pgLit(linea)} OR EXISTS (SELECT 1 FROM ${S}.sub_lineas_negocio sl WHERE sl.id = e.sub_linea_principal_id AND sl.linea_negocio = ${pgLit(linea)}))`);
  if (sublinea) where.push(`meta->>'sub_linea' = ${pgLit(sublinea)}`);
  if (tier)     where.push(`tier_actual = ${pgLit(tier)}::${S}.tier_enum`);
  if (pais)     where.push(`(pais_nombre ILIKE ${pgLit('%' + pais + '%')} OR pais::text = ${pgLit(pais)})`);
  if (radar === 'true')  where.push(`radar_activo = 'activo'::${S}.radar_activo_enum`);
  if (radar === 'false') where.push(`radar_activo <> 'activo'::${S}.radar_activo_enum`);

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const baseSelect = `
    SELECT
      e.company_name                                        AS empresa,
      COALESCE(e.pais_nombre, e.pais::text)                 AS pais,
      meta->>'linea'                                         AS linea,
      meta->>'sub_linea'                                     AS sub_linea,
      e.tier_actual::text                                    AS tier,
      e.score_total_ultimo                                   AS score_total,
      e.score_radar_ultimo                                   AS score_radar,
      e.composite_score_ultimo                               AS composite,
      cal.score_impacto                                      AS d_impacto,
      cal.score_multiplanta                                  AS d_multiplanta,
      cal.score_recurrencia                                  AS d_recurrencia,
      cal.score_referente                                    AS d_referente,
      cal.score_anio                                         AS d_anio,
      cal.score_ticket                                       AS d_ticket,
      cal.score_prioridad                                    AS d_prioridad,
      CASE WHEN e.radar_activo = 'activo'::${S}.radar_activo_enum THEN 'Sí' ELSE 'No' END AS senal_activa`;

  const baseFrom = `
    FROM ${S}.empresas e
    LEFT JOIN LATERAL (
      SELECT * FROM ${S}.calificaciones c
      WHERE c.empresa_id = e.id
      ORDER BY c.created_at DESC LIMIT 1
    ) cal ON TRUE`;

  const orderBy = `
    ORDER BY
      CASE e.tier_actual::text WHEN 'A' THEN 0 WHEN 'B' THEN 1 WHEN 'C' THEN 2 ELSE 3 END,
      e.composite_score_ultimo DESC NULLS LAST`;

  // Modo "rico": JOIN con radar_signals (cuando la migración v5 está aplicada).
  // Si la tabla no existe (42P01), reintentamos sin el JOIN — el informe sale
  // sin las 4 columnas de señal en lugar de fallar 500.
  const richSql = `${baseSelect},
      rs.tipo_senal,
      rs.ventana_compra,
      rs.monto_inversion,
      (
        SELECT string_agg(f->>'nombre', ' | ')
        FROM jsonb_array_elements(COALESCE(rs.fuentes, '[]'::jsonb)) f
      ) AS fuentes,
      rs.created_at::text AS fecha_senal
    ${baseFrom}
    LEFT JOIN LATERAL (
      SELECT * FROM ${S}.radar_signals rsi
      WHERE rsi.empresa_id = e.id
      ORDER BY rsi.created_at DESC LIMIT 1
    ) rs ON TRUE
    ${whereClause}
    ${orderBy}`;

  const fallbackSql = `${baseSelect},
      NULL::text AS tipo_senal,
      NULL::text AS ventana_compra,
      NULL::text AS monto_inversion,
      NULL::text AS fuentes,
      NULL::text AS fecha_senal
    ${baseFrom}
    ${whereClause}
    ${orderBy}`;

  let rows: ReportRow[];
  try {
    rows = await pgQuery<ReportRow>(richSql);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('radar_signals') && (msg.includes('does not exist') || msg.includes('42P01'))) {
      console.warn('[reports/generate] radar_signals missing — using fallback query');
      rows = await pgQuery<ReportRow>(fallbackSql);
    } else {
      throw err;
    }
  }

  if (formato === 'json') {
    return Response.json({ data: rows, headers: HEADERS });
  }

  const dateStamp = new Date().toISOString().slice(0, 10);

  if (formato === 'xlsx') {
    // Build sheet from rows + label headers, preserving column order
    const sheetData = [
      HEADERS.map(([, label]) => label),
      ...rows.map((r) => HEADERS.map(([k]) => r[k] ?? '')),
    ];
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    // Reasonable default column widths so the export opens nicely
    ws['!cols'] = HEADERS.map(([k]) =>
      k === 'empresa'   ? { wch: 32 }
      : k === 'fuentes' ? { wch: 32 }
      : k.startsWith('d_') ? { wch: 8 }
      : { wch: 14 },
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Informe');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    const filename = `informe_matec_${dateStamp}.xlsx`;

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control':       'no-store',
      },
    });
  }

  // CSV (default) — UTF-8 BOM para que Excel detecte acentos correctamente
  const lines = [
    '﻿' + HEADERS.map(([, label]) => csvEscape(label)).join(','),
    ...rows.map((r) => HEADERS.map(([k]) => csvEscape(r[k])).join(',')),
  ];

  const csv = lines.join('\n');
  const filename = `informe_matec_${dateStamp}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control':       'no-store',
    },
  });
}
