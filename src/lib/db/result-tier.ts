import type { ResultTier } from "@/data/talent";

export const RESULT_TIER_HIERARCHY: ResultTier[] = [
  "winner",
  "runner_up",
  "top_3",
  "top_10",
  "finalist",
  "participant",
];

/** Selecting a tier includes all better tiers (PRD §5.2). */
export function expandResultTiers(selected: ResultTier[]): ResultTier[] {
  const expanded = new Set<ResultTier>();
  for (const tier of selected) {
    const idx = RESULT_TIER_HIERARCHY.indexOf(tier);
    if (idx >= 0) {
      RESULT_TIER_HIERARCHY.slice(0, idx + 1).forEach((t) => expanded.add(t));
    }
  }
  return [...expanded];
}
