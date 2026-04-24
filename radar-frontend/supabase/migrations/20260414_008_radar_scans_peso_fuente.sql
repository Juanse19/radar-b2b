-- =============================================================================
-- Migration: 20260414_008_radar_scans_peso_fuente.sql
-- Purpose:   Añade columnas de Sprint A/B a radar_scans y radar_fuentes.
--            Idempotente: usa ADD COLUMN IF NOT EXISTS.
-- Sprint:    A.2 (peso_fuente) + A.4 (horizonte_meses) + B.1 (convergencia)
-- =============================================================================

-- ── radar_scans — columnas nuevas ────────────────────────────────────────────
ALTER TABLE matec_radar.radar_scans
  ADD COLUMN IF NOT EXISTS peso_fuente_max   SMALLINT,     -- peso máx de fuentes encontradas (1-5)
  ADD COLUMN IF NOT EXISTS tiene_fuente_gov  BOOLEAN,      -- alguna fuente peso >= 4
  ADD COLUMN IF NOT EXISTS horizonte_meses   SMALLINT,     -- meses hasta fecha_evento (puede ser NULL)
  ADD COLUMN IF NOT EXISTS convergencia      BOOLEAN,      -- Sprint B.1: >= 1 fuente p4-5 AND >= 1 fuente p3
  ADD COLUMN IF NOT EXISTS keywords_usadas   TEXT[],       -- array de keywords que dispararon el scan
  ADD COLUMN IF NOT EXISTS queries_count     SMALLINT;     -- cuántas queries Tavily se ejecutaron

COMMENT ON COLUMN matec_radar.radar_scans.peso_fuente_max  IS 'Peso máximo encontrado entre fuentes Tavily. 5=gov, 4=IR, 3=gremio, 1-2=prensa';
COMMENT ON COLUMN matec_radar.radar_scans.tiene_fuente_gov IS 'TRUE si al menos una fuente tiene peso >= 4 (operador público o gov)';
COMMENT ON COLUMN matec_radar.radar_scans.horizonte_meses  IS 'Meses hasta fecha_evento de la señal. NULL si no detectado';
COMMENT ON COLUMN matec_radar.radar_scans.convergencia     IS 'TRUE si hay >= 1 fuente p>=4 AND >= 1 fuente p=3 (Sprint B.1)';
COMMENT ON COLUMN matec_radar.radar_scans.keywords_usadas  IS 'Array de keywords que se usaron en las queries Tavily';
COMMENT ON COLUMN matec_radar.radar_scans.queries_count    IS 'Número de queries Tavily ejecutadas (gov + general = 2)';

-- ── radar_fuentes — columna peso_fuente ──────────────────────────────────────
ALTER TABLE matec_radar.radar_fuentes
  ADD COLUMN IF NOT EXISTS peso_fuente SMALLINT DEFAULT 1; -- peso individual de esta fuente

COMMENT ON COLUMN matec_radar.radar_fuentes.peso_fuente IS '1=prensa general, 2=prensa esp., 3=gremio, 4=IR/operador, 5=gov/licitación';

-- ── Índice para filtrar por convergencia y fuente gov ────────────────────────
CREATE INDEX IF NOT EXISTS radar_convergencia_idx
  ON matec_radar.radar_scans (convergencia, peso_fuente_max DESC)
  WHERE convergencia = TRUE;

CREATE INDEX IF NOT EXISTS radar_fuente_gov_idx
  ON matec_radar.radar_scans (tiene_fuente_gov, score_radar DESC)
  WHERE tiene_fuente_gov = TRUE;

-- ── Verificación ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  ASSERT (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = 'matec_radar'
      AND table_name   = 'radar_scans'
      AND column_name  IN ('peso_fuente_max','tiene_fuente_gov','horizonte_meses','convergencia')) = 4,
    'Faltan columnas en radar_scans';

  ASSERT (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = 'matec_radar'
      AND table_name   = 'radar_fuentes'
      AND column_name  = 'peso_fuente') = 1,
    'Falta columna peso_fuente en radar_fuentes';

  RAISE NOTICE 'Migration 008 OK — columnas radar_scans y radar_fuentes verificadas';
END $$;
