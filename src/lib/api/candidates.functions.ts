import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  getCandidateById,
  getCandidatesByIds,
  getCandidatesAfter,
  searchCandidates,
} from "@/lib/db/search-candidates.server";
import { mapCandidate, type CandidateWithRelations } from "@/lib/db/map-candidate";
import { computeStudentCultureFit } from "@/lib/utils/culturefit";
import { getSupabaseAdmin } from "@/lib/supabase.server";

const competitionCategorySchema = z.enum([
  "hardware",
  "software",
  "founders_office",
  "product_gtm",
]);

const resultTierSchema = z.enum([
  "winner",
  "runner_up",
  "top_3",
  "top_10",
  "finalist",
  "participant",
]);

const porCategorySchema = z.enum([
  "ecell",
  "technical_committee",
  "student_body",
]);

const candidateSourceSchema = z.enum([
  "competition_scrape",
  "google_search",
  "twitter",
  "linkedin",
  "manual",
]);

const searchParamsSchema = z.object({
  name: z.string().optional(),
  universities: z.array(z.string()).optional(),
  grad_year_min: z.number().int().optional(),
  grad_year_max: z.number().int().optional(),
  degrees: z.array(z.string()).optional(),
  branches: z.array(z.string()).optional(),
  has_email: z.boolean().optional(),
  sources: z.array(candidateSourceSchema).optional(),
  role_fit_labels: z.array(z.enum([
    "Agentic AI Engineer",
    "Software Engineer",
    "Product Manager",
    "Product Marketing",
    "Founder's Office",
    "BDR / Sales",
    "Marketing",
  ])).optional(),
  culture_fit_tiers: z.array(z.enum(["strong", "good", "partial"])).optional(),
  has_competition: z.boolean().optional(),
  competition_categories: z.array(competitionCategorySchema).optional(),
  competition_names: z.array(z.string()).optional(),
  result_tiers: z.array(resultTierSchema).optional(),
  comp_year_min: z.number().int().optional(),
  comp_year_max: z.number().int().optional(),
  has_por: z.boolean().optional(),
  por_categories: z.array(porCategorySchema).optional(),
  por_orgs: z.array(z.string()).optional(),
  por_leadership_only: z.boolean().optional(),
  por_year_min: z.number().int().optional(),
  por_year_max: z.number().int().optional(),
  page: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  sort_by: z.enum(["name", "graduation_year", "competition_count", "culture_score", "created_at"]).optional(),
  sort_dir: z.enum(["asc", "desc"]).optional(),
});

export const searchCandidatesFn = createServerFn({ method: "POST" })
  .validator(searchParamsSchema)
  .handler(async ({ data }) => {
    const supabase = getSupabaseAdmin();
    return searchCandidates(supabase, data);
  });

export const getCandidateByIdFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => {
    const supabase = getSupabaseAdmin();
    return getCandidateById(supabase, data.id);
  });

export const getCandidatesByIdsFn = createServerFn({ method: "POST" })
  .validator(z.object({ ids: z.array(z.string().min(1)) }))
  .handler(async ({ data }) => {
    const supabase = getSupabaseAdmin();
    return getCandidatesByIds(supabase, data.ids);
  });

export const getCandidatesAfterFn = createServerFn({ method: "POST" })
  .validator(z.object({ after: z.string(), before: z.string().optional() }))
  .handler(async ({ data }) => {
    const supabase = getSupabaseAdmin();
    return getCandidatesAfter(supabase, data.after, data.before);
  });

export const exportStudentCandidatesFn = createServerFn({ method: "POST" })
  .validator(searchParamsSchema.omit({ page: true, limit: true }))
  .handler(async ({ data }) => {
    const supabase = getSupabaseAdmin();
    return searchCandidates(supabase, { ...data, page: 0, limit: 10_000 });
  });

// ── Backfill: recompute culture_score for all existing candidates ────────────
export const recomputeStudentScoresFn = createServerFn({ method: "POST" })
  .handler(async () => {
    const supabase = getSupabaseAdmin();

    // Fetch all candidates with their relations in pages to avoid memory issues
    const PAGE_SIZE = 200;
    let offset = 0;
    let updated = 0;
    let errors = 0;

    while (true) {
      const { data, error } = await supabase
        .from("candidates")
        .select("*, competition_results(*), positions_of_responsibility(*)")
        .range(offset, offset + PAGE_SIZE - 1)
        .order("created_at", { ascending: true });

      if (error) throw error;
      if (!data || data.length === 0) break;

      for (const row of data as CandidateWithRelations[]) {
        const candidate = mapCandidate(row, false);
        const { score } = computeStudentCultureFit(candidate);
        const { error: updateError } = await supabase
          .from("candidates")
          .update({ culture_score: score })
          .eq("id", row.id);
        if (updateError) {
          errors++;
          console.warn("[backfill] update failed for", row.id, updateError.message);
        } else {
          updated++;
        }
      }

      if (data.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    return { updated, errors };
  });
