/**
 * rag-pgvector.ts — Reemplazo de Pinecone basado en Supabase pgvector (v5).
 *
 * Provee el mismo contrato `retrieveContextPgvector()` y `upsertSignalEmbedding()`
 * que el adapter Pinecone, pero usa las funciones SQL `match_signals` y
 * `match_empresa_by_name` definidas en la migración 20260427_001.
 *
 * Toggle: si `RAG_BACKEND=pgvector` se prefiere esta implementación;
 * caer back a Pinecone si las RPCs aún no existen.
 */
import 'server-only';
import { pgQuery, pgLit, SCHEMA } from '@/lib/db/supabase/pg_client';
import { embed } from './rag';

const S = SCHEMA;

export interface PgvectorMatch {
  id:             string;
  empresa_nombre: string;
  descripcion:    string | null;
  linea_negocio:  string | null;
  pais:           string | null;
  similarity:     number;
}

export async function matchSignalsPgvector(
  text: string,
  threshold = 0.75,
  limit = 5,
): Promise<PgvectorMatch[]> {
  let vector: number[];
  try {
    vector = await embed(text, 'query');
  } catch (err) {
    console.warn('[rag-pgvector] embed failed, returning empty:', err);
    return [];
  }

  // PostgreSQL accepts vector as a string '[v1,v2,...]'
  const vectorLit = `'[${vector.join(',')}]'::vector`;

  try {
    const rows = await pgQuery<PgvectorMatch>(`
      SELECT id::text AS id, empresa_nombre, descripcion, linea_negocio, pais, similarity
      FROM ${S}.match_signals(
        ${vectorLit},
        ${pgLit(threshold)},
        ${pgLit(limit)}
      )
    `);
    return rows;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('does not exist') || msg.includes('relation')) {
      console.warn('[rag-pgvector] match_signals not yet available — fallback empty');
      return [];
    }
    throw err;
  }
}

/**
 * Update embedding for a previously-inserted radar_signals row.
 * Best-effort — silently logs and returns on failure.
 */
export async function updateSignalEmbedding(signalId: string, text: string): Promise<void> {
  try {
    const vector = await embed(text, 'passage');
    const vectorLit = `'[${vector.join(',')}]'::vector`;
    await pgQuery(`
      UPDATE ${S}.radar_signals
      SET embedding = ${vectorLit}
      WHERE id = ${pgLit(signalId)}
    `);
  } catch (err) {
    console.warn('[rag-pgvector] updateSignalEmbedding failed:', err);
  }
}

/**
 * Build a brief RAG context block from pgvector matches — same shape as the
 * Pinecone-based `buildRagBlock` so callers are interchangeable.
 */
export function buildPgvectorRagBlock(matches: PgvectorMatch[]): string {
  if (matches.length === 0) return '';
  const lines = matches.map(
    (m, i) =>
      `${i + 1}. ${m.empresa_nombre} (${m.pais ?? '—'}, ${m.linea_negocio ?? '—'}, ` +
      `similitud=${(m.similarity * 100).toFixed(0)}%): ${m.descripcion?.slice(0, 240) ?? '—'}`,
  );
  return `Señales similares ya conocidas (RAG · pgvector):\n${lines.join('\n')}`;
}

/**
 * Default switch: `RAG_BACKEND=pgvector` → use the new path; otherwise legacy.
 * Callers should typically use this rather than referencing the impl directly.
 */
export function isRagPgvectorEnabled(): boolean {
  return process.env.RAG_BACKEND === 'pgvector';
}
