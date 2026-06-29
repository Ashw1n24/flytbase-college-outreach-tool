-- Add missing columns to pipelines table for cross-device support
ALTER TABLE pipelines
  ADD COLUMN IF NOT EXISTS description       TEXT   NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS role              TEXT   NOT NULL DEFAULT 'Agentic AI Engineer',
  ADD COLUMN IF NOT EXISTS exp_candidate_ids UUID[] NOT NULL DEFAULT '{}';

-- Helper RPCs for array membership (avoids duplicates)
CREATE OR REPLACE FUNCTION pipeline_add_student(p_pipeline_id UUID, p_candidate_id UUID)
RETURNS VOID LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE pipelines
  SET candidate_ids = array_append(
    array_remove(candidate_ids, p_candidate_id), p_candidate_id
  )
  WHERE id = p_pipeline_id;
$$;

CREATE OR REPLACE FUNCTION pipeline_remove_student(p_pipeline_id UUID, p_candidate_id UUID)
RETURNS VOID LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE pipelines
  SET candidate_ids = array_remove(candidate_ids, p_candidate_id)
  WHERE id = p_pipeline_id;
$$;

CREATE OR REPLACE FUNCTION pipeline_add_exp(p_pipeline_id UUID, p_candidate_id UUID)
RETURNS VOID LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE pipelines
  SET exp_candidate_ids = array_append(
    array_remove(exp_candidate_ids, p_candidate_id), p_candidate_id
  )
  WHERE id = p_pipeline_id;
$$;

CREATE OR REPLACE FUNCTION pipeline_remove_exp(p_pipeline_id UUID, p_candidate_id UUID)
RETURNS VOID LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE pipelines
  SET exp_candidate_ids = array_remove(exp_candidate_ids, p_candidate_id)
  WHERE id = p_pipeline_id;
$$;
