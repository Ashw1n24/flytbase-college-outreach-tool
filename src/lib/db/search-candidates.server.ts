import type { SupabaseClient } from "@supabase/supabase-js";

import type { Candidate } from "@/data/talent";
import {
  mapCandidate,
  type CandidateWithRelations,
} from "@/lib/db/map-candidate";
import { expandResultTiers } from "@/lib/db/result-tier";
import { computeRoleFit, type RoleFitLabel } from "@/lib/utils/rolefit";
import { computeStudentCultureFit, type CultureTier } from "@/lib/utils/culturefit";
import type { Database } from "@/types/database";
import type { SearchParams, SearchResult } from "@/types/search";

const CANDIDATE_SELECT = `
  *,
  competition_results (*),
  positions_of_responsibility (*)
`;

const LEADERSHIP_KEYWORDS = [
  "Head",
  "Lead",
  "Core",
  "Director",
  "President",
  "Secretary",
];

function intersect(a: Set<string>, b: Set<string>): Set<string> {
  const out = new Set<string>();
  for (const id of a) {
    if (b.has(id)) out.add(id);
  }
  return out;
}

function hasBuilderSubFilters(params: SearchParams): boolean {
  return Boolean(
    params.competition_categories?.length ||
      params.competition_names?.length ||
      params.result_tiers?.length ||
      params.comp_year_min != null ||
      params.comp_year_max != null,
  );
}

function hasAgencySubFilters(params: SearchParams): boolean {
  return Boolean(
    params.por_categories?.length ||
      params.por_orgs?.length ||
      params.por_leadership_only ||
      params.por_year_min != null ||
      params.por_year_max != null,
  );
}

async function fetchCompetitionCandidateIds(
  supabase: SupabaseClient<Database>,
  params: SearchParams,
): Promise<Set<string> | null> {
  if (!params.has_competition && !hasBuilderSubFilters(params)) {
    return null;
  }

  let query = supabase.from("competition_results").select("candidate_id");

  if (params.competition_categories?.length) {
    query = query.in("competition_category", params.competition_categories);
  }
  if (params.competition_names?.length) {
    query = query.in("competition_name", params.competition_names);
  }
  if (params.result_tiers?.length) {
    query = query.in("result_tier", expandResultTiers(params.result_tiers));
  }
  if (params.comp_year_min != null) {
    query = query.gte("year", params.comp_year_min);
  }
  if (params.comp_year_max != null) {
    query = query.lte("year", params.comp_year_max);
  }

  const { data, error } = await query;
  if (error) throw error;

  return new Set((data ?? []).map((row) => row.candidate_id));
}

async function fetchPorCandidateIds(
  supabase: SupabaseClient<Database>,
  params: SearchParams,
): Promise<Set<string> | null> {
  if (!params.has_por && !hasAgencySubFilters(params)) {
    return null;
  }

  let query = supabase.from("positions_of_responsibility").select("candidate_id");

  if (params.por_categories?.length) {
    query = query.in("por_category", params.por_categories);
  }
  if (params.por_orgs?.length) {
    query = query.in("organisation_name", params.por_orgs);
  }
  if (params.por_year_min != null) {
    query = query.or(
      `year_end.is.null,year_end.gte.${params.por_year_min}`,
    );
  }
  if (params.por_year_max != null) {
    query = query.lte("year_start", params.por_year_max);
  }

  const { data, error } = await query;
  if (error) throw error;

  let ids = data ?? [];

  if (params.por_leadership_only) {
    const { data: leadershipRows, error: leadershipError } = await supabase
      .from("positions_of_responsibility")
      .select("candidate_id, role_title");

    if (leadershipError) throw leadershipError;

    const leadershipIds = new Set(
      (leadershipRows ?? [])
        .filter((row) =>
          LEADERSHIP_KEYWORDS.some((kw) =>
            row.role_title.toLowerCase().includes(kw.toLowerCase()),
          ),
        )
        .map((row) => row.candidate_id),
    );

    ids = ids.filter((row) => leadershipIds.has(row.candidate_id));
  }

  return new Set(ids.map((row) => row.candidate_id));
}

type CandidatesQuery = ReturnType<
  ReturnType<SupabaseClient<Database>["from"]>["select"]
>;

