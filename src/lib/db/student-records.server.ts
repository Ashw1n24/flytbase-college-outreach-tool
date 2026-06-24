import type { SupabaseClient } from "@supabase/supabase-js";

export async function searchStudentRecords(
  supabase: SupabaseClient<any>,
  params: { name?: string; college?: string; limit?: number },
) {
  const limit = params.limit ?? 5;
  let q = supabase
    .from("student_records")
    .select("name,college,branch,roll_number,email_1,email_2,email_3")
    .limit(limit);

  if (params.name?.trim()) {
    q = q.ilike("name", `%${params.name.trim()}%`);
  }
  if (params.college?.trim()) {
    q = q.eq("college", params.college.trim());
  }

  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}
