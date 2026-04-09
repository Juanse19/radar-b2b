/**
 * scripts/migrate_sqlite_to_supabase.ts
 * Copies all data from prisma/dev.db (SQLite) to Supabase (matec_radar schema).
 * Run with: npx tsx scripts/migrate_sqlite_to_supabase.ts
 *
 * Order: empresas → ejecuciones → senales → contactos → prospeccion_logs
 * FK remapping: SQLite INTEGER ids are re-mapped to Supabase BIGSERIAL ids
 * via in-memory Maps.
 *
 * This script is safe to re-run: existing Supabase rows will NOT be deleted
 * (you can clean tables manually in Supabase dashboard if needed).
 */

import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local'), override: true });

const url    = process.env.SUPABASE_URL;
const key    = process.env.SUPABASE_SERVICE_ROLE_KEY;
const schema = process.env.SUPABASE_DB_SCHEMA ?? 'public';

if (!url || !key || key === 'FILL_IN_SERVICE_ROLE_KEY') {
  console.error('❌  Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const prisma = new PrismaClient();
const db     = createClient(url, key, {
  db:   { schema },
  auth: { persistSession: false, autoRefreshToken: false },
});

const BATCH = 50;

async function insertBatch<T extends Record<string, unknown>>(
  table: string,
  rows: T[],
): Promise<T[]> {
  const { data, error } = await db.from(table).insert(rows).select();
  if (error) throw new Error(`insert ${table}: ${error.message}`);
  return (data ?? []) as T[];
}

async function main() {
  console.log(`\n📦  Migrating SQLite → Supabase (schema: ${schema})\n`);
  const report: Record<string, number> = {};

  // ── Empresas ────────────────────────────────────────────────────────────────
  console.log('▶  empresas');
  const sqliteEmpresas = await prisma.empresa.findMany({ orderBy: { id: 'asc' } });
  const empresaIdMap = new Map<number, number>(); // sqlite id → supabase id

  for (let i = 0; i < sqliteEmpresas.length; i += BATCH) {
    const batch = sqliteEmpresas.slice(i, i + BATCH).map(e => ({
      company_name:   e.company_name,
      company_domain: e.company_domain,
      company_url:    e.company_url,
      pais:           e.pais,
      ciudad:         e.ciudad,
      linea_negocio:  e.linea_negocio,
      linea_raw:      e.linea_raw,
      tier:           e.tier,
      status:         e.status,
      prioridad:      e.prioridad,
      keywords:       e.keywords,
      last_run_at:    e.last_run_at?.toISOString() ?? null,
      created_at:     e.created_at.toISOString(),
      updated_at:     e.updated_at.toISOString(),
    }));

    const inserted = await insertBatch('empresas', batch);
    for (let j = 0; j < batch.length; j++) {
      const sqliteId = sqliteEmpresas[i + j]!.id;
      const supaId   = (inserted[j] as unknown as { id: number }).id;
      empresaIdMap.set(sqliteId, supaId);
    }
    process.stdout.write(`  ${Math.min(i + BATCH, sqliteEmpresas.length)}/${sqliteEmpresas.length}\r`);
  }
  report['empresas'] = sqliteEmpresas.length;
  console.log(`  ✅  ${sqliteEmpresas.length} empresas`);

  // ── Ejecuciones ──────────────────────────────────────────────────────────────
  console.log('▶  ejecuciones');
  const sqliteEjecuciones = await prisma.ejecucion.findMany({ orderBy: { id: 'asc' } });
  const ejecucionIdMap = new Map<number, number>();

  for (let i = 0; i < sqliteEjecuciones.length; i += BATCH) {
    const batch = sqliteEjecuciones.slice(i, i + BATCH).map(e => ({
      n8n_execution_id: e.n8n_execution_id,
      linea_negocio:    e.linea_negocio,
      batch_size:       e.batch_size,
      estado:           e.estado,
      trigger_type:     e.trigger_type,
      parametros:       e.parametros ? JSON.parse(e.parametros) : null,
      error_msg:        e.error_msg,
      started_at:       e.started_at.toISOString(),
      finished_at:      e.finished_at?.toISOString() ?? null,
    }));

    const inserted = await insertBatch('ejecuciones', batch);
    for (let j = 0; j < batch.length; j++) {
      ejecucionIdMap.set(sqliteEjecuciones[i + j]!.id, (inserted[j] as unknown as { id: number }).id);
    }
    process.stdout.write(`  ${Math.min(i + BATCH, sqliteEjecuciones.length)}/${sqliteEjecuciones.length}\r`);
  }
  report['ejecuciones'] = sqliteEjecuciones.length;
  console.log(`  ✅  ${sqliteEjecuciones.length} ejecuciones`);

  // ── Senales ──────────────────────────────────────────────────────────────────
  console.log('▶  senales');
  const sqliteSenales = await prisma.senal.findMany({ orderBy: { id: 'asc' } });

  for (let i = 0; i < sqliteSenales.length; i += BATCH) {
    const batch = sqliteSenales.slice(i, i + BATCH).map(s => ({
      empresa_id:          s.empresa_id   ? (empresaIdMap.get(s.empresa_id)   ?? null) : null,
      ejecucion_id:        s.ejecucion_id ? (ejecucionIdMap.get(s.ejecucion_id) ?? null) : null,
      empresa_nombre:      s.empresa_nombre,
      empresa_pais:        s.empresa_pais,
      linea_negocio:       s.linea_negocio,
      tier:                s.tier,
      radar_activo:        s.radar_activo,
      tipo_senal:          s.tipo_senal,
      descripcion:         s.descripcion,
      fuente:              s.fuente,
      fuente_url:          s.fuente_url,
      score_radar:         s.score_radar,
      ventana_compra:      s.ventana_compra,
      prioridad_comercial: s.prioridad_comercial,
      motivo_descarte:     s.motivo_descarte,
      ticket_estimado:     s.ticket_estimado,
      razonamiento_agente: s.razonamiento_agente,
      created_at:          s.created_at.toISOString(),
    }));
    await insertBatch('senales', batch);
    process.stdout.write(`  ${Math.min(i + BATCH, sqliteSenales.length)}/${sqliteSenales.length}\r`);
  }
  report['senales'] = sqliteSenales.length;
  console.log(`  ✅  ${sqliteSenales.length} senales`);

  // ── Contactos ────────────────────────────────────────────────────────────────
  console.log('▶  contactos');
  const sqliteContactos = await prisma.contacto.findMany({ orderBy: { id: 'asc' } });

  for (let i = 0; i < sqliteContactos.length; i += BATCH) {
    const batch = sqliteContactos.slice(i, i + BATCH).map(c => ({
      empresa_id:     c.empresa_id ? (empresaIdMap.get(c.empresa_id) ?? null) : null,
      nombre:         c.nombre,
      cargo:          c.cargo,
      email:          c.email,
      telefono:       c.telefono,
      linkedin_url:   c.linkedin_url,
      empresa_nombre: c.empresa_nombre,
      linea_negocio:  c.linea_negocio,
      fuente:         c.fuente,
      hubspot_status: c.hubspot_status,
      hubspot_id:     c.hubspot_id,
      apollo_id:      c.apollo_id,
      created_at:     c.created_at.toISOString(),
      updated_at:     c.updated_at.toISOString(),
    }));
    await insertBatch('contactos', batch);
    process.stdout.write(`  ${Math.min(i + BATCH, sqliteContactos.length)}/${sqliteContactos.length}\r`);
  }
  report['contactos'] = sqliteContactos.length;
  console.log(`  ✅  ${sqliteContactos.length} contactos`);

  // ── ProspeccionLogs ──────────────────────────────────────────────────────────
  console.log('▶  prospeccion_logs');
  const sqliteLogs = await prisma.prospeccionLog.findMany({ orderBy: { id: 'asc' } });

  for (let i = 0; i < sqliteLogs.length; i += BATCH) {
    const batch = sqliteLogs.slice(i, i + BATCH).map(l => ({
      empresa_nombre:        l.empresa_nombre,
      linea:                 l.linea,
      n8n_execution_id:      l.n8n_execution_id,
      estado:                l.estado,
      contactos_encontrados: l.contactos_encontrados,
      created_at:            l.created_at.toISOString(),
      finished_at:           l.finished_at?.toISOString() ?? null,
    }));
    await insertBatch('prospeccion_logs', batch);
    process.stdout.write(`  ${Math.min(i + BATCH, sqliteLogs.length)}/${sqliteLogs.length}\r`);
  }
  report['prospeccion_logs'] = sqliteLogs.length;
  console.log(`  ✅  ${sqliteLogs.length} prospeccion_logs`);

  // ── Report ───────────────────────────────────────────────────────────────────
  console.log('\n📊  Migration report:');
  for (const [table, count] of Object.entries(report)) {
    console.log(`  ${table.padEnd(20)} ${count} rows`);
  }
  console.log('\n✅  Done! Verify in Supabase dashboard.\n');
}

main()
  .catch(e => { console.error('❌  Error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
