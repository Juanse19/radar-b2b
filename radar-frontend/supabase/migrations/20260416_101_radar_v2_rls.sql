-- RLS para tablas radar_v2_* — reutiliza roles ya existentes en matec_radar

ALTER TABLE matec_radar.radar_v2_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE matec_radar.radar_v2_results  ENABLE ROW LEVEL SECURITY;

-- Sessions: lectura para cualquier usuario autenticado
CREATE POLICY "radar_v2_sessions_select"
  ON matec_radar.radar_v2_sessions FOR SELECT
  TO authenticated USING (true);

-- Sessions: inserción solo desde service_role (Edge Function)
CREATE POLICY "radar_v2_sessions_insert"
  ON matec_radar.radar_v2_sessions FOR INSERT
  TO service_role WITH CHECK (true);

-- Results: lectura para cualquier usuario autenticado
CREATE POLICY "radar_v2_results_select"
  ON matec_radar.radar_v2_results FOR SELECT
  TO authenticated USING (true);

-- Results: inserción solo desde service_role (Edge Function)
CREATE POLICY "radar_v2_results_insert"
  ON matec_radar.radar_v2_results FOR INSERT
  TO service_role WITH CHECK (true);
