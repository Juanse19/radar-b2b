// lib/db/supabase/empresas.ts
import 'server-only';
import { pgQuery, pgFirst, pgLit, SCHEMA } from './pg_client';
import type {
  EmpresaRow, EmpresaSubLineaRow, EmpresaTerminalRow,
  GetEmpresasFilter, CrearEmpresaData, ImportarEmpresaData,
} from '../types';

const S = SCHEMA;

// ── Helpers ────────────────────────────────────────────────────────────────

// Maps each display filter value → one or more sublínea codes in the DB.
// BHS covers both aeropuertos (terminals) and cargo_uld (ground ops).
const LINEA_TO_CODES: Record<string, string[]> = {
  bhs:                    ['aeropuertos', 'cargo_uld'],
  aeropuertos:            ['aeropuertos'],
  cargo:                  ['cargo_uld'],
  'cargo uld':            ['cargo_uld'],
  cartón:                 ['carton_corrugado'],
  carton:                 ['carton_corrugado'],
  'cartón y papel':       ['carton_corrugado'],
  'carton y papel':       ['carton_corrugado'],
  intralogística:         ['logistica', 'final_linea'],
  intralogistica:         ['logistica', 'final_linea'],
  logística:              ['logistica', 'final_linea'],
  logistica:              ['logistica', 'final_linea'],
  'final de línea':       ['final_linea'],
  'final de linea':       ['final_linea'],
  'final linea':          ['final_linea'],
  motos:                  ['ensambladoras_motos'],
  'ensambladoras motos':  ['ensambladoras_motos'],
  solumat:                ['solumat'],
};

function resolveLineaCodes(linea: string): string[] {
  if (!linea || linea === 'ALL') return [];
  return LINEA_TO_CODES[linea.toLowerCase()] ?? [linea.toLowerCase()];
}

async function resolveSubLineaId(linea?: string): Promise<number | undefined> {
  if (!linea || linea === 'ALL') return undefined;
  const codes = resolveLineaCodes(linea);
  const codigo = codes[0] ?? linea.toLowerCase();
  const row = await pgFirst<{ id: number }>(
    `SELECT id FROM ${S}.sub_lineas_negocio WHERE codigo = ${pgLit(codigo)} LIMIT 1`
  );
  return row?.id;
}

// ── Queries ────────────────────────────────────────────────────────────────

export async function getEmpresas(filter: GetEmpresasFilter = {}): Promise<EmpresaRow[]> {
  const limit  = filter.limit  ?? 50;
  const offset = filter.offset ?? 0;
  const orderCol = filter.sort ?? 'company_name';
  const orderDir = filter.order === 'desc' ? 'DESC' : 'ASC';

  const conditions: string[] = [];

  // Sub-línea filter via pivot — supports multi-code lines (BHS = aeropuertos + cargo_uld)
  if (filter.subLineaId) {
    conditions.push(
      `e.id IN (SELECT empresa_id FROM ${S}.empresa_sub_lineas WHERE sub_linea_id = ${pgLit(filter.subLineaId)})`
    );
  } else if (filter.linea && filter.linea !== 'ALL') {
    const codes = resolveLineaCodes(filter.linea);
    if (codes.length > 0) {
      const codeList = codes.map(c => pgLit(c)).join(', ');
      conditions.push(
        `e.id IN (
          SELECT esl.empresa_id FROM ${S}.empresa_sub_lineas esl
          JOIN ${S}.sub_lineas_negocio sl ON sl.id = esl.sub_linea_id
          WHERE sl.codigo IN (${codeList})
        )`
      );
    }
  }

  if (filter.tierActual)  conditions.push(`e.tier_actual = ${pgLit(filter.tierActual)}`);
  if (filter.pais)        conditions.push(`e.pais = ${pgLit(filter.pais)}`);
  if (filter.pipeline)    conditions.push(`e.pipeline = ${pgLit(filter.pipeline)}`);
  if (filter.radarActivo) conditions.push(`e.radar_activo = ${pgLit(filter.radarActivo)}`);
  if (filter.scoreMin !== undefined)
    conditions.push(`e.score_total_ultimo >= ${pgLit(filter.scoreMin)}`);
  if (filter.busqueda)
    conditions.push(`e.company_name ILIKE ${pgLit('%' + filter.busqueda + '%')}`);

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  return pgQuery<EmpresaRow>(`
    SELECT e.*,
      row_to_json(sl.*) AS sub_linea_principal
    FROM ${S}.empresas e
    LEFT JOIN ${S}.sub_lineas_negocio sl ON sl.id = e.sub_linea_principal_id
    ${where}
    ORDER BY e.${orderCol} ${orderDir} NULLS LAST
    LIMIT ${pgLit(limit)} OFFSET ${pgLit(offset)}
  `);
}

export async function getEmpresasByLinea(linea: string, limit = 50, offset = 0): Promise<EmpresaRow[]> {
  return getEmpresas({ linea, limit, offset });
}

export async function getEmpresasCount(): Promise<Record<string, number>> {
  const rows = await pgQuery<{ codigo: string; count: string }>(
    `SELECT sl.codigo, COUNT(DISTINCT esl.empresa_id)::text AS count
     FROM ${S}.empresa_sub_lineas esl
     JOIN ${S}.sub_lineas_negocio sl ON sl.id = esl.sub_linea_id
     GROUP BY sl.codigo`
  );
  return Object.fromEntries(rows.map((r) => [r.codigo, parseInt(r.count, 10)]));
}

