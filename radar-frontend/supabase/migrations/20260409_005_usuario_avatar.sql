-- Sprint 3.6 Phase 2: Add avatar_url column to usuarios table
ALTER TABLE matec_radar.usuarios
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;
