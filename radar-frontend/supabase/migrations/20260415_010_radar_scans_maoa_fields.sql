-- =============================================================================
-- Migration: 20260415_010_radar_scans_maoa_fields.sql
-- Purpose:   Sprint MAOA F1.4 — Agrega columnas MAOA Agente 1 (detección) +
--            Agente 2 (TIER+TIR) a matec_radar.radar_scans y matec_radar.senales
--            para almacenar el output completo del sistema MAOA.
-- Sprint:    MAOA F1.4 — 2026-04-15
-- =============================================================================

-- ── MAOA Agente 1: campos de detección pura ───────────────────────────────────
ALTER TABLE matec_radar.radar_scans
  ADD COLUMN IF NOT EXISTS radar_activo_maoa    BOOLEAN,
  ADD COLUMN IF NOT EXISTS tipo_senal           TEXT,
  ADD COLUMN IF NOT EXISTS empresa_o_proyecto   TEXT,
  ADD COLUMN IF NOT EXISTS descripcion_resumen  TEXT,
  ADD COLUMN IF NOT EXISTS criterios_cumplidos  TEXT[],
  ADD COLUMN IF NOT EXISTS total_criterios      SMALLINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ventana_compra_maoa  TEXT,
  ADD COLUMN IF NOT EXISTS monto_inversion      TEXT,
  ADD COLUMN IF NOT EXISTS fuente_link          TEXT,
  ADD COLUMN IF NOT EXISTS fuente_tipo          TEXT,
  ADD COLUMN IF NOT EXISTS fecha_senal          TEXT,          -- almacenar como string (formato DD/MM/AAAA o ISO)
  ADD COLUMN IF NOT EXISTS evaluacion_temporal  TEXT,          -- 🔴/🟡/🟢 + label
  ADD COLUMN IF NOT EXISTS motivo_descarte_maoa TEXT,
  ADD COLUMN IF NOT EXISTS observaciones_maoa   TEXT;

-- ── MAOA Agente 2: campos de scoring TIER + TIR ───────────────────────────────
ALTER TABLE matec_radar.radar_scans
  ADD COLUMN IF NOT EXISTS tier_score           NUMERIC(4,1),
  ADD COLUMN IF NOT EXISTS tier_clasificacion   CHAR(1),       -- A | B | C
  ADD COLUMN IF NOT EXISTS tier_desglose        JSONB,         -- {industria_tamano, capex_historica, complejidad_tecnica, pais_foco}
  ADD COLUMN IF NOT EXISTS tir_score            NUMERIC(4,1),
  ADD COLUMN IF NOT EXISTS tir_clasificacion    CHAR(1),       -- A | B | C
  ADD COLUMN IF NOT EXISTS tir_desglose         JSONB,         -- {probabilidad_timing, presupuesto_asignado, nivel_influencia, presion_competencia}
  ADD COLUMN IF NOT EXISTS score_final_maoa     NUMERIC(4,1),
  ADD COLUMN IF NOT EXISTS convergencia_maoa    TEXT,          -- Verificada | Pendiente | Sin convergencia
  ADD COLUMN IF NOT EXISTS accion_recomendada   TEXT,          -- ABM ACTIVADO | MONITOREO ACTIVO | ARCHIVAR
  ADD COLUMN IF NOT EXISTS radar_6_12m          BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS signal_id            TEXT;          -- MX-INTRA-DHL-2026 style

-- ── Índices para consultas frecuentes ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS radar_scans_accion_idx
  ON matec_radar.radar_scans (accion_recomendada)
  WHERE accion_recomendada IS NOT NULL;

CREATE INDEX IF NOT EXISTS radar_scans_convergencia_idx
  ON matec_radar.radar_scans (convergencia_maoa)
  WHERE convergencia_maoa = 'Verificada';

CREATE INDEX IF NOT EXISTS radar_scans_score_maoa_idx
  ON matec_radar.radar_scans (score_final_maoa DESC NULLS LAST)
  WHERE score_final_maoa IS NOT NULL;

