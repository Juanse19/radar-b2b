// lib/db/supabase/catalogos.ts
import 'server-only';
import { pgQuery, pgFirst, pgLit, SCHEMA } from './pg_client';
import type { SectorRow, JobTitleRow, ConfiguracionScoringRow } from '../types';

const S = SCHEMA;

export async function getSectores(activos = true): Promise<SectorRow[]> {
  const where = activos ? 'WHERE activo = TRUE' : '';
  return pgQuery<SectorRow>(`SELECT * FROM ${S}.sectores ${where} ORDER BY nombre`);
}

export async function getJobTitlesByLinea(subLineaId: number): Promise<JobTitleRow[]> {
  return pgQuery<JobTitleRow>(
    `SELECT * FROM ${S}.job_titles_por_linea
     WHERE sub_linea_id = ${pgLit(subLineaId)} AND activo = TRUE
     ORDER BY prioridad, nivel, titulo`
  );
}

export async function getJobTitlesAll(): Promise<JobTitleRow[]> {
  return pgQuery<JobTitleRow>(
    `SELECT * FROM ${S}.job_titles_por_linea
     WHERE activo = TRUE ORDER BY sub_linea_id, prioridad, nivel`
  );
}

export async function upsertJobTitlesBulk(
  subLineaId: number,
  titulos: Array<{ titulo: string; nivel: number; idioma?: string; prioridad?: number }>,
): Promise<{ inserted: number; updated: number }> {
  let inserted = 0;
  for (const t of titulos) {
    const idioma   = t.idioma   ?? 'es';
    const prioridad = t.prioridad ?? 2;
    await pgQuery(
      `INSERT INTO ${S}.job_titles_por_linea (sub_linea_id, titulo, nivel, idioma, prioridad, activo)
       VALUES (${pgLit(subLineaId)}, ${pgLit(t.titulo)}, ${pgLit(t.nivel)}, ${pgLit(idioma)}, ${pgLit(prioridad)}, TRUE)
       ON CONFLICT (sub_linea_id, titulo, idioma) DO UPDATE
         SET nivel = EXCLUDED.nivel, prioridad = EXCLUDED.prioridad, activo = TRUE`
    );
    inserted++;
  }
  return { inserted, updated: 0 };
}

export async function getConfiguracionScoring(subLineaId?: number | null): Promise<ConfiguracionScoringRow[]> {
  const today = new Date().toISOString().split('T')[0];
  const where: string[] = [
    `vigente_desde <= ${pgLit(today)}`,
    `(vigente_hasta IS NULL OR vigente_hasta >= ${pgLit(today)})`,
  ];

  if (subLineaId === null) {
    where.push('sub_linea_id IS NULL');
  } else if (subLineaId !== undefined) {
    where.push(`(sub_linea_id = ${pgLit(subLineaId)} OR sub_linea_id IS NULL)`);
  }

  return pgQuery<ConfiguracionScoringRow>(
    `SELECT * FROM ${S}.configuracion_scoring
     WHERE ${where.join(' AND ')}
     ORDER BY vigente_desde DESC`
  );
}

export async function upsertConfiguracionScoring(
  rows: Array<{ sub_linea_id?: number | null; dimension: string; peso: number; vigente_desde?: string }>,
): Promise<ConfiguracionScoringRow[]> {
  const today = new Date().toISOString().split('T')[0];
  const result: ConfiguracionScoringRow[] = [];
  for (const r of rows) {
    const [row] = await pgQuery<ConfiguracionScoringRow>(
      `INSERT INTO ${S}.configuracion_scoring (sub_linea_id, dimension, peso, vigente_desde)
       VALUES (${pgLit(r.sub_linea_id ?? null)}, ${pgLit(r.dimension)}, ${pgLit(r.peso)}, ${pgLit(r.vigente_desde ?? today)})
       ON CONFLICT (sub_linea_id, dimension, vigente_desde) DO UPDATE SET peso = EXCLUDED.peso
       RETURNING *`
    );
    if (row) result.push(row);
  }
  return result;
}

export async function getPesosVigentes(subLineaId?: number): Promise<Record<string, number>> {
  const rows = await getConfiguracionScoring(subLineaId ?? null);
  const pesos: Record<string, number> = {};
  for (const r of rows) {
    if (!(r.dimension in pesos) || r.sub_linea_id !== null) {
      pesos[r.dimension] = r.peso;
    }
  }
  return pesos;
}
