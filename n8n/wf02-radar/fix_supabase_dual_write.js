/**
 * fix_supabase_dual_write.js
 *
 * Adds Supabase dual-write persistence to WF02 - Agent 02 Radar de Inversión.
 * Applied: 2026-04-09
 *
 * Change summary:
 *   BEFORE: Code: Calcular Composite → IF: Tier ORO para WF03
 *   AFTER:  Code: Calcular Composite
 *             → Code: Build Supabase Persist (WF02)   [node id: cabdad15-83de-4126-82b1-f5e00c07ef76]
 *             → HTTP: Supabase Persist Radar (WF02)   [node id: 77496688-838d-43df-ac5a-a2cafd3735bb]
 *             → IF: Tier ORO para WF03
 *
 * The HTTP node has continueOnFail: true — Supabase failure does NOT break
 * the main flow (GSheets / Excel writes continue regardless).
 *
 * SQL performed per scan:
 *   1. UPSERT matec_radar.empresas (by company_name_norm)
 *      - Updates score_radar_ultimo, composite_score_ultimo on conflict
 *   2. INSERT matec_radar.radar_scans
 *      - tier_compuesto mapped: ORO→A, MONITOREO→B, ARCHIVO→C (tier_enum)
 *      - ventana_compra defaults to 'desconocida'
 *
 * Applied via n8n PUT /api/v1/workflows/fko0zXYYl5X4PtHz
 * New versionId: 05774fd9-c079-4c5e-80a9-b25d30088218
 */

// This file documents the change. The actual modification was applied directly
// via the n8n API using build_wf02.py (C:/Users/Juan/AppData/Local/Temp/).
//
// Node IDs:
//   Code: Build Supabase Persist (WF02) → cabdad15-83de-4126-82b1-f5e00c07ef76
//   HTTP: Supabase Persist Radar (WF02) → 77496688-838d-43df-ac5a-a2cafd3735bb
