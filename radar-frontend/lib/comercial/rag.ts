/**
 * rag.ts — Pinecone RAG client for Comercial module.
 * Embeddings: OpenAI text-embedding-3-small (1536 dims, matches matec-radar index).
 * Graceful degradation: missing PINECONE_API_KEY or OPENAI_API_KEY → empty context.
 */
import 'server-only';
import { Pinecone } from '@pinecone-database/pinecone';
import { pgQuery, pgLit, SCHEMA } from '@/lib/db/supabase/pg_client';
import type { Agente1Result } from '@/lib/comercial/schema';

const S                  = SCHEMA;
const DEFAULT_INDEX      = 'matec-radar';
const DEFAULT_NAMESPACE  = 'comercial_dev';
const DEFAULT_MODEL      = 'text-embedding-3-small';

// ---------------------------------------------------------------------------
// Internal metadata shape stored in Pinecone
// (plain interface — cast to RecordMetadata at SDK call sites)
// ---------------------------------------------------------------------------

interface RadarMetadata {
  tipo:            string;
  empresa?:        string;
  pais?:           string;
  linea?:          string;
  radar_activo?:   string;
  tipo_senal?:     string;
  ventana_compra?: string;
  monto?:          string;
  fuente?:         string;
  fecha?:          string;
  session_id?:     string;
  text?:           string;
  [key: string]:   string | number | boolean | string[] | undefined;
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface RagMatch {
  id:        string;
  score?:    number;
  metadata?: RadarMetadata;
}

export interface RagContext {
  similares: RagMatch[];
  keywords:  RagMatch[];
  criterios: RagMatch[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pineconeConfig() {
  return {
    apiKey:    process.env.PINECONE_API_KEY ?? '',
    index:     process.env.PINECONE_INDEX        ?? DEFAULT_INDEX,
    namespace: process.env.PINECONE_NAMESPACE_COMERCIAL ?? DEFAULT_NAMESPACE,
  };
}

function embeddingModel() {
  return process.env.PINECONE_EMBEDDING_MODEL ?? DEFAULT_MODEL;
}

// ---------------------------------------------------------------------------
// embed — OpenAI text-embedding-3-small (1536 dims, matches matec-radar index)
// inputType ignored — OpenAI uses the same model for both query and passage.
// ---------------------------------------------------------------------------

export async function embed(
  text: string,
  _inputType: 'query' | 'passage' = 'query',
): Promise<number[]> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY not set');

  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method:  'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ model: embeddingModel(), input: text }),
  });
  if (!res.ok) throw new Error(`OpenAI embed HTTP ${res.status}`);
  const data = await res.json() as { data: Array<{ embedding: number[] }> };
  return data.data[0].embedding;
}

// ---------------------------------------------------------------------------
// retrieveContext — 3 parallel queries: señales históricas, keywords, criterios
// ---------------------------------------------------------------------------

export async function retrieveContext(empresa: string, linea: string): Promise<RagContext> {
  const { apiKey, index, namespace } = pineconeConfig();

  if (!apiKey || !process.env.OPENAI_API_KEY) {
    console.warn('[RAG] PINECONE_API_KEY or OPENAI_API_KEY not set — returning empty context');
    return { similares: [], keywords: [], criterios: [] };
  }

  const pc            = new Pinecone({ apiKey });
  const ns            = pc.index(index).namespace(namespace);
  const queryText     = `${empresa} ${linea} inversión CAPEX expansión señal LATAM`;
  const queryVector   = await embed(queryText, 'query');

  const toMatch = (m: { id: string; score?: number; metadata?: Record<string, unknown> }): RagMatch => ({
    id:       m.id,
    score:    m.score,
    metadata: m.metadata as RadarMetadata | undefined,
  });

  const [resSimil, resKw, resCrit] = await Promise.all([
    ns.query({ vector: queryVector, topK: 5, filter: { tipo: { $eq: 'senal_historica' } }, includeMetadata: true }),
    ns.query({ vector: queryVector, topK: 3, filter: { tipo: { $eq: 'keyword' } },         includeMetadata: true }),
    ns.query({ vector: queryVector, topK: 3, filter: { tipo: { $eq: 'criterio' } },        includeMetadata: true }),
  ]);

  return {
    similares: (resSimil.matches ?? []).map(toMatch),
    keywords:  (resKw.matches    ?? []).map(toMatch),
    criterios: (resCrit.matches  ?? []).map(toMatch),
  };
}

