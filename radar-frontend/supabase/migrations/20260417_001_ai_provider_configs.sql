CREATE TABLE IF NOT EXISTS matec_radar.ai_provider_configs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider        TEXT        NOT NULL CHECK (provider IN ('anthropic','openai','google')),
  label           TEXT        NOT NULL,
  model           TEXT        NOT NULL,
  api_key_enc     TEXT        NOT NULL,   -- store as-is; real encryption needs pgcrypto extension
  is_active       BOOLEAN     NOT NULL DEFAULT FALSE,
  is_default      BOOLEAN     NOT NULL DEFAULT FALSE,
  monthly_budget_usd NUMERIC(10,2),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE matec_radar.ai_provider_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_ai_provider_configs"
  ON matec_radar.ai_provider_configs FOR SELECT TO authenticated USING (TRUE);
GRANT ALL ON matec_radar.ai_provider_configs TO service_role;

-- Seed default configs (inactive by default, users must activate and add their keys)
INSERT INTO matec_radar.ai_provider_configs (provider, label, model, api_key_enc, is_active, is_default)
VALUES
  ('anthropic', 'Claude Sonnet 4.6', 'claude-sonnet-4-6', '', FALSE, TRUE),
  ('openai',    'GPT-4o',            'gpt-4o',            '', FALSE, FALSE),
  ('google',    'Gemini 2.0 Flash',  'gemini-2.0-flash',  '', FALSE, FALSE)
ON CONFLICT DO NOTHING;
