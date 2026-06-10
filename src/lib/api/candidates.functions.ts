import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  getCandidateById,
  getCandidatesByIds,
  searchCandidates,
} from "@/lib/db/search-candidates.server";
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
  "cultural_fest",
  "student_body",
  "sports",
]);

const searchParamsSchema = z.object({
  name: z.string().optional(),
  universities: z.array(z.string()).optional(),
  grad_year_min: z.number().int().optional(),
  grad_year_max: z.number().int().optional(),
  degrees: z.array(z.string()).optional(),
  branches: z.array(z.string()).optional(),
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
  sort_by: z.enum(["name", "graduation_year", "competition_count"]).optional(),
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
