-- Add persisted culture_score column to candidates (Jun 2026)

ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS culture_score INTEGER;

CREATE INDEX IF NOT EXISTS idx_candidates_culture_score
  ON candidates (culture_score);
