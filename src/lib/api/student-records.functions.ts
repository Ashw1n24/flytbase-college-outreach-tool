import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { getSupabaseAdmin } from "@/lib/supabase.server";
import { searchStudentRecords } from "@/lib/db/student-records.server";

const paramsSchema = z.object({
  name: z.string().min(1),
  college: z.string().optional(),
  limit: z.number().int().min(1).max(20).optional(),
});

export const resolveStudentEmailFn = createServerFn({ method: "POST" })
  .validator(paramsSchema)
  .handler(async ({ data }) => {
    const supabase = getSupabaseAdmin();
    const matches = await searchStudentRecords(supabase, {
      name: data.name,
      college: data.college,
      limit: data.limit,
    });

    return matches.map((m) => ({
      name: m.name,
      college: m.college,
      branch: m.branch,
      roll_number: m.roll_number,
      emails: [m.email_1, m.email_2, m.email_3].filter(Boolean),
    }));
  });
