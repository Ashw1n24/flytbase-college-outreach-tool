import type { Candidate, CompetitionCategory, PorCategory } from "@/data/talent";

export type RoleFitLabel =
  | "Agentic AI Engineer"
  | "Software Engineer"
  | "Product Manager"
  | "Product Marketing"
  | "Founder's Office"
  | "BDR / Sales"
  | "Marketing";

// Competition category → roles it signals
const CATEGORY_ROLES: Record<CompetitionCategory, RoleFitLabel[]> = {
  hardware:        ["Agentic AI Engineer"],
  software:        ["Software Engineer", "Agentic AI Engineer"],
  founders_office: ["Founder's Office"],
  product_gtm:     ["Product Manager", "BDR / Sales"],
};

// POR category → roles it signals
const POR_CATEGORY_ROLES: Record<PorCategory, RoleFitLabel[]> = {
  ecell:               ["Founder's Office", "BDR / Sales"],
  technical_committee: ["Software Engineer"],
  student_body:        ["Founder's Office"],
};

// Keyword patterns in role_title/organisation_name → additional roles
const ROLE_KEYWORD_SIGNALS: Array<{ re: RegExp; roles: RoleFitLabel[] }> = [
  { re: /\b(ai|ml|machine.?learning|deep.?learning|nlp|llm)\b/i, roles: ["Agentic AI Engineer"] },
  { re: /\b(product|pm\b)/i,                                      roles: ["Product Manager"] },
  { re: /\b(marketing|brand|content|growth)\b/i,                  roles: ["Product Marketing", "Marketing"] },
  { re: /\b(sales|business.?dev|bdr|sdr|partnerships)\b/i,        roles: ["BDR / Sales"] },
  { re: /\b(founder|ceo|cto|co.?founder|startup)\b/i,             roles: ["Founder's Office"] },
  { re: /\b(software|engineer|developer|dev|sde|swe|backend|frontend|fullstack)\b/i, roles: ["Software Engineer"] },
];

export function computeRoleFit(candidate: Candidate): RoleFitLabel[] {
  const roles = new Set<RoleFitLabel>();

  for (const comp of candidate.competitions) {
    for (const role of CATEGORY_ROLES[comp.competition_category] ?? []) {
      roles.add(role);
    }
  }

  for (const por of candidate.positions) {
    for (const role of POR_CATEGORY_ROLES[por.por_category] ?? []) {
      roles.add(role);
    }
    const text = `${por.role_title} ${por.organisation_name}`;
    for (const { re, roles: kRoles } of ROLE_KEYWORD_SIGNALS) {
      if (re.test(text)) {
        for (const r of kRoles) roles.add(r);
      }
    }
  }

  // Prefer "Agentic AI Engineer" over plain "Software Engineer" when both fire
  if (roles.has("Agentic AI Engineer") && roles.has("Software Engineer")) {
    roles.delete("Software Engineer");
  }

  // Canonical display order
  const ORDER: RoleFitLabel[] = [
    "Agentic AI Engineer",
    "Software Engineer",
    "Product Manager",
    "Product Marketing",
    "Founder's Office",
    "BDR / Sales",
    "Marketing",
  ];
  return ORDER.filter((r) => roles.has(r));
}

export const ROLE_FIT_STYLE: Record<RoleFitLabel, string> = {
  "Agentic AI Engineer": "bg-[#6B21A8] text-white",
  "Software Engineer":   "bg-[#1D4ED8] text-white",
  "Product Manager":     "bg-[#0F766E] text-white",
  "Product Marketing":   "bg-[#0E7490] text-white",
  "Founder's Office":    "bg-[#C2410C] text-white",
  "BDR / Sales":         "bg-[#15803D] text-white",
  "Marketing":           "bg-[#BE185D] text-white",
};
