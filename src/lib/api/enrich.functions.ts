import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { getSupabaseAdmin } from "@/lib/supabase.server";
import { enrichStudentCandidates } from "@/lib/db/enrich-candidates.server";

const enrichParamsSchema = z.object({
  /**
   * Maximum number of unenriched candidates to process in this run.
   * Defaults to 100. Hard cap at 500 to avoid timeouts.
   */
  limit: z.number().int().min(1).max(500).optional(),
  /**
   * Set true to skip the GitHub profile search (faster, uses only the
   * student_records DB). Useful if you're close to the GitHub rate limit.
   */
  skipGithub: z.boolean().optional(),
});

export const enrichStudentCandidatesFn = createServerFn({ method: "POST" })
  .validator(enrichParamsSchema)
  .handler(async ({ data }) => {
    const supabase = getSupabaseAdmin();
    return enrichStudentCandidates(supabase, {
      limit: data.limit,
      skipGithub: data.skipGithub,
    });
  });