function applyStandardFilters(query: CandidatesQuery, params: SearchParams) {
  let q = query;

  if (params.name?.trim()) {
    q = q.ilike("full_name", `%${params.name.trim()}%`);
  }
  if (params.universities?.length) {
    q = q.in("university", params.universities);
  }

  // Grad year: include rows where graduation_year is null (google_search candidates
  // have no grad year stored). Only exclude nulls when no year filter is active.
  if (params.grad_year_min != null && params.grad_year_max != null) {
    q = q.or(
      `graduation_year.is.null,and(graduation_year.gte.${params.grad_year_min},graduation_year.lte.${params.grad_year_max})`,
    );
  } else if (params.grad_year_min != null) {
    q = q.or(`graduation_year.is.null,graduation_year.gte.${params.grad_year_min}`);
  } else if (params.grad_year_max != null) {
    q = q.or(`graduation_year.is.null,graduation_year.lte.${params.grad_year_max}`);
  }

  // Degree / branch: null means not collected — show those rows unless the user
  // explicitly picks a degree/branch filter.
  if (params.degrees?.length) {
    const inList = params.degrees.map((d) => `"${d}"`).join(",");
    q = q.or(`degree.is.null,degree.in.(${inList})`);
  }
  if (params.branches?.length) {
    const inList = params.branches.map((b) => `"${b}"`).join(",");
    q = q.or(`branch.is.null,branch.in.(${inList})`);
  }

  // Source filter: opt-in — only applied when the user picks one or more sources.
  if (params.sources?.length) {
    q = q.in("source", params.sources);
  }

  if (params.has_email) {
    q = q.not("email", "is", null);
  }

  return q;
}

async function sortIdsByCompetitionCount(
  supabase: SupabaseClient<Database>,
  ids: string[],
  sortDir: "asc" | "desc",
): Promise<string[]> {
  const { data } = await supabase
    .from("competition_results")
    .select("candidate_id")
    .in("candidate_id", ids);

  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, 0);
  for (const row of data ?? []) {
    counts.set(row.candidate_id, (counts.get(row.candidate_id) ?? 0) + 1);
  }

  return [...ids].sort((a, b) => {
    const diff = (counts.get(a) ?? 0) - (counts.get(b) ?? 0);
    return sortDir === "asc" ? diff : -diff;
  });
}

async function fetchPipelineMemberIds(
  supabase: SupabaseClient<Database>,
): Promise<Set<string>> {
  const { data, error } = await supabase.from("pipelines").select("candidate_ids");
  if (error) throw error;

  const ids = new Set<string>();
  for (const pipeline of data ?? []) {
    for (const id of pipeline.candidate_ids ?? []) {
      ids.add(id);
    }
  }
  return ids;
}

function filterByRoleFit(candidates: Candidate[], labels: RoleFitLabel[]): Candidate[] {
  if (!labels.length) return candidates;
  const wanted = new Set(labels);
  return candidates.filter((c) => computeRoleFit(c).some((r) => wanted.has(r)));
}

function filterByCultureFit(candidates: Candidate[], tiers: CultureTier[]): Candidate[] {
  if (!tiers.length) return candidates;
  const wanted = new Set(tiers);
  return candidates.filter((c) => wanted.has(computeStudentCultureFit(c).tier));
}

