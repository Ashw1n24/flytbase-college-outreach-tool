-- High-Agency Talent Sourcing Engine — core schema (PRD v1.2)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── candidates ────────────────────────────────────────────────────────────────

CREATE TABLE candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  university TEXT NOT NULL,
  degree TEXT NOT NULL,
  branch TEXT NOT NULL,
  graduation_year INTEGER NOT NULL,
  linkedin_url TEXT,
  email TEXT,
  email_confidence TEXT CHECK (
    email_confidence IN ('github_profile', 'github_commit', 'inferred')
  ),
  github_url TEXT,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (
    source IN ('competition_scrape', 'manual')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_candidates_university ON candidates (university);
CREATE INDEX idx_candidates_graduation_year ON candidates (graduation_year);
CREATE INDEX idx_candidates_full_name ON candidates (full_name);

-- ── competition_results ───────────────────────────────────────────────────────

CREATE TABLE competition_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates (id) ON DELETE CASCADE,
  competition_name TEXT NOT NULL,
  competition_category TEXT NOT NULL CHECK (
    competition_category IN (
      'hardware',
      'software',
      'founders_office',
      'product_gtm'
    )
  ),
  result_tier TEXT NOT NULL CHECK (
    result_tier IN (
      'winner',
      'runner_up',
      'top_3',
      'top_10',
      'finalist',
      'participant'
    )
  ),
  year INTEGER NOT NULL,
  team_name TEXT,
  source_url TEXT NOT NULL DEFAULT '',
  ingestion_method TEXT NOT NULL DEFAULT 'manual' CHECK (
    ingestion_method IN ('api', 'html_scrape', 'pdf_parse', 'manual')
  )
);

CREATE INDEX idx_competition_results_candidate_id
  ON competition_results (candidate_id);
CREATE INDEX idx_competition_results_category
  ON competition_results (competition_category);
CREATE INDEX idx_competition_results_tier ON competition_results (result_tier);
CREATE INDEX idx_competition_results_year ON competition_results (year);
CREATE INDEX idx_competition_results_name ON competition_results (competition_name);

-- ── positions_of_responsibility ─────────────────────────────────────────────

CREATE TABLE positions_of_responsibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates (id) ON DELETE CASCADE,
  organisation_name TEXT NOT NULL,
  role_title TEXT NOT NULL,
  por_category TEXT NOT NULL CHECK (
    por_category IN (
      'ecell',
      'technical_committee',
      'cultural_fest',
      'student_body',
      'sports'
    )
  ),
  institution TEXT NOT NULL DEFAULT '',
  year_start INTEGER NOT NULL,
  year_end INTEGER,
  source_url TEXT NOT NULL DEFAULT '',
  ingestion_method TEXT NOT NULL DEFAULT 'manual' CHECK (
    ingestion_method IN ('api', 'html_scrape', 'manual')
  )
);

CREATE INDEX idx_por_candidate_id ON positions_of_responsibility (candidate_id);
CREATE INDEX idx_por_category ON positions_of_responsibility (por_category);
CREATE INDEX idx_por_organisation ON positions_of_responsibility (organisation_name);
CREATE INDEX idx_por_year_start ON positions_of_responsibility (year_start);

-- ── pipelines ─────────────────────────────────────────────────────────────────

CREATE TABLE pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by TEXT NOT NULL DEFAULT 'system',
  candidate_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT
);

-- ── scraper_health_log ────────────────────────────────────────────────────────

CREATE TABLE scraper_health_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scraper_name TEXT NOT NULL,
  run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('ok', 'degraded', 'failed')),
  records_extracted INTEGER NOT NULL DEFAULT 0,
  records_expected_min INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  source_url TEXT NOT NULL DEFAULT '',
  alert_sent BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_scraper_health_log_name ON scraper_health_log (scraper_name);
CREATE INDEX idx_scraper_health_log_run_at ON scraper_health_log (run_at DESC);

-- ── rate_limit_log ────────────────────────────────────────────────────────────

CREATE TABLE rate_limit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service TEXT NOT NULL CHECK (service IN ('duckduckgo', 'github')),
  date DATE NOT NULL,
  requests_made INTEGER NOT NULL DEFAULT 0,
  daily_ceiling INTEGER NOT NULL,
  ceiling_hit BOOLEAN NOT NULL DEFAULT FALSE,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (service, date)
);

CREATE INDEX idx_rate_limit_log_service_date ON rate_limit_log (service, date);

-- ── RPC: increment_rate_limit (DuckDuckGo / GitHub daily counters) ──────────

CREATE OR REPLACE FUNCTION increment_rate_limit (
  p_service TEXT,
  p_date DATE,
  p_ceiling INTEGER
) RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO rate_limit_log (
    service,
    date,
    requests_made,
    daily_ceiling,
    ceiling_hit
  )
  VALUES (p_service, p_date, 1, p_ceiling, FALSE)
  ON CONFLICT (service, date) DO UPDATE
  SET
    requests_made = rate_limit_log.requests_made + 1,
    ceiling_hit = (rate_limit_log.requests_made + 1) >= p_ceiling,
    last_updated = NOW();
END;
$$;
