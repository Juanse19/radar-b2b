-- Migration: 20260423_001_agent_prompts.sql
-- Table for editable AI agent prompts (admin-overridable system prompts per provider)

CREATE TABLE IF NOT EXISTS matec_radar.agent_prompts (
  id            SERIAL PRIMARY KEY,
  provider      TEXT NOT NULL CHECK (provider IN ('claude', 'openai', 'gemini')),
  system_prompt TEXT NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by    TEXT,
  CONSTRAINT agent_prompts_provider_unique UNIQUE (provider)
);

ALTER TABLE matec_radar.agent_prompts ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read prompts (needed for admin UI reads via Supabase client)
CREATE POLICY "select_agent_prompts"
  ON matec_radar.agent_prompts
  FOR SELECT
  TO authenticated
  USING (TRUE);

-- Full access for server-side operations via service role
GRANT ALL ON matec_radar.agent_prompts TO service_role;
GRANT USAGE, SELECT ON SEQUENCE matec_radar.agent_prompts_id_seq TO service_role;
