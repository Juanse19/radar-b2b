/**
 * fix_wf03_supabase_persist.js
 *
 * Adds Supabase dual-write persistence to WF03 Agent 03 - Prospector v1.0
 * Applied: 2026-04-08
 * Author:  Claude Code (automated via N8N API)
 *
 * Change summary:
 *   - Added "Code: Build Supabase Persist (WF03)" after "Code: Expand to Rows"
 *     Builds a PL/pgSQL DO block that:
 *       1. Upserts the empresa into matec_radar.empresas (by company_name_norm)
 *       2. Inserts a prospecciones record (estado='encontrado')
 *       3. Inserts/upserts each contact into matec_radar.contactos (ON CONFLICT apollo_id)
 *   - Added "HTTP: Supabase Persist Contacts (WF03)" after above
 *     POSTs the SQL to https://supabase.valparaiso.cafe/pg/query
 *     continueOnFail=true so GSheets write is never blocked by Supabase failure
 *
 * Connection rewiring:
 *   BEFORE: Code: Expand to Rows --> Log Prospectos GSheets
 *   AFTER:  Code: Expand to Rows --> Code: Build Supabase Persist (WF03)
 *                                --> HTTP: Supabase Persist Contacts (WF03)
 *                                --> Log Prospectos GSheets
 *
 * Node IDs assigned:
 *   Code: Build Supabase Persist (WF03) : b1c2d3e4-f5a6-7890-bcde-f01234567890
 *   HTTP: Supabase Persist Contacts (WF03): a9b8c7d6-e5f4-3210-abcd-ef9876543210
 *
 * Supabase endpoint: POST /pg/query (raw SQL execution)
 * Auth headers: apikey + Authorization: Bearer <SERVICE_ROLE_KEY>
 *
 * Schema objects used:
 *   matec_radar.empresas        (company_name_norm unique index)
 *   matec_radar.contactos       (apollo_id partial unique index)
 *   matec_radar.prospecciones   (estado_prospeccion_enum: 'encontrado')
 *   matec_radar.hubspot_status_enum: 'pendiente'
 *   matec_radar.f_unaccent()    (helper for accent-insensitive normalization)
 */

// This file is documentation only. The fix was applied directly via N8N REST API.
// Workflow ID: RLUDpi3O5Rb6WEYJ
// Applied at:  2026-04-09T05:13:36.717Z (server timestamp)
