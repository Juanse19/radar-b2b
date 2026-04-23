import 'server-only';
import { pgQuery, pgFirst, pgLit, SCHEMA } from '@/lib/db/supabase/pg_client';
import type { EmpresaRollup, EmpresaRollupCounts, EmpresaRollupFilter, TierLetter } from './types';

const S = SCHEMA;

export async function getEmpresaRollup(filter: EmpresaRollupFilter = {}): Promise<EmpresaRollup[]> {
  const { linea, tier, radar, search, limit = 50, offset = 0 } = filter;

  const conditions: string[] = [];
  if (linea)  conditions.push(`lr.linea_negocio = ${pgLit(linea)}`);
  if (tier)   conditions.push(`e.tier_actual::text = ${pgLit(tier)}`);
  if (radar)  conditions.push(`lr.radar_activo = ${pgLit(radar)}`);
  if (search) conditions.push(
    `(LOWER(COALESCE(e.company_name, lr.empresa_evaluada)) LIKE ${pgLit('%' + search.toLowerCase() + '%')})`
  );

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `
    WITH latest_radar AS (
      SELECT DISTINCT ON (COALESCE(empresa_id::text, LOWER(empresa_evaluada)))
        id, empresa_id, empresa_evaluada, pais, linea_negocio,
        radar_activo, tipo_senal, descripcion_resumen,
        ventana_compra, monto_inversion,
        fuente_link, fuente_nombre, fuente_verificada,
        session_id, created_at
      FROM ${S}.radar_v2_results
      ORDER BY COALESCE(empresa_id::text, LOWER(empresa_evaluada)), created_at DESC
    ),
    latest_calif AS (
      SELECT DISTINCT ON (empresa_id)
        empresa_id, score_total, tier_calculado, created_at
      FROM ${S}.calificaciones
      ORDER BY empresa_id, created_at DESC
    ),
    contactos_agg AS (
      SELECT empresa_id,
             COUNT(*)::int AS contactos_total,
             MAX(created_at) AS ultima_prospeccion_at
      FROM ${S}.contactos
      GROUP BY empresa_id
    ),
    scans_agg AS (
      SELECT COALESCE(empresa_id::text, LOWER(empresa_evaluada)) AS k,
             COUNT(*)::int AS scans_total
      FROM ${S}.radar_v2_results
      GROUP BY k
    ),
    rag_agg AS (
      SELECT NULL::text AS session_id, 0::int AS vectors_indexed
      WHERE FALSE
    )
    SELECT
      lr.empresa_id,
      lr.empresa_evaluada,
      COALESCE(e.company_name, lr.empresa_evaluada) AS company_name,
      COALESCE(e.pais::text, lr.pais)               AS pais,
      lr.linea_negocio,
      e.tier_actual::text                           AS tier_actual,
      lc.score_total                                AS calif_score,
      lc.tier_calculado                             AS calif_tier,
      lc.created_at                                 AS calif_at,
      lr.radar_activo,
      lr.tipo_senal,
      lr.descripcion_resumen,
      lr.ventana_compra,
      lr.monto_inversion,
      lr.fuente_nombre,
      lr.fuente_link,
      lr.fuente_verificada::text                    AS fuente_verificada,
      lr.created_at                                 AS radar_at,
      lr.session_id,
      COALESCE(ca.contactos_total, 0)               AS contactos_total,
      ca.ultima_prospeccion_at,
      COALESCE(sa.scans_total, 0)                   AS scans_total,
      COALESCE(ra.vectors_indexed, 0)               AS rag_vectors
    FROM latest_radar lr
    LEFT JOIN ${S}.empresas e
      ON e.id = lr.empresa_id
      OR (lr.empresa_id IS NULL
          AND LOWER(COALESCE(e.company_name, '')) = LOWER(lr.empresa_evaluada))
    LEFT JOIN latest_calif lc
      ON lc.empresa_id = e.id
    LEFT JOIN contactos_agg ca
      ON ca.empresa_id = e.id
    LEFT JOIN scans_agg sa
      ON sa.k = COALESCE(lr.empresa_id::text, LOWER(lr.empresa_evaluada))
    LEFT JOIN rag_agg ra
      ON ra.session_id = lr.session_id::text
    ${where}
    ORDER BY
      CASE e.tier_actual
        WHEN 'A' THEN 1 WHEN 'B' THEN 2 WHEN 'C' THEN 3 WHEN 'D' THEN 4 ELSE 5
      END,
      (lr.radar_activo = 'Sí') DESC,
      lc.score_total DESC NULLS LAST,
      lr.created_at DESC
    LIMIT ${pgLit(limit)} OFFSET ${pgLit(offset)}
  `;

  return pgQuery<EmpresaRollup>(sql);
}

