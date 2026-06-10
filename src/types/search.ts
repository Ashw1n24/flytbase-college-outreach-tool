import type {
  CompetitionCategory,
  PorCategory,
  ResultTier,
} from "@/data/talent";

export type SortField = "name" | "graduation_year" | "competition_count";
export type SortDirection = "asc" | "desc";

export interface SearchParams {
  name?: string;
  universities?: string[];
  grad_year_min?: number;
  grad_year_max?: number;
  degrees?: string[];
  branches?: string[];
  has_competition?: boolean;
  competition_categories?: CompetitionCategory[];
  competition_names?: string[];
  result_tiers?: ResultTier[];
  comp_year_min?: number;
  comp_year_max?: number;
  has_por?: boolean;
  por_categories?: PorCategory[];
  por_orgs?: string[];
  por_leadership_only?: boolean;
  por_year_min?: number;
  por_year_max?: number;
  page?: number;
  limit?: number;
  sort_by?: SortField;
  sort_dir?: SortDirection;
}

export interface SearchResult {
  candidates: import("@/data/talent").Candidate[];
  totalCount: number;
  page: number;
  limit: number;
}
