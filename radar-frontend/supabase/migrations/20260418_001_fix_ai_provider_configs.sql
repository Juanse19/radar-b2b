-- Fix UNIQUE constraint so ON CONFLICT works
ALTER TABLE matec_radar.ai_provider_configs
  DROP CONSTRAINT IF EXISTS ai_provider_configs_provider_key;

ALTER TABLE matec_radar.ai_provider_configs
  ADD CONSTRAINT ai_provider_configs_provider_key UNIQUE (provider);

-- Fix wrong Gemini model in seed
UPDATE matec_radar.ai_provider_configs
  SET model = 'gemini-2.0-flash'
  WHERE provider = 'google' AND model = 'gemini-3-pro';