CREATE INDEX IF NOT EXISTS radar_scans_radar_activo_idx
  ON matec_radar.radar_scans (radar_activo_maoa)
  WHERE radar_activo_maoa = TRUE;

-- ── Comentarios descriptivos ───────────────────────────────────────────────────
COMMENT ON COLUMN matec_radar.radar_scans.radar_activo_maoa IS
  'MAOA A1: true si el agente RADAR detectó una señal real y futura';

COMMENT ON COLUMN matec_radar.radar_scans.tipo_senal IS
  'MAOA A1: tipo exacto de señal (CAPEX Confirmado | Licitación | Expansión... | Sin Señal)';

COMMENT ON COLUMN matec_radar.radar_scans.ventana_compra_maoa IS
  'MAOA A1: ventana temporal (0-6 Meses | 6-12 Meses | ... | Sin señal)';

COMMENT ON COLUMN matec_radar.radar_scans.score_final_maoa IS
  'MAOA A2: score combinado (tier_score + tir_score) / 2 → 0-10';

COMMENT ON COLUMN matec_radar.radar_scans.convergencia_maoa IS
  'MAOA A2: Verificada | Pendiente | Sin convergencia — gate para ABM';

COMMENT ON COLUMN matec_radar.radar_scans.accion_recomendada IS
  'MAOA A2: ABM ACTIVADO | MONITOREO ACTIVO | ARCHIVAR';

COMMENT ON COLUMN matec_radar.radar_scans.signal_id IS
  'MAOA A2: ID compuesto para CRM (ej: CO-BHS-AEROPU-2026)';

-- =============================================================================
-- matec_radar.senales — MAOA sync fields (mismas columnas que radar_scans)
-- =============================================================================

ALTER TABLE matec_radar.senales
  ADD COLUMN IF NOT EXISTS tipo_senal           TEXT,
  ADD COLUMN IF NOT EXISTS empresa_o_proyecto   TEXT,
  ADD COLUMN IF NOT EXISTS ventana_compra_maoa  TEXT,
  ADD COLUMN IF NOT EXISTS monto_inversion      TEXT,
  ADD COLUMN IF NOT EXISTS tier_score           NUMERIC(4,1),
  ADD COLUMN IF NOT EXISTS tier_clasificacion   CHAR(1),
  ADD COLUMN IF NOT EXISTS tir_score            NUMERIC(4,1),
  ADD COLUMN IF NOT EXISTS tir_clasificacion    CHAR(1),
  ADD COLUMN IF NOT EXISTS score_final_maoa     NUMERIC(4,1),
  ADD COLUMN IF NOT EXISTS convergencia_maoa    TEXT,
  ADD COLUMN IF NOT EXISTS accion_recomendada   TEXT;

-- ── Verificación ───────────────────────────────────────────────────────────────
DO $$
DECLARE
  col_scans INT;
  col_senales INT;
BEGIN
  SELECT COUNT(*) INTO col_scans
  FROM information_schema.columns
  WHERE table_schema = 'matec_radar'
    AND table_name   = 'radar_scans'
    AND column_name  IN (
      'radar_activo_maoa', 'tipo_senal', 'score_final_maoa',
      'convergencia_maoa', 'accion_recomendada', 'signal_id'
    );

  SELECT COUNT(*) INTO col_senales
  FROM information_schema.columns
  WHERE table_schema = 'matec_radar'
    AND table_name   = 'senales'
    AND column_name  IN (
      'tipo_senal', 'ventana_compra_maoa', 'score_final_maoa',
      'convergencia_maoa', 'accion_recomendada'
    );

  RAISE NOTICE 'Migración 010 (MAOA F1.4) OK → radar_scans: % de 6 cols | senales: % de 5 cols',
    col_scans, col_senales;

  IF col_scans < 6 THEN
    RAISE WARNING 'Faltan columnas MAOA en radar_scans. Verificar permisos ALTER TABLE.';
  END IF;
  IF col_senales < 5 THEN
    RAISE WARNING 'Faltan columnas MAOA en senales. Verificar permisos ALTER TABLE.';
  END IF;
END $$;
