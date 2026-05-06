/**
 * lib/prospector/db.ts — Persistencia de Apollo Prospector v2.
 *
 * Usa el schema canónico definido en supabase/migrations/20260408_002_business_model.sql
 * extendido por la migración prospector_v2 (phone_unlocked, fase2_done, sessions).
 *
 * Todas las funciones son server-only y usan el cliente pgQuery / sql tagged template.
 */
import 'server-only';
import { pgQuery, pgFirst, tbl } from '@/lib/db/supabase/pg_client';
import type { ContactResult } from './stream-events';
import { nivelToSeniority, type Nivel } from './levels';

// ---------------------------------------------------------------------------
// Lineas tree
// ---------------------------------------------------------------------------

export interface LineaTreeRow {
  linea_codigo:    string;
  linea_nombre:    string;
  color_hex:       string | null;
  sublinea_codigo: string;
  sublinea_id:     number;
  sublinea_nombre: string;
  descripcion:     string | null;
}

export async function getLineasTree(): Promise<LineaTreeRow[]> {
  const query = `
    SELECT
      l.codigo AS linea_codigo,
      l.nombre AS linea_nombre,
      l.color_hex,
      s.codigo AS sublinea_codigo,
      s.id     AS sublinea_id,
      s.nombre AS sublinea_nombre,
      s.descripcion
    FROM ${tbl('lineas_negocio')} l
    JOIN ${tbl('sub_lineas_negocio')} s ON s.linea_id = l.id
    WHERE l.activo = TRUE AND s.activo = TRUE
    ORDER BY l.orden, s.orden
  `;
  return pgQuery<LineaTreeRow>(query);
}

// ---------------------------------------------------------------------------
// Auto-select empresas por sub-línea + tier
// ---------------------------------------------------------------------------

export interface EmpresaForProspect {
  id:        number;
  nombre:    string;
  dominio:   string | null;
  pais:      string | null;
  tier:      string;
  sub_linea_id:     number | null;
  sub_linea_codigo: string | null;
}

export interface AutoSelectParams {
  sublineaIds:        number[];
  tiers:              string[];
  count:              number;
  excludeWithContacts?: boolean;
}

export async function getEmpresasPorTier(p: AutoSelectParams): Promise<EmpresaForProspect[]> {
  if (!p.sublineaIds.length || !p.tiers.length || p.count <= 0) return [];

  const sublineaList = p.sublineaIds.map(Number).join(',');
  const tiersLiteral = p.tiers.map(t => `'${String(t).replace(/'/g, "''")}'`).join(',');
  const exclude = p.excludeWithContacts
    ? `AND NOT EXISTS (
         SELECT 1 FROM ${tbl('contactos')} c
         WHERE c.empresa_id = e.id AND c.email IS NOT NULL
       )`
    : '';

  // Schema real: empresas.company_name / company_domain (no e.nombre / e.dominio).
  // Tiers válidos en matec_radar.tier_enum: A, B, C, D, sin_calificar.
  // No hay columna 'activo' en la tabla empresas.
  //
  // Nota: SELECT DISTINCT + ORDER BY random() no es válido en Postgres
  // (la columna del ORDER BY debe estar en el SELECT). Por eso usamos
  // DISTINCT ON (e.id) en una subquery + ORDER BY random() afuera.
  const query = `
    SELECT *
    FROM (
      SELECT DISTINCT ON (e.id)
        e.id,
        e.company_name        AS nombre,
        e.company_domain      AS dominio,
        e.pais::TEXT          AS pais,
        e.tier_actual::TEXT   AS tier,
        esl.sub_linea_id,
        sln.codigo            AS sub_linea_codigo
      FROM ${tbl('empresas')} e
      JOIN ${tbl('empresa_sub_lineas')} esl ON esl.empresa_id = e.id
      JOIN ${tbl('sub_lineas_negocio')} sln ON sln.id        = esl.sub_linea_id
      WHERE esl.sub_linea_id IN (${sublineaList})
        AND e.tier_actual::TEXT IN (${tiersLiteral})
        ${exclude}
      ORDER BY e.id
    ) AS sub
    ORDER BY random()
    LIMIT ${Math.max(1, Math.min(p.count, 50))}
  `;
  return pgQuery<EmpresaForProspect>(query);
}