export async function searchCandidates(
  supabase: SupabaseClient<Database>,
  params: SearchParams,
): Promise<SearchResult> {
  const page = params.page ?? 0;
  const limit = params.limit ?? 50;
  const sortBy = params.sort_by ?? "graduation_year";
  const sortDir = params.sort_dir ?? "desc";

  const [compIds, porIds, pipelineIds] = await Promise.all([
    fetchCompetitionCandidateIds(supabase, params),
    fetchPorCandidateIds(supabase, params),
    fetchPipelineMemberIds(supabase),
  ]);

  let relationFilter: Set<string> | null = null;
  if (compIds && porIds) {
    relationFilter = intersect(compIds, porIds);
  } else if (compIds) {
    relationFilter = compIds;
  } else if (porIds) {
    relationFilter = porIds;
  }

  if (relationFilter && relationFilter.size === 0) {
    return { candidates: [], totalCount: 0, page, limit };
  }

  if (sortBy === "competition_count" && relationFilter) {
    let idQuery = supabase.from("candidates").select("id");
    idQuery = applyStandardFilters(idQuery, params);
    idQuery = idQuery.in("id", [...relationFilter]);

    const { data: idRows, error: idError } = await idQuery;
    if (idError) throw idError;

    const sortedIds = await sortIdsByCompetitionCount(
      supabase,
      (idRows ?? []).map((r) => r.id),
      sortDir,
    );

    const pageIds = sortedIds.slice(page * limit, page * limit + limit);
    if (pageIds.length === 0) {
      return { candidates: [], totalCount: sortedIds.length, page, limit };
    }

    const { data, error } = await supabase
      .from("candidates")
      .select(CANDIDATE_SELECT)
      .in("id", pageIds);

    if (error) throw error;

    const byId = new Map(
      (data as CandidateWithRelations[] | null)?.map((row) => [row.id, row]) ?? [],
    );
    let candidates = pageIds
      .map((id) => byId.get(id))
      .filter((row): row is CandidateWithRelations => Boolean(row))
      .map((row) => mapCandidate(row, pipelineIds.has(row.id)));

    candidates = filterByRoleFit(candidates, params.role_fit_labels ?? []);
    candidates = filterByCultureFit(candidates, params.culture_fit_tiers ?? []);

    return {
      candidates,
      totalCount: sortedIds.length,
      page,
      limit,
    };
  }

  let query = supabase
    .from("candidates")
    .select(CANDIDATE_SELECT, { count: "exact" });

  query = applyStandardFilters(query, params);

  if (relationFilter) {
    query = query.in("id", [...relationFilter]);
  }

  if (sortBy === "name") {
    query = query.order("full_name", { ascending: sortDir === "asc" });
  } else if (sortBy === "graduation_year") {
    query = query.order("graduation_year", {
      ascending: sortDir === "asc",
      nullsFirst: sortDir === "desc",
    });
  } else if (sortBy === "email") {
    // Candidates with an email address first, then nulls; secondary by created_at
    query = query
      .order("email", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });
  } else if (sortBy === "culture_score") {
    // DB column — sort natively so cross-page ordering is correct.
    query = query.order("culture_score", { ascending: sortDir === "asc", nullsFirst: false });
  } else if (sortBy === "created_at") {
    query = query.order("created_at", { ascending: sortDir === "asc" });
  } else if (sortBy === "competition_count") {
    // Computed in-memory; pre-sort by grad year for a stable within-page order.
    query = query.order("graduation_year", { ascending: false, nullsFirst: true });
  }

  query = query.range(page * limit, page * limit + limit - 1);

  const { data, count, error } = await query;
  if (error) throw error;

  let candidates = ((data as CandidateWithRelations[] | null) ?? []).map((row) =>
    mapCandidate(row, pipelineIds.has(row.id)),
  );

  if (sortBy === "competition_count") {
    candidates = [...candidates].sort((a, b) => {
      const diff = a.competitions.length - b.competitions.length;
      return sortDir === "asc" ? diff : -diff;
    });
  }
  // culture_score is now sorted by DB ORDER BY above — no in-memory sort needed.

  candidates = filterByRoleFit(candidates, params.role_fit_labels ?? []);

  return {
    candidates,
    totalCount: count ?? candidates.length,
    page,
    limit,
  };
}

export async function getCandidatesByIds(
  supabase: SupabaseClient<Database>,
  ids: string[],
): Promise<Candidate[]> {
  if (ids.length === 0) return [];

  const [pipelineIds, candidateResult] = await Promise.all([
    fetchPipelineMemberIds(supabase),
    supabase.from("candidates").select(CANDIDATE_SELECT).in("id", ids),
  ]);

  if (candidateResult.error) throw candidateResult.error;

  const byId = new Map(
    ((candidateResult.data as CandidateWithRelations[] | null) ?? []).map(
      (row) => [row.id, row],
    ),
  );

  return ids
    .map((id) => byId.get(id))
    .filter((row): row is CandidateWithRelations => Boolean(row))
    .map((row) => mapCandidate(row, pipelineIds.has(row.id)));
}

export async function getCandidatesAfter(
  supabase: SupabaseClient<Database>,
  after: string,
  before?: string,
): Promise<Candidate[]> {
  let candidateQuery = supabase
    .from("candidates")
    .select(CANDIDATE_SELECT)
    .gte("created_at", after)
    .order("created_at", { ascending: false })
    .limit(200);

  if (before) {
    candidateQuery = candidateQuery.lte("created_at", before);
  }

  const [pipelineIds, result] = await Promise.all([
    fetchPipelineMemberIds(supabase),
    candidateQuery,
  ]);

  if (result.error) throw result.error;

  return ((result.data as CandidateWithRelations[] | null) ?? []).map((row) =>
    mapCandidate(row, pipelineIds.has(row.id)),
  );
}

export async function getCandidateById(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<Candidate | null> {
  const [pipelineIds, candidateResult] = await Promise.all([
    fetchPipelineMemberIds(supabase),
    supabase
      .from("candidates")
      .select(CANDIDATE_SELECT)
      .eq("id", id)
      .maybeSingle(),
  ]);

  if (candidateResult.error) throw candidateResult.error;
  if (!candidateResult.data) return null;

  return mapCandidate(
    candidateResult.data as CandidateWithRelations,
    pipelineIds.has(id),
  );
}
