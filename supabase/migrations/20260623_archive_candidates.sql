-- Add soft-delete (archive) support to experienced_candidates
ALTER TABLE experienced_candidates
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_experienced_candidates_archived
  ON experienced_candidates (is_archived);