// ---------------------------------------------------------------------------
// upsertSenal — embed scan result and persist to Pinecone + ingest log
// ---------------------------------------------------------------------------

export async function upsertSenal(r: Agente1Result, sessionId: string): Promise<void> {
  const { apiKey, index, namespace } = pineconeConfig();

  if (!apiKey) {
    console.warn('[RAG] PINECONE_API_KEY not set — skipping upsert');
    return;
  }

  const text = [
    r.empresa_evaluada,
    r.linea_negocio ?? '',
    r.pais,
    r.descripcion_resumen,
    r.tipo_senal,
    r.ventana_compra,
    r.monto_inversion,
  ].filter(Boolean).join(' | ');

  const vector   = await embed(text, 'passage');
  const vectorId = crypto.randomUUID();
  const model    = embeddingModel();
  const sid      = sessionId && sessionId.trim() ? sessionId : null;

  const pc = new Pinecone({ apiKey });
  await pc.index(index).namespace(namespace).upsert([{
    id:     vectorId,
    values: vector,
    metadata: {
      tipo:           'senal_historica',
      empresa:        r.empresa_evaluada,
      pais:           r.pais,
      linea:          r.linea_negocio ?? '',
      radar_activo:   r.radar_activo,
      tipo_senal:     r.tipo_senal,
      ventana_compra: r.ventana_compra,
      monto:          r.monto_inversion,
      fuente:         r.fuente_nombre,
      fecha:          r.fecha_senal,
      session_id:     sid ?? '',
    },
  }]);

  await pgQuery(
    `INSERT INTO ${S}.radar_v2_rag_ingest_log
       (session_id, kind, vector_id, namespace, embedding_model, chunk_chars)
     VALUES
       (${pgLit(sid)}, 'senal', ${pgLit(vectorId)}, ${pgLit(namespace)}, ${pgLit(model)}, ${pgLit(text.length)})`
  );
}

// ---------------------------------------------------------------------------
// buildRagBlock — Markdown context block injected into Claude's user message
// ---------------------------------------------------------------------------

export function buildRagBlock(ctx: RagContext): string {
  if (!ctx.similares.length && !ctx.keywords.length && !ctx.criterios.length) return '';

  const lines: string[] = ['## Contexto histórico (RAG)\n'];

  if (ctx.similares.length > 0) {
    lines.push('### Señales similares detectadas previamente');
    for (const s of ctx.similares) {
      const m = s.metadata;
      if (!m) continue;
      lines.push(
        `- **${m.empresa ?? '?'}** (${m.pais ?? '?'}) — ${m.tipo_senal ?? '?'} — Ventana: ${m.ventana_compra ?? '?'} — Monto: ${m.monto ?? 'No reportado'} — Radar: ${m.radar_activo ?? '?'}`,
      );
    }
    lines.push('');
  }

  if (ctx.keywords.length > 0) {
    lines.push('### Keywords relevantes para esta línea');
    for (const k of ctx.keywords) {
      if (k.metadata?.text) lines.push(`- ${k.metadata.text}`);
    }
    lines.push('');
  }

  if (ctx.criterios.length > 0) {
    lines.push('### Criterios de evaluación aplicables');
    for (const c of ctx.criterios) {
      if (c.metadata?.text) lines.push(`- ${c.metadata.text}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
