-- Agrega límite de tokens diario y semanal por usuario (null = sin límite)

ALTER TABLE matec_radar.usuarios
  ADD COLUMN IF NOT EXISTS daily_token_limit   INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS weekly_token_limit  INTEGER DEFAULT NULL;

COMMENT ON COLUMN matec_radar.usuarios.daily_token_limit  IS 'Máximo de tokens permitidos por día (null = ilimitado)';
COMMENT ON COLUMN matec_radar.usuarios.weekly_token_limit IS 'Máximo de tokens permitidos por semana (null = ilimitado)';