// ---------------------------------------------------------------------------
// Empresa lookup por nombre + país (fallback cuando el frontend pasa nombre libre)
// ---------------------------------------------------------------------------

export async function findEmpresaIdByNameCountry(
  nombre: string,
  pais?: string | null,
): Promise<number | null> {
  const safeNombre = nombre.replace(/'/g, "''");
  const safePais   = pais ? pais.replace(/'/g, "''") : null;
  // Schema real: empresas.company_name / pais (enum)
  const query = `
    SELECT e.id
    FROM ${tbl('empresas')} e
    WHERE LOWER(e.company_name) = LOWER('${safeNombre}')
    ${safePais ? `AND e.pais::TEXT = '${safePais}'` : ''}
    LIMIT 1
  `;
  const row = await pgFirst<{ id: number }>(query);
  return row?.id ?? null;
}

// ---------------------------------------------------------------------------
// alreadyEnriched — para evitar gastar créditos duplicando enriquecimiento
// ---------------------------------------------------------------------------

export async function alreadyEnriched(apolloId: string): Promise<boolean> {
  if (!apolloId) return false;
  const safe = apolloId.replace(/'/g, "''");
  const query = `
    SELECT 1
    FROM ${tbl('contactos')}
    WHERE apollo_id = '${safe}'
      AND email IS NOT NULL
      AND email_status IN ('verified','extrapolated','probable')
    LIMIT 1
  `;
  const row = await pgFirst<{ '?column?': number }>(query);
  return row !== null;
}

// ---------------------------------------------------------------------------
// upsertContact — guarda/actualiza un contacto enriquecido
// ---------------------------------------------------------------------------

export interface UpsertContactInput {
  apollo_id:        string;
  empresa_id:       number;
  prospeccion_id?:  number | null;
  prospector_session_id?: string | null;
  first_name:       string;
  last_name:        string;
  title:            string;
  nivel:            Nivel;
  email:            string;
  email_status:     string;
  phone_mobile?:    string | null;
  phone_work_direct?: string | null;
  corporate_phone?: string | null;
  linkedin_url?:    string | null;
  country?:         string | null;
  apollo_person_raw?: unknown;
  es_principal?:    boolean;
  fase2_done?:      boolean;
}

export interface UpsertContactResult {
  id:        number;
  apollo_id: string;
}

export async function upsertContact(input: UpsertContactInput): Promise<UpsertContactResult> {
  const seniority = nivelToSeniority(input.nivel);
  const rawJson   = input.apollo_person_raw
    ? `'${JSON.stringify(input.apollo_person_raw).replace(/'/g, "''")}'::jsonb`
    : 'NULL';
  const country   = input.country
    ? `'${input.country.replace(/'/g, "''")}'::matec_radar.pais_iso_enum`
    : 'NULL';

  const lit = (v: string | null | undefined): string =>
    v == null || v === '' ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`;

  const query = `
    INSERT INTO ${tbl('contactos')} (
      empresa_id,
      prospeccion_id,
      prospector_session_id,
      first_name, last_name, title, seniority,
      email, email_status,
      phone_mobile, phone_work_direct, corporate_phone,
      linkedin_url, country,
      apollo_id, apollo_person_raw,
      nivel_jerarquico,
      es_principal,
      fase2_done,
      hubspot_status
    ) VALUES (
      ${input.empresa_id},
      ${input.prospeccion_id ?? 'NULL'},
      ${input.prospector_session_id ? `'${input.prospector_session_id}'::uuid` : 'NULL'},
      ${lit(input.first_name)}, ${lit(input.last_name)}, ${lit(input.title)}, ${lit(seniority)},
      ${lit(input.email)}, ${lit(input.email_status)},
      ${lit(input.phone_mobile)}, ${lit(input.phone_work_direct)}, ${lit(input.corporate_phone)},
      ${lit(input.linkedin_url)}, ${country},
      ${lit(input.apollo_id)}, ${rawJson},
      ${lit(input.nivel)},
      ${input.es_principal ? 'TRUE' : 'FALSE'},
      ${input.fase2_done ? 'TRUE' : 'FALSE'},
      'pendiente'
    )
    ON CONFLICT (apollo_id) DO UPDATE SET
      empresa_id        = EXCLUDED.empresa_id,
      first_name        = EXCLUDED.first_name,
      last_name         = EXCLUDED.last_name,
      title             = EXCLUDED.title,
      seniority         = EXCLUDED.seniority,
      email             = EXCLUDED.email,
      email_status      = EXCLUDED.email_status,
      phone_mobile      = COALESCE(EXCLUDED.phone_mobile,      ${tbl('contactos')}.phone_mobile),
      phone_work_direct = COALESCE(EXCLUDED.phone_work_direct, ${tbl('contactos')}.phone_work_direct),
      corporate_phone   = COALESCE(EXCLUDED.corporate_phone,   ${tbl('contactos')}.corporate_phone),
      linkedin_url      = COALESCE(EXCLUDED.linkedin_url,      ${tbl('contactos')}.linkedin_url),
      country           = COALESCE(EXCLUDED.country,           ${tbl('contactos')}.country),
      apollo_person_raw = COALESCE(EXCLUDED.apollo_person_raw, ${tbl('contactos')}.apollo_person_raw),
      nivel_jerarquico  = EXCLUDED.nivel_jerarquico,
      es_principal      = ${tbl('contactos')}.es_principal OR EXCLUDED.es_principal,
      fase2_done        = ${tbl('contactos')}.fase2_done   OR EXCLUDED.fase2_done,
      updated_at        = NOW()
    RETURNING id, apollo_id
  `;

  const row = await pgFirst<UpsertContactResult>(query);
  if (!row) throw new Error('upsertContact returned no row');
  return row;
}

// ---------------------------------------------------------------------------
// upsertSinContactos — registra empresas sin resultados
// ---------------------------------------------------------------------------

export interface UpsertSinContactosInput {
  empresa_id:    number;
  motivo:        string;
  job_titles?:   string[];
  paises?:       string[];
}

export async function upsertSinContactos(p: UpsertSinContactosInput): Promise<void> {
  const lit = (s: string) => `'${String(s).replace(/'/g, "''")}'`;
  const arr = (xs?: string[]) => xs?.length
    ? `ARRAY[${xs.map(lit).join(',')}]::TEXT[]`
    : 'NULL';

  await pgQuery(`
    INSERT INTO ${tbl('contactos_sin_encontrar')} (
      empresa_id, motivo, job_titles_intentados, paises_intentados
    ) VALUES (
      ${p.empresa_id}, ${lit(p.motivo)}, ${arr(p.job_titles)}, ${arr(p.paises)}
    )
  `);
}

// ---------------------------------------------------------------------------
// unlock phone — actualiza tel + flag
// ---------------------------------------------------------------------------

export interface UnlockPhoneInput {
  contacto_id: number;
  tel_movil:   string;
}

export async function markPhoneUnlocked(p: UnlockPhoneInput): Promise<void> {
  const lit = (s: string) => `'${String(s).replace(/'/g, "''")}'`;
  await pgQuery(`
    UPDATE ${tbl('contactos')}
    SET phone_mobile      = ${lit(p.tel_movil)},
        phone_unlocked    = TRUE,
        phone_unlocked_at = NOW(),
        updated_at        = NOW()
    WHERE id = ${p.contacto_id}
  `);
}

export async function getContactoApolloId(contactoId: number): Promise<{
  apollo_id: string | null;
  empresa_id: number;
} | null> {
  const query = `
    SELECT apollo_id, empresa_id
    FROM ${tbl('contactos')}
    WHERE id = ${contactoId}
    LIMIT 1
  `;
  return pgFirst<{ apollo_id: string | null; empresa_id: number }>(query);
}

// ---------------------------------------------------------------------------
// Sessions (prospector_v2_sessions)
// ---------------------------------------------------------------------------

export interface CreateProspectorSessionInput {
  id:              string;          // UUID generado en cliente
  user_id?:        string | null;
  modo:            'auto' | 'manual';
  sublineas:       string[];
  tiers?:          string[] | null;
  empresas_count:  number;
  estimated_credits: number;
}

export async function createProspectorSession(p: CreateProspectorSessionInput): Promise<void> {
  const lit = (s: string) => `'${String(s).replace(/'/g, "''")}'`;
  const arr = (xs?: string[] | null) => xs?.length
    ? `ARRAY[${xs.map(lit).join(',')}]::TEXT[]`
    : 'NULL';

  await pgQuery(`
    INSERT INTO ${tbl('prospector_v2_sessions')} (
      id, user_id, modo, sublineas, tiers, empresas_count, estimated_credits
    ) VALUES (
      ${lit(p.id)}::uuid,
      ${p.user_id ? `${lit(p.user_id)}::uuid` : 'NULL'},
      ${lit(p.modo)},
      ${arr(p.sublineas)},
      ${arr(p.tiers)},
      ${p.empresas_count},
      ${p.estimated_credits}
    )
    ON CONFLICT (id) DO NOTHING
  `);
}

export interface FinalizeProspectorSessionInput {
  id:                string;
  total_contacts:    number;
  total_with_email:  number;
  total_with_phone:  number;
  credits_used:      number;
  duration_ms:       number;
  cancelled?:        boolean;
}

export async function finalizeProspectorSession(p: FinalizeProspectorSessionInput): Promise<void> {
  await pgQuery(`
    UPDATE ${tbl('prospector_v2_sessions')}
    SET total_contacts   = ${p.total_contacts},
        total_with_email = ${p.total_with_email},
        total_with_phone = ${p.total_with_phone},
        credits_used     = ${p.credits_used},
        duration_ms      = ${p.duration_ms},
        cancelled        = ${p.cancelled ? 'TRUE' : 'FALSE'},
        finished_at      = NOW()
    WHERE id = '${p.id.replace(/'/g, "''")}'::uuid
  `);
}

// ---------------------------------------------------------------------------
// Helpers para construir ContactResult desde una fila enriquecida
// ---------------------------------------------------------------------------

export function buildContactResult(args: {
  apollo_id:    string;
  first_name:   string;
  last_name:    string;
  title:        string;
  nivel:        Nivel;
  empresa:      string;
  pais:         string;
  sublinea?:    string | null;
  linkedin?:    string | null;
  email:        string;
  estado_email: string;
  tel_empresa?: string | null;
  tel_movil?:   string | null;
  phone_unlocked?: boolean;
  es_principal?: boolean;
}): ContactResult {
  return {
    apollo_id:    args.apollo_id,
    nombre:       args.first_name ?? '',
    apellido:     args.last_name ?? '',
    cargo:        args.title ?? '',
    nivel:        args.nivel,
    empresa:      args.empresa,
    pais:         args.pais,
    sublinea:     args.sublinea ?? null,
    linkedin:     args.linkedin ?? '',
    email:        args.email,
    estado_email: args.estado_email,
    tel_empresa:  args.tel_empresa ?? null,
    tel_movil:    args.tel_movil ?? null,
    phone_unlocked: !!args.phone_unlocked,
    es_principal: !!args.es_principal,
  };
}
