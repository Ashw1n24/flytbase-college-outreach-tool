import type { Candidate } from "@/data/talent";

export type CultureTier = "strong" | "good" | "partial";

export interface CultureFitResult {
  score: number;        // 0–100
  tier: CultureTier;
  breakdown: {
    agency: number;     // 0–35 : leadership in clubs/initiatives
    technical: number;  // 0–30 : competition performance
    initiative: number; // 0–25 : breadth across activities
    aiNative: number;   // 0–10 : AI/ML exposure
  };
}

const LEADERSHIP_KW = [
  "head", "lead", "core", "director", "president",
  "secretary", "founder", "co-founder", "chair",
];

const AI_KW = /\b(ai|ml|machine.?learning|deep.?learning|nlp|llm|neural|genai|generative)\b/i;

const TOP_TIERS = new Set(["winner", "runner_up", "top_3"]);
const TECH_CATS = new Set(["hardware", "software"]);

export function computeStudentCultureFit(candidate: Candidate): CultureFitResult {
  // ── High Agency (0–35): leading clubs & initiatives at college ──
  let agency = 0;
  const hasLeadership = candidate.positions.some((p) =>
    LEADERSHIP_KW.some((kw) => p.role_title.toLowerCase().includes(kw)),
  );
  if (hasLeadership) agency += 25;
  const distinctOrgs = new Set(candidate.positions.map((p) => p.organisation_name)).size;
  if (distinctOrgs >= 2) agency += 10;
  agency = Math.min(agency, 35);

  // ── Smart / Technical Depth (0–30): competition performance ──
  let technical = 0;
  const hasTopResult = candidate.competitions.some((c) => TOP_TIERS.has(c.result_tier));
  const hasTechComp = candidate.competitions.some((c) => TECH_CATS.has(c.competition_category));
  if (hasTopResult) technical += 20;
  else if (candidate.competitions.length > 0) technical += 10;
  if (hasTechComp) technical += 10;
  technical = Math.min(technical, 30);

  // ── Initiative Taking (0–25): breadth of engagement ──
  let initiative = 0;
  const hasBoth = candidate.competitions.length > 0 && candidate.positions.length > 0;
  const compCatCount = new Set(candidate.competitions.map((c) => c.competition_category)).size;
  if (hasBoth) initiative += 15;
  else if (candidate.competitions.length > 0 || candidate.positions.length > 0) initiative += 8;
  if (compCatCount >= 2) initiative += 10;
  initiative = Math.min(initiative, 25);

  // ── AI-Native (0–10): AI/ML keywords anywhere ──
  let aiNative = 0;
  const allText = [
    ...candidate.competitions.map((c) => c.competition_name),
    ...candidate.positions.map((p) => `${p.role_title} ${p.organisation_name}`),
    candidate.branch ?? "",
  ].join(" ");
  if (AI_KW.test(allText)) aiNative = 10;

  const score = agency + technical + initiative + aiNative;
  const tier: CultureTier = score >= 75 ? "strong" : score >= 50 ? "good" : "partial";

  return { score, tier, breakdown: { agency, technical, initiative, aiNative } };
}

export const CULTURE_TIER_META: Record<CultureTier, { label: string; className: string }> = {
  strong:  { label: "Strong Fit",  className: "bg-ok/15 text-ok border border-ok/30" },
  good:    { label: "Good Fit",    className: "bg-blue-500/15 text-blue-400 border border-blue-500/30" },
  partial: { label: "Partial Fit", className: "bg-warn/15 text-warn border border-warn/30" },
};
