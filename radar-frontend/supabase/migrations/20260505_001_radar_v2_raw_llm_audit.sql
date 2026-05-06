-- Radar v2 — auditoría del JSON original del LLM antes del validador determinístico.
--
-- Motivación: la columna existente `raw_json` guarda el resultado POST-validación
-- (lo que ven UI/usuarios). Sin un snapshot del JSON crudo del LLM no podemos
-- distinguir si una decisión fue del modelo o del filtro determinístico — necesario
-- para diagnosticar falsos negativos como Grupo UMA / La Tebaida.
--
-- La nueva columna es nullable para preservar registros históricos. Los nuevos
-- escaneos la pueblan en el mismo INSERT que `raw_json`.

ALTER TABLE matec_radar.radar_v2_results
  ADD COLUMN IF NOT EXISTS raw_llm_json JSONB;

COMMENT ON COLUMN matec_radar.radar_v2_results.raw_llm_json IS
  'Snapshot del JSON original devuelto por el LLM antes de validateAgente1Result. Útil para auditar diferencias entre la decisión del modelo y el validador determinístico.';
