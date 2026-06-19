-- Enable Row Level Security on all tables
-- service_role bypasses RLS natively in Postgres/Supabase; no explicit policy needed for it.
-- No policies are defined below, so anon and authenticated roles are denied by default.

ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE competition_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions_of_responsibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE scraper_health_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE experienced_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE target_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE flagged_competitions ENABLE ROW LEVEL SECURITY;
