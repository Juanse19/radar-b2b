// lib/db/supabase/keywords.ts
// Queries para palabras_clave_por_linea — Sprint A.3
import 'server-only';
import { pgQuery, pgLit, SCHEMA } from './pg_client';

const S = SCHEMA;

export interface KeywordRow {
  id:           number;
  sub_linea_id: number;
  sub_linea_nombre?: string;
  palabra:      string;
  idioma:       string;
  tipo:         string;   // 'senal' | 'producto' | 'sector' | 'exclusion'
  peso:         number;   // -5 a +5
  activo:       boolean;
  created_at:   string;
}

export interface KeywordInput {
  sub_linea_id: number;
  palabra:      string;
  idioma?:      string;
  tipo:         string;
  peso:         number;
}

// ── Queries ──────────────────────────────────────────────────────────────────

export async function getKeywords(subLineaId?: number): Promise<KeywordRow[]> {
  const whereLinea = subLineaId ? `AND pc.sub_linea_id = ${pgLit(subLineaId)}` : '';
  return pgQuery<KeywordRow>(`
    SELECT
      pc.id,
      pc.sub_linea_id,
      sl.nombre  AS sub_linea_nombre,
      pc.palabra,
      pc.idioma,
      pc.tipo,
      pc.peso,
      pc.activo,
      pc.created_at
    FROM ${S}.palabras_clave_por_linea pc
    JOIN ${S}.sub_lineas_negocio sl ON sl.id = pc.sub_linea_id
    WHERE pc.activo = TRUE ${whereLinea}
    ORDER BY sl.orden, pc.peso DESC, pc.palabra
  `);
}

export async function getKeywordsForRadar(subLineaId: number): Promise<KeywordRow[]> {
  // Solo keywords tipo senal/capex/licitacion para WF02
  return pgQuery<KeywordRow>(`
    SELECT id, sub_linea_id, palabra, idioma, tipo, peso, activo, created_at
    FROM ${S}.palabras_clave_por_linea
    WHERE sub_linea_id = ${pgLit(subLineaId)}
      AND activo = TRUE
      AND tipo IN ('senal', 'sector')
      AND peso >= 1
    ORDER BY peso DESC, palabra
  `);
}

export async function createKeyword(input: KeywordInput): Promise<KeywordRow> {
  const rows = await pgQuery<KeywordRow>(`
    INSERT INTO ${S}.palabras_clave_por_linea
      (sub_linea_id, palabra, idioma, tipo, peso, activo)
    VALUES
      (${pgLit(input.sub_linea_id)}, ${pgLit(input.palabra.trim())},
       ${pgLit(input.idioma ?? 'es')}, ${pgLit(input.tipo)}, ${pgLit(input.peso)}, TRUE)
    ON CONFLICT (sub_linea_id, palabra, idioma, tipo) DO UPDATE
      SET peso = EXCLUDED.peso, activo = TRUE
    RETURNING *
  `);
  return rows[0];
}

export async function updateKeyword(
  id: number,
  patch: Partial<Pick<KeywordRow, 'palabra' | 'tipo' | 'peso' | 'activo'>>,
): Promise<KeywordRow> {
  const sets: string[] = [];
  if (patch.palabra  !== undefined) sets.push(`palabra = ${pgLit(patch.palabra.trim())}`);
  if (patch.tipo     !== undefined) sets.push(`tipo    = ${pgLit(patch.tipo)}`);
  if (patch.peso     !== undefined) sets.push(`peso    = ${pgLit(patch.peso)}`);
  if (patch.activo   !== undefined) sets.push(`activo  = ${pgLit(patch.activo)}`);
  if (sets.length === 0) throw new Error('No hay campos para actualizar');

  const rows = await pgQuery<KeywordRow>(`
    UPDATE ${S}.palabras_clave_por_linea
    SET ${sets.join(', ')}
    WHERE id = ${pgLit(id)}
    RETURNING *
  `);
  if (!rows[0]) throw new Error(`Keyword id=${id} no encontrada`);
  return rows[0];
}

export async function deleteKeyword(id: number): Promise<void> {
  // Soft-delete: activo = FALSE
  await pgQuery(`
    UPDATE ${S}.palabras_clave_por_linea
    SET activo = FALSE
    WHERE id = ${pgLit(id)}
  `);
}
