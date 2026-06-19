import { getSupabaseAdmin } from "@/lib/supabase.server";
import type { Database } from "@/types/database";

export type Competition =
  Database["public"]["Tables"]["competitions"]["Row"];

export type FlaggedCompetition =
  Database["public"]["Tables"]["flagged_competitions"]["Row"];

// The Supabase client generic resolves new tables as `never` until the
// generated types are regenerated — cast through `any` to unblock, same
// pattern as search-candidates.server.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => getSupabaseAdmin() as any;

export async function getActiveCompetitions(): Promise<Competition[]> {
  const { data, error } = await db()
    .from("competitions")
    .select("*")
    .eq("status", "active")
    .order("type")
    .order("name");
  if (error) throw error;
  return (data ?? []) as Competition[];
}

export async function getPendingFlaggedCompetitions(): Promise<FlaggedCompetition[]> {
  const { data, error } = await db()
    .from("flagged_competitions")
    .select("*")
    .eq("review_status", "pending")
    .order("detected_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as FlaggedCompetition[];
}

export async function deactivateCompetition(id: string): Promise<void> {
  const { error } = await db()
    .from("competitions")
    .update({ status: "inactive", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function dismissFlagged(id: string): Promise<void> {
  const { error } = await db()
    .from("flagged_competitions")
    .update({ review_status: "dismissed", reviewed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function approveFlagged(
  flaggedId: string,
  competition: {
    id: string;
    name: string;
    short_name: string;
    type: string;
    role_clusters: string[];
  },
): Promise<void> {
  const { error: insertErr } = await db().from("competitions").insert({
    id: competition.id,
    name: competition.name,
    short_name: competition.short_name || null,
    type: competition.type,
    role_clusters: competition.role_clusters,
    status: "active",
    source: "auto_detected",
  });
  if (insertErr) throw insertErr;

  const { error: updateErr } = await db()
    .from("flagged_competitions")
    .update({
      review_status: "approved",
      reviewed_at: new Date().toISOString(),
      competition_id: competition.id,
    })
    .eq("id", flaggedId);
  if (updateErr) throw updateErr;
}