export async function getEmpresaRollupCounts(filter: Pick<EmpresaRollupFilter, 'linea' | 'radar'> = {}): Promise<EmpresaRollupCounts> {
  const { linea, radar } = filter;

  const conditions: string[] = [];
  if (linea) conditions.push(`lr.linea_negocio = ${pgLit(linea)}`);
  if (radar) conditions.push(`lr.radar_activo = ${pgLit(radar)}`);
  const where = conditions.length ? `AND ${conditions.join(' AND ')}` : '';

  const sql = `
    WITH latest_radar AS (
      SELECT DISTINCT ON (COALESCE(empresa_id::text, LOWER(empresa_evaluada)))
        empresa_id, empresa_evaluada, linea_negocio, radar_activo, created_at
      FROM ${S}.radar_v2_results
      ORDER BY COALESCE(empresa_id::text, LOWER(empresa_evaluada)), created_at DESC
    )
    SELECT
      COUNT(*)::int                               AS total,
      COUNT(*) FILTER (WHERE lr.radar_activo = 'Sí')::int AS con_radar,
      COUNT(*) FILTER (WHERE e.tier_actual::text = 'A')::int AS tier_a,
      COUNT(*) FILTER (WHERE e.tier_actual::text = 'B')::int AS tier_b,
      COUNT(*) FILTER (WHERE e.tier_actual::text = 'C')::int AS tier_c,
      COUNT(*) FILTER (WHERE e.tier_actual::text = 'D')::int AS tier_d,
      COUNT(*) FILTER (WHERE e.tier_actual IS NULL)::int     AS tier_null
    FROM latest_radar lr
    LEFT JOIN ${S}.empresas e
      ON e.id = lr.empresa_id
      OR (lr.empresa_id IS NULL
          AND LOWER(COALESCE(e.company_name, '')) = LOWER(lr.empresa_evaluada))
    WHERE 1=1 ${where}
  `;

  const row = await pgFirst<{
    total: number; con_radar: number;
    tier_a: number; tier_b: number; tier_c: number; tier_d: number; tier_null: number;
  }>(sql);

  if (!row) return { total: 0, por_tier: { A: 0, B: 0, C: 0, D: 0, sin_calificar: 0, null: 0 }, con_radar: 0 };

  return {
    total:    row.total,
    con_radar: row.con_radar,
    por_tier: {
      A:             row.tier_a,
      B:             row.tier_b,
      C:             row.tier_c,
      D:             row.tier_d,
      sin_calificar: row.tier_null,
      null:          row.tier_null,
    },
  };
}

export async function getEmpresaTimeline(empresaId: number, limit = 20): Promise<Array<{
  id: string; type: string; title: string; subtitle: string | null; score: number | null; tier: string | null; created_at: string;
}>> {
  const sql = `
    SELECT id::text                   AS id,
           'radar'                    AS type,
           empresa_evaluada           AS title,
           tipo_senal                 AS subtitle,
           NULL::numeric              AS score,
           NULL::text                 AS tier,
           created_at
    FROM ${S}.radar_v2_results
    WHERE empresa_id = ${pgLit(empresaId)}

    UNION ALL

    SELECT c.id::text                 AS id,
           'calificacion'             AS type,
           e.company_name             AS title,
           tier_calculado::text       AS subtitle,
           score_total                AS score,
           tier_calculado::text       AS tier,
           c.created_at
    FROM ${S}.calificaciones c
    JOIN ${S}.empresas e ON e.id = c.empresa_id
    WHERE c.empresa_id = ${pgLit(empresaId)}

    UNION ALL

    SELECT empresa_id::text || '_contactos' AS id,
           'contactos'                      AS type,
           'Prospectos obtenidos'           AS title,
           NULL::text                       AS subtitle,
           COUNT(*)::numeric                AS score,
           NULL::text                       AS tier,
           MAX(created_at)                  AS created_at
    FROM ${S}.contactos
    WHERE empresa_id = ${pgLit(empresaId)}
    GROUP BY empresa_id

    ORDER BY created_at DESC
    LIMIT ${pgLit(limit)}
  `;

  return pgQuery(sql);
}