export async function getEmpresasParaEscaneo(linea: string, limit: number): Promise<EmpresaRow[]> {
  return getEmpresas({ linea, limit, sort: 'ultimo_scan_at', order: 'asc' });
}

export async function getEmpresaById(id: number): Promise<EmpresaRow | null> {
  return pgFirst<EmpresaRow>(
    `SELECT e.* FROM ${S}.empresas e WHERE e.id = ${pgLit(id)} LIMIT 1`
  );
}

export async function getEmpresaStatus(id: number): Promise<{ status: string } | null> {
  const row = await pgFirst<{ tier_actual: string }>(
    `SELECT tier_actual FROM ${S}.empresas WHERE id = ${pgLit(id)} LIMIT 1`
  );
  if (!row) return null;
  return { status: row.tier_actual ?? 'sin_calificar' };
}

// ── Mutations ──────────────────────────────────────────────────────────────

export async function crearEmpresa(data: CrearEmpresaData): Promise<EmpresaRow> {
  const cols = Object.keys(data).filter((k) => k !== 'sub_linea_principal' && k !== 'sub_lineas');
  const vals = cols.map((c) => pgLit((data as unknown as Record<string, unknown>)[c]));
  const [row] = await pgQuery<EmpresaRow>(
    `INSERT INTO ${S}.empresas (${cols.join(', ')}) VALUES (${vals.join(', ')}) RETURNING *`
  );
  if (!row) throw new Error('crearEmpresa: no row returned');

  if (data.sub_linea_principal_id) {
    await pgQuery(
      `INSERT INTO ${S}.empresa_sub_lineas (empresa_id, sub_linea_id, es_principal)
       VALUES (${pgLit(row.id)}, ${pgLit(data.sub_linea_principal_id)}, TRUE)
       ON CONFLICT DO NOTHING`
    );
  }
  return row;
}

export async function actualizarEmpresa(id: number, data: Partial<EmpresaRow>): Promise<EmpresaRow> {
  const patch = { ...data } as Record<string, unknown>;
  delete patch.sub_linea_principal;
  delete patch.sub_lineas;
  delete patch.id;

  const sets = Object.entries(patch).map(([k, v]) => `${k} = ${pgLit(v)}`);
  if (sets.length === 0) {
    const existing = await getEmpresaById(id);
    if (!existing) throw new Error('actualizarEmpresa: empresa not found');
    return existing;
  }

  const [row] = await pgQuery<EmpresaRow>(
    `UPDATE ${S}.empresas SET ${sets.join(', ')}, updated_at = NOW()
     WHERE id = ${pgLit(id)} RETURNING *`
  );
  if (!row) throw new Error('actualizarEmpresa: empresa not found');
  return row;
}

export async function eliminarEmpresa(id: number): Promise<void> {
  await pgQuery(`DELETE FROM ${S}.empresas WHERE id = ${pgLit(id)}`);
}

export async function importarEmpresas(rows: ImportarEmpresaData[]): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0, skipped = 0;

  for (const e of rows) {
    const company_name = String(e.company_name ?? '').trim();
    if (!company_name) { skipped++; continue; }

    const subLineaId = await resolveSubLineaId(e.linea_negocio);

    const existing = await pgFirst<{ id: number }>(
      `SELECT id FROM ${S}.empresas
       WHERE company_name_norm = lower(unaccent(${pgLit(company_name)}))
         AND owner_id IS NULL
       LIMIT 1`
    );
    if (existing) { skipped++; continue; }

    const [row] = await pgQuery<{ id: number }>(
      `INSERT INTO ${S}.empresas (company_name, company_domain, pais_nombre, ciudad, sub_linea_principal_id, tier_actual)
       VALUES (${pgLit(company_name)}, ${pgLit(e.company_domain ?? null)}, ${pgLit(e.pais ?? null)},
               ${pgLit(e.ciudad ?? null)}, ${pgLit(subLineaId ?? null)}, ${pgLit(e.tier ?? 'sin_calificar')})
       RETURNING id`
    );
    if (!row) { skipped++; continue; }

    if (subLineaId) {
      await pgQuery(
        `INSERT INTO ${S}.empresa_sub_lineas (empresa_id, sub_linea_id, es_principal)
         VALUES (${pgLit(row.id)}, ${pgLit(subLineaId)}, TRUE)
         ON CONFLICT DO NOTHING`
      );
    }
    inserted++;
  }

  return { inserted, skipped };
}

// ── Terminales & Sub-líneas ────────────────────────────────────────────────

export async function getTerminalesByEmpresa(empresaId: number): Promise<EmpresaTerminalRow[]> {
  return pgQuery<EmpresaTerminalRow>(
    `SELECT * FROM ${S}.empresa_terminales WHERE empresa_id = ${pgLit(empresaId)} ORDER BY iata_code`
  );
}

export async function getSubLineasByEmpresa(empresaId: number): Promise<EmpresaSubLineaRow[]> {
  return pgQuery<EmpresaSubLineaRow>(
    `SELECT esl.*, row_to_json(sl.*) AS sub_linea
     FROM ${S}.empresa_sub_lineas esl
     JOIN ${S}.sub_lineas_negocio sl ON sl.id = esl.sub_linea_id
     WHERE esl.empresa_id = ${pgLit(empresaId)}`
  );
}
