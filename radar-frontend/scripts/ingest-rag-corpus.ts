/**
 * scripts/ingest-rag-corpus.ts
 * Idempotent ingestion of RAG corpus markdown files into Pinecone.
 *
 * Usage:
 *   npx tsx scripts/ingest-rag-corpus.ts
 *
 * - Reads all .md files from lib/comercial/rag-corpus/
 * - Chunks to ~500 tokens (2000 chars) with 100-token (400 char) overlap
 * - Embeds each chunk via Voyage AI or OpenAI
 * - Upserts to Pinecone with deterministic id = sha256(chunk_text)
 * - Logs each vector to radar_v2_rag_ingest_log (session_id = NULL)
 * - Prints: "Ingest OK → N chunks, $X.XXX USD, namespace radar_v2"
 */

import * as fs   from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import * as dotenv from 'dotenv';
import { Pinecone } from '@pinecone-database/pinecone';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const CORPUS_DIR      = path.resolve(process.cwd(), 'lib/comercial/rag-corpus');
const CHUNK_CHARS     = 2000;  // ~500 tokens
const OVERLAP_CHARS   = 400;   // ~100 tokens overlap
const NAMESPACE       = process.env.PINECONE_NAMESPACE_COMERCIAL ?? 'radar_v2';
const INDEX_NAME      = process.env.PINECONE_INDEX        ?? 'matec-radar';
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL       ?? 'voyage-3';
const PROVIDER        = process.env.EMBEDDING_PROVIDER    ?? 'voyage';

// Cost per 1M tokens
const COST_PER_M: Record<string, number> = {
  'voyage-3':                0.06,
  'voyage-3-lite':           0.02,
  'text-embedding-3-small':  0.02,
  'text-embedding-3-large':  0.13,
};

// ---------------------------------------------------------------------------
// Determine chunk tipo from filename
// ---------------------------------------------------------------------------

function tipoFromFile(filename: string): string {
  const base = path.basename(filename, '.md');
  if (base === 'criterios')          return 'criterio';
  if (base === 'fuentes-confiables') return 'fuente_confiable';
  if (base.startsWith('keywords-'))  return 'keyword';
  return 'corpus';
}

function lineaFromFile(filename: string): string {
  const base = path.basename(filename, '.md');
  if (base === 'keywords-bhs')           return 'BHS';
  if (base === 'keywords-intralogistica')return 'Intralogística';
  if (base === 'keywords-carton')        return 'Cartón';
  return '';
}

// ---------------------------------------------------------------------------
// Chunker — splits text into overlapping windows
// ---------------------------------------------------------------------------

function chunkText(text: string, chunkSize: number, overlap: number): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end   = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end).trim();
    if (chunk.length > 50) chunks.push(chunk);  // skip tiny trailing chunks
    if (end >= text.length) break;
    start += chunkSize - overlap;
  }

  return chunks;
}

// ---------------------------------------------------------------------------
// Embed
// ---------------------------------------------------------------------------

async function embed(text: string): Promise<number[]> {
  if (PROVIDER === 'openai') {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error('OPENAI_API_KEY not set');

    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method:  'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ model: EMBEDDING_MODEL, input: text }),
    });
    if (!res.ok) throw new Error(`OpenAI embed HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json() as { data: Array<{ embedding: number[] }> };
    return data.data[0].embedding;
  }

  // Voyage AI (default)
  const key = process.env.VOYAGE_API_KEY;
  if (!key) throw new Error('VOYAGE_API_KEY not set');

  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method:  'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ model: EMBEDDING_MODEL, input: [text] }),
  });
  if (!res.ok) throw new Error(`Voyage AI embed HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json() as { data: Array<{ embedding: number[] }> };
  return data.data[0].embedding;
}

// ---------------------------------------------------------------------------
// pgQuery — direct HTTP to Supabase /pg/query (mirrors lib/db/supabase/pg_client.ts)
// ---------------------------------------------------------------------------

function pgLit(v: unknown): string {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'boolean')        return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'number')         return isFinite(v) ? String(v) : 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
}

async function pgQuery(sql: string): Promise<void> {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');

  const res = await fetch(`${url}/pg/query`, {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${key}`,
      apikey:          key,
      'Content-Type':  'application/json',
      'User-Agent':    'MatecRadarIngest/1.0',
    },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`pgQuery HTTP ${res.status}: ${text.slice(0, 400)}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const pineconeKey = process.env.PINECONE_API_KEY;
  if (!pineconeKey) {
    console.error('❌  PINECONE_API_KEY not set in .env.local');
    process.exit(1);
  }

  const pc    = new Pinecone({ apiKey: pineconeKey });
  const index = pc.index(INDEX_NAME).namespace(NAMESPACE);

  const files = fs.readdirSync(CORPUS_DIR).filter(f => f.endsWith('.md'));
  if (files.length === 0) {
    console.error(`❌  No .md files found in ${CORPUS_DIR}`);
    process.exit(1);
  }

  console.log(`\n📚  RAG Corpus Ingest — ${files.length} file(s) → namespace "${NAMESPACE}"\n`);

  let totalChunks = 0;
  let totalTokens = 0;

  for (const filename of files) {
    const filePath  = path.join(CORPUS_DIR, filename);
    const text      = fs.readFileSync(filePath, 'utf-8');
    const tipo      = tipoFromFile(filename);
    const linea     = lineaFromFile(filename);
    const chunks    = chunkText(text, CHUNK_CHARS, OVERLAP_CHARS);

    console.log(`  ▸ ${filename} — tipo=${tipo}${linea ? ` linea=${linea}` : ''} — ${chunks.length} chunks`);

    for (let i = 0; i < chunks.length; i++) {
      const chunk     = chunks[i];
      const vectorId  = createHash('sha256').update(chunk).digest('hex');
      const vector    = await embed(chunk);
      const estTokens = Math.ceil(chunk.length / 4);

      await index.upsert([{
        id:     vectorId,
        values: vector,
        metadata: {
          tipo,
          linea,
          source_file: filename,
          chunk_index: i,
          text:        chunk,
        },
      }]);

      await pgQuery(
        `INSERT INTO matec_radar.radar_v2_rag_ingest_log
           (session_id, kind, vector_id, namespace, embedding_model, chunk_chars)
         VALUES
           (NULL, ${pgLit(tipo)}, ${pgLit(vectorId)}, ${pgLit(NAMESPACE)}, ${pgLit(EMBEDDING_MODEL)}, ${pgLit(chunk.length)})
         ON CONFLICT DO NOTHING`
      );

      totalTokens += estTokens;
      process.stdout.write(`    chunk ${i + 1}/${chunks.length} — ${chunk.length} chars\r`);
    }

    totalChunks += chunks.length;
    console.log(`    ✓ ${chunks.length} chunks upserted${' '.repeat(20)}`);
  }

  const costPerM  = COST_PER_M[EMBEDDING_MODEL] ?? 0.06;
  const totalCost = (totalTokens / 1_000_000) * costPerM;

  console.log(`\n✅  Ingest OK → ${totalChunks} chunks, $${totalCost.toFixed(4)} USD, namespace ${NAMESPACE}\n`);
}

main().catch((err) => {
  console.error('❌  Ingest failed:', err);
  process.exit(1);
});
