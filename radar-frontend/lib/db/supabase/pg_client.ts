/**
 * pg_client.ts — Direct PostgreSQL access via Supabase pg-meta /pg/query HTTP API.
 * SERVER ONLY. Bypasses PostgREST schema-exposure restrictions.
 *
 * All reads return typed row arrays; writes return the inserted/updated rows via RETURNING *.
 */
import 'server-only';

const SCHEMA = 'matec_radar';

function getConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }
  return { url: url.replace(/\/$/, ''), key };
}

/** Execute raw SQL and return rows as typed objects. */
export async function pgQuery<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  const { url, key } = getConfig();
  const body = JSON.stringify({ query: sql });

  const res = await fetch(`${url}/pg/query`, {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${key}`,
      apikey:          key,
      'Content-Type':  'application/json',
      'User-Agent':    'MatecRadar-Frontend/2.0',
    },
    body,
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`pgQuery HTTP ${res.status}: ${text.slice(0, 400)}`);
  }

  const result = await res.json();
  return result as T[];
}

/** Return first row or null. */
export async function pgFirst<T = Record<string, unknown>>(sql: string): Promise<T | null> {
  const rows = await pgQuery<T>(sql);
  return rows.length > 0 ? rows[0] : null;
}

// ---------------------------------------------------------------------------
// Safe value escaping (NOT for identifiers — those should be hardcoded)
// ---------------------------------------------------------------------------

export function pgLit(v: unknown): string {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'boolean')        return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'number')         return isFinite(v) ? String(v) : 'NULL';
  if (Array.isArray(v)) {
    // Render as a Postgres ARRAY literal: ARRAY['a','b']
    const inner = v.map((el) => (el === null ? 'NULL' : `'${String(el).replace(/'/g, "''")}'`));
    return `ARRAY[${inner.join(',')}]`;
  }
  return `'${String(v).replace(/'/g, "''")}'`;
}

/**
 * Tagged template — builds SQL with safely-escaped values.
 *   const q = sql`SELECT * FROM matec_radar.empresas WHERE id = ${id}`;
 * Identifiers (table/column names) must be constant strings, NOT from user input.
 */
export function sql(strings: TemplateStringsArray, ...values: unknown[]): string {
  let result = strings[0];
  for (let i = 0; i < values.length; i++) {
    result += pgLit(values[i]) + strings[i + 1];
  }
  return result;
}

// ---------------------------------------------------------------------------
// Schema helper
// ---------------------------------------------------------------------------
export { SCHEMA };

/** Fully-qualified table reference: matec_radar.table_name */
export function tbl(table: string) {
  return `${SCHEMA}.${table}`;
}
