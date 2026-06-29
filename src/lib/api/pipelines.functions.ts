import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase.server";
import { PIPELINE_ROLES } from "@/data/talent";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DbPipeline {
  id: string;
  name: string;
  description: string;
  role: string;
  candidate_ids: string[];     // student UUIDs
  exp_candidate_ids: string[]; // experienced UUIDs
  created_at: string;
}

// ---------------------------------------------------------------------------
// GET all pipelines
// ---------------------------------------------------------------------------

export const getPipelinesFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<DbPipeline[]> => {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("pipelines")
      .select("id, name, description, role, candidate_ids, exp_candidate_ids, created_at")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as DbPipeline[];
  },
);

// ---------------------------------------------------------------------------
// CREATE pipeline
// ---------------------------------------------------------------------------

export const createPipelineFn = createServerFn({ method: "POST" })
  .validator(z.object({ name: z.string().min(1), description: z.string().default(""), role: z.string().default("") }))
  .handler(async ({ data }): Promise<DbPipeline> => {
    const supabase = getSupabaseAdmin();
    const { data: row, error } = await supabase
      .from("pipelines")
      .insert({
        name: data.name,
        description: data.description || "Custom pipeline.",
        role: data.role || PIPELINE_ROLES[0],
        candidate_ids: [],
        exp_candidate_ids: [],
        created_by: "app",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row as DbPipeline;
  });

// ---------------------------------------------------------------------------
// RENAME pipeline
// ---------------------------------------------------------------------------

export const renamePipelineFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().uuid(), name: z.string().min(1) }))
  .handler(async ({ data }) => {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("pipelines")
      .update({ name: data.name })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
  });

// ---------------------------------------------------------------------------
// DELETE pipeline
// ---------------------------------------------------------------------------

export const deletePipelineFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("pipelines")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
  });

// ---------------------------------------------------------------------------
// ADD / REMOVE student member
// ---------------------------------------------------------------------------

export const addStudentMemberFn = createServerFn({ method: "POST" })
  .validator(z.object({ pipelineId: z.string().uuid(), candidateId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const supabase = getSupabaseAdmin();
    // Use Postgres array append — avoid duplicates with array_remove first
    const { error } = await supabase.rpc("pipeline_add_student", {
      p_pipeline_id:  data.pipelineId,
      p_candidate_id: data.candidateId,
    });
    if (error) throw new Error(error.message);
  });

export const removeStudentMemberFn = createServerFn({ method: "POST" })
  .validator(z.object({ pipelineId: z.string().uuid(), candidateId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.rpc("pipeline_remove_student", {
      p_pipeline_id:  data.pipelineId,
      p_candidate_id: data.candidateId,
    });
    if (error) throw new Error(error.message);
  });

// ---------------------------------------------------------------------------
// ADD / REMOVE experienced member
// ---------------------------------------------------------------------------

export const addExpMemberFn = createServerFn({ method: "POST" })
  .validator(z.object({ pipelineId: z.string().uuid(), candidateId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.rpc("pipeline_add_exp", {
      p_pipeline_id:  data.pipelineId,
      p_candidate_id: data.candidateId,
    });
    if (error) throw new Error(error.message);
  });

export const removeExpMemberFn = createServerFn({ method: "POST" })
  .validator(z.object({ pipelineId: z.string().uuid(), candidateId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.rpc("pipeline_remove_exp", {
      p_pipeline_id:  data.pipelineId,
      p_candidate_id: data.candidateId,
    });
    if (error) throw new Error(error.message);
  });
