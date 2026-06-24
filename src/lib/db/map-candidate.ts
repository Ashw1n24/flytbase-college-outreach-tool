import type { Candidate, CandidateSource, CompetitionResult, PositionOfResponsibility } from "@/data/talent";
import type { Database } from "@/types/database";

type CandidateRow = Database["public"]["Tables"]["candidates"]["Row"];
type CompetitionRow = Database["public"]["Tables"]["competition_results"]["Row"];
type PorRow = Database["public"]["Tables"]["positions_of_responsibility"]["Row"];

export type CandidateWithRelations = CandidateRow & {
  competition_results?: CompetitionRow[] | null;
  positions_of_responsibility?: PorRow[] | null;
};

export function mapCompetition(row: CompetitionRow): CompetitionResult {
  return {
    competition_name: row.competition_name,
    competition_category: row.competition_category,
    result_tier: row.result_tier,
    year: row.year,
    team_name: row.team_name,
    source_url: row.source_url || null,
  };
}

export function mapPosition(row: PorRow): PositionOfResponsibility {
  return {
    organisation_name: row.organisation_name,
    role_title: row.role_title,
    por_category: row.por_category,
    year_start: row.year_start,
    year_end: row.year_end,
    source_url: row.source_url || null,
  };
}

export function mapCandidate(
  row: CandidateWithRelations,
  inPipeline = false,
): Candidate {
  return {
    id: row.id,
    full_name: row.full_name,
    university: row.university,
    degree: row.degree ?? null,
    branch: row.branch ?? null,
    graduation_year: row.graduation_year ?? null,
    source: (row.source ?? "competition_scrape") as CandidateSource,
    linkedin_url: row.linkedin_url,
    email: row.email,
    email_confidence: row.email_confidence,
    github_url: row.github_url,
    in_pipeline: inPipeline,
    created_at: row.created_at ?? undefined,
    competitions: (row.competition_results ?? []).map(mapCompetition),
    positions: (row.positions_of_responsibility ?? []).map(mapPosition),
    culture_score: row.culture_score ?? null,
  };
}
