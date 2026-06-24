export type CompetitionCategory =
  | "hardware"
  | "software"
  | "founders_office"
  | "product_gtm";

export type ResultTier =
  | "winner"
  | "runner_up"
  | "top_3"
  | "top_10"
  | "finalist"
  | "participant";

export type PorCategory =
  | "ecell"
  | "technical_committee"
  | "student_body";

export type EmailConfidence = "github_profile" | "github_commit" | "inferred";

export type CandidateSource =
  | "competition_scrape"
  | "google_search"
  | "twitter"
  | "linkedin"
  | "manual";

export const SOURCES: { value: CandidateSource; label: string }[] = [
  { value: "competition_scrape", label: "Competition" },
  { value: "twitter",            label: "Twitter / X" },
  { value: "linkedin",           label: "LinkedIn" },
  { value: "google_search",      label: "Google Search" },
  { value: "manual",             label: "Manual" },
];

export interface CompetitionResult {
  competition_name: string;
  competition_category: CompetitionCategory;
  result_tier: ResultTier;
  year: number;
  team_name?: string | null;
  source_url?: string | null;
}

export interface PositionOfResponsibility {
  organisation_name: string;
  role_title: string;
  por_category: PorCategory;
  year_start: number;
  year_end: number | null;
  source_url?: string | null;
}

export interface Candidate {
  id: string;
  full_name: string;
  university: string;
  degree: string | null;
  branch: string | null;
  graduation_year: number | null;
  source: CandidateSource;
  linkedin_url: string | null;
  email: string | null;
  email_confidence: EmailConfidence | null;
  github_url: string | null;
  culture_score: number | null;
  in_pipeline?: boolean;
  created_at?: string;
  competitions: CompetitionResult[];
  positions: PositionOfResponsibility[];
}

export const UNIVERSITIES = [
  "IIT Bombay",
  "IIT Delhi",
  "IIT Madras",
  "IIT Kharagpur",
  "IIT Kanpur",
  "IIT Roorkee",
  "IIT Guwahati",
  "IIT Hyderabad",
  "BITS Pilani",
  "NIT Trichy",
  "NIT Surathkal",
  "IIIT Hyderabad",
  "IIIT Delhi",
  "IIM Ahmedabad",
  "IIM Bangalore",
  "ISB Hyderabad",
  "XLRI Jamshedpur",
];

export const DEGREES = ["B.Tech", "B.E.", "Dual Degree", "MBA", "M.Tech"];

export const BRANCHES = [
  "CS/IT",
  "Electrical/Electronics",
  "Mechanical",
  "Aerospace",
  "Civil",
  "Management",
];

export const COMPETITION_CATEGORIES: {
  value: CompetitionCategory;
  label: string;
}[] = [
  { value: "hardware", label: "Hardware" },
  { value: "software", label: "Software" },
  { value: "founders_office", label: "Founders Office" },
  { value: "product_gtm", label: "Product GTM" },
];

export const COMPETITIONS_BY_CATEGORY: Record<CompetitionCategory, string[]> = {
  hardware: [
    "Smart India Hackathon – Hardware",
    "Inter IIT Tech Meet – Hardware",
    "e-Yantra Robotics Competition",
    "Robocon India",
    "TechFest Robotics (IIT Bombay)",
    "BAJA SAE India",
    "Shaastra – Robotics",
    "MathWorks Minidrone",
  ],
  software: [
    "Smart India Hackathon – Software",
    "ETHIndia",
    "Google Summer of Code",
    "Inter IIT Tech Meet – Software",
    "Flipkart Grid",
    "Amazon ML Challenge",
    "GDSC Solution Challenge",
    "TCS CodeVita",
  ],
  founders_office: [
    "E-Cell IIT Bombay – Eureka!",
    "E-Summit IIT Kharagpur",
    "Hult Prize India",
    "Conquest BITS Pilani",
    "TiE University Pitch",
  ],
  product_gtm: [
    "HUL LIME",
    "Mahindra War Room",
    "BCG Strategy Competition",
    "L'Oreal Brandstorm India",
    "Tata Crucible B-School",
  ],
};

export const POR_CATEGORIES: { value: PorCategory; label: string }[] = [
  { value: "ecell", label: "E-Cell / Entrepreneurship" },
  { value: "technical_committee", label: "Technical Committee" },
  { value: "student_body", label: "Student Government / Leadership" },
];

export const RESULT_TIERS: { value: ResultTier; label: string }[] = [
  { value: "winner", label: "Winner" },
  { value: "runner_up", label: "Runner-Up" },
  { value: "top_3", label: "Top 3" },
  { value: "top_10", label: "Top 10" },
  { value: "finalist", label: "Finalist" },
  { value: "participant", label: "Participant" },
];

export const ORGANISATIONS = [
  "Shaastra Core Team",
  "Techfest IIT Bombay",
  "GDSC Lead",
  "E-Cell IIT Bombay",
  "Kshitij IIT Kharagpur",
  "Mood Indigo",
  "Student Senate",
  "Robotics Club",
];

export const TIER_META: Record<
  ResultTier,
  { icon: string; label: string }
> = {
  winner: { icon: "🏆", label: "Winner" },
  runner_up: { icon: "🥈", label: "Runner-Up" },
  top_3: { icon: "⭐", label: "Top 3" },
  top_10: { icon: "", label: "Top 10" },
  finalist: { icon: "", label: "Finalist" },
  participant: { icon: "", label: "Participant" },
};

export const CATEGORY_CLASS: Record<CompetitionCategory, string> = {
  hardware: "bg-cat-hardware text-cat-hardware-fg",
  software: "bg-cat-software text-cat-software-fg",
  founders_office: "bg-cat-founders text-cat-founders-fg",
  product_gtm: "bg-cat-gtm text-cat-gtm-fg",
};

export const EMAIL_CONFIDENCE_LABEL: Record<EmailConfidence, string> = {
  github_profile: "github profile",
  github_commit: "github commit",
  inferred: "inferred",
};

/** Builds a fallback "view source" URL when an entry has no explicit one. */
export function sourceUrlFor(name: string, explicit?: string | null): string {
  if (explicit) return explicit;
  return `https://www.google.com/search?q=${encodeURIComponent(name + " results")}`;
}

export const PIPELINE_ROLES = [
  // Engineering
  "Agentic AI Engineer",
  "Software Engineer",
  "Senior Software Engineer",
  "AI Design Engineer",
  // Product
  "Product Manager",
  "Product Marketing Manager",
  "Product Marketing Intern",
  // Business / Sales
  "Business Development Representative",
  "Partner Account Manager",
  "GTM Strategy & Operations Manager",
  "Senior Account Executive",
  "Enterprise Sales Head",
  // Marketing
  "AI Website Builder Lead",
  "AEO / SEO Analyst",
  "Demand Gen & Growth Associate",
  "Partner Marketing Specialist",
  // People
  "Intern - Talent & Culture",
  "Lead - Talent Marketing & Acquisition",
  // Generalist
  "Founder's Office",
] as const;

export type PipelineRole = (typeof PIPELINE_ROLES)[number];

export const PIPELINE_STAGES = [
  "New",
  "Contacted",
  "Responded",
  "Interviewing",
  "Offer Sent",
  "Hired",
  "Rejected",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export interface Pipeline {
  id: string;
  name: string;
  description: string;
  role: PipelineRole;
}

export const MOCK_PIPELINES: Pipeline[] = [
  {
    id: "p1",
    name: "Agentic AI Engineer — 2025",
    description: "Candidates for the Agentic AI Engineer opening.",
    role: "Agentic AI Engineer",
  },
  {
    id: "p2",
    name: "Software Engineer — 2025",
    description: "Full-stack and backend engineers for the core platform.",
    role: "Software Engineer",
  },
  {
    id: "p3",
    name: "Founder's Office — 2025",
    description: "High-agency generalists for the founders office.",
    role: "Founder's Office",
  },
];

/** Initial membership: candidateId -> pipelineId (matches scripts/seed.ts UUIDs). */
export const INITIAL_MEMBERSHIP: Record<string, string> = {};

/* ── Scraper Health Dashboard mock data ── */

export type ScraperStatus = "ok" | "degraded" | "failed";

export interface ScraperHealth {
  id: string;
  name: string;
  source: string;
  status: ScraperStatus;
  records_extracted: number;
  records_expected: number;
  last_run: string;
  error_message?: string;
}

export const SCRAPER_HEALTH: ScraperHealth[] = [
  {
    id: "devfolio",
    name: "devfolio",
    source: "devfolio.co/hackathons",
    status: "ok",
    records_extracted: 1284,
    records_expected: 1300,
    last_run: "2026-06-10T04:12:00Z",
  },
  {
    id: "sih_pdf",
    name: "sih_pdf",
    source: "sih.gov.in result PDFs",
    status: "degraded",
    records_extracted: 642,
    records_expected: 980,
    last_run: "2026-06-10T03:48:00Z",
    error_message:
      "PDF layout changed for 2024 winners; 12 of 31 PDFs failed table extraction (camelot fallback engaged).",
  },
  {
    id: "e_yantra",
    name: "e_yantra",
    source: "e-yantra.org/results",
    status: "failed",
    records_extracted: 0,
    records_expected: 540,
    last_run: "2026-06-10T02:30:00Z",
    error_message:
      "HTTP 403 Forbidden on results index. Cloudflare challenge detected — rotating user-agent did not resolve. Last successful run: 2026-06-07.",
  },
  {
    id: "unstop",
    name: "unstop",
    source: "unstop.com/competitions",
    status: "ok",
    records_extracted: 2110,
    records_expected: 2150,
    last_run: "2026-06-10T04:30:00Z",
  },
  {
    id: "interiit",
    name: "interiit_tech",
    source: "interiit-tech.org",
    status: "degraded",
    records_extracted: 188,
    records_expected: 240,
    last_run: "2026-06-09T22:05:00Z",
    error_message:
      "Partial scrape: team-member roster pages timed out (8 of 40). Retry queued for next window.",
  },
];

export interface RateLimit {
  id: string;
  service: string;
  metric: string;
  used: number;
  limit: number;
  reset_label: string;
}

export const RATE_LIMITS: RateLimit[] = [
  {
    id: "ddg",
    service: "DuckDuckGo",
    metric: "Daily lookups",
    used: 1840,
    limit: 2500,
    reset_label: "Resets 00:00 UTC",
  },
  {
    id: "github",
    service: "GitHub API",
    metric: "Requests remaining",
    used: 4120,
    limit: 5000,
    reset_label: "Resets in 38 min",
  },
];

export const MOCK_CANDIDATES: Candidate[] = [
  {
    id: "c1",
    full_name: "Arjun Mehta",
    university: "IIT Bombay",
    degree: "B.Tech",
    branch: "Computer Science",
    graduation_year: 2025,
    source: "competition_scrape" as CandidateSource,
    linkedin_url: "linkedin.com/in/arjunmehta",
    email: "arjun.mehta@gmail.com",
    email_confidence: "github_profile",
    github_url: "github.com/arjunm",
    in_pipeline: true,
    competitions: [
      {
        competition_name: "Smart India Hackathon – Hardware",
        competition_category: "hardware",
        result_tier: "winner",
        year: 2023,
        team_name: "ByteForge",
      },
      {
        competition_name: "e-Yantra Robotics Competition",
        competition_category: "hardware",
        result_tier: "finalist",
        year: 2022,
      },
      {
        competition_name: "ETHIndia",
        competition_category: "software",
        result_tier: "top_10",
        year: 2023,
      },
    ],
    positions: [
      {
        organisation_name: "Techfest IIT Bombay",
        role_title: "Technical Secretary",
        por_category: "technical_committee",
        year_start: 2023,
        year_end: 2024,
      },
    ],
    culture_score: 73,
  },
  {
    id: "c2",
    full_name: "Priya Nair",
    university: "IIT Madras",
    degree: "Dual Degree",
    branch: "Electrical Engineering",
    graduation_year: 2024,
    source: "competition_scrape" as CandidateSource,
    linkedin_url: "linkedin.com/in/priyanair",
    email: "priya.nair@smail.iitm.ac.in",
    email_confidence: "inferred",
    github_url: "github.com/priyanair",
    competitions: [
      {
        competition_name: "Robocon India",
        competition_category: "hardware",
        result_tier: "runner_up",
        year: 2023,
        team_name: "Abhiyaan",
      },
      {
        competition_name: "Inter IIT Tech Meet – Hardware",
        competition_category: "hardware",
        result_tier: "top_3",
        year: 2022,
      },
    ],
    positions: [
      {
        organisation_name: "Shaastra Core Team",
        role_title: "Core Team — Robotics",
        por_category: "technical_committee",
        year_start: 2022,
        year_end: 2023,
      },
      {
        organisation_name: "Robotics Club",
        role_title: "Head",
        por_category: "technical_committee",
        year_start: 2023,
        year_end: null,
      },
    ],
    culture_score: 85,
  },
  {
    id: "c3",
    full_name: "Rohan Gupta",
    university: "BITS Pilani",
    degree: "B.E.",
    branch: "Computer Science",
    graduation_year: 2026,
    source: "competition_scrape" as CandidateSource,
    linkedin_url: "linkedin.com/in/rohangupta",
    email: "rohan.g@gmail.com",
    email_confidence: "github_commit",
    github_url: "github.com/rohang",
    competitions: [
      {
        competition_name: "Google Summer of Code",
        competition_category: "software",
        result_tier: "winner",
        year: 2024,
      },
      {
        competition_name: "Flipkart Grid",
        competition_category: "software",
        result_tier: "finalist",
        year: 2023,
      },
      {
        competition_name: "Conquest BITS Pilani",
        competition_category: "founders_office",
        result_tier: "top_3",
        year: 2023,
      },
    ],
    positions: [
      {
        organisation_name: "GDSC BITS Pilani",
        role_title: "GDSC Lead",
        por_category: "technical_committee",
        year_start: 2023,
        year_end: 2024,
      },
    ],
    culture_score: 85,
  },
  {
    id: "c4",
    full_name: "Ananya Sharma",
    university: "IIM Ahmedabad",
    degree: "MBA",
    branch: "Management",
    graduation_year: 2025,
    source: "competition_scrape" as CandidateSource,
    linkedin_url: "linkedin.com/in/ananyasharma",
    email: null,
    email_confidence: null,
    github_url: null,
    competitions: [
      {
        competition_name: "HUL LIME",
        competition_category: "product_gtm",
        result_tier: "winner",
        year: 2024,
        team_name: "Catalyst",
      },
      {
        competition_name: "Mahindra War Room",
        competition_category: "product_gtm",
        result_tier: "top_3",
        year: 2024,
      },
      {
        competition_name: "Hult Prize India",
        competition_category: "founders_office",
        result_tier: "runner_up",
        year: 2023,
      },
    ],
    positions: [
      {
        organisation_name: "E-Cell IIM Ahmedabad",
        role_title: "President",
        por_category: "ecell",
        year_start: 2023,
        year_end: 2024,
      },
    ],
    culture_score: 70,
  },
  {
    id: "c5",
    full_name: "Vikram Reddy",
    university: "IIIT Hyderabad",
    degree: "B.Tech",
    branch: "Computer Science",
    graduation_year: 2025,
    source: "competition_scrape" as CandidateSource,
    linkedin_url: "linkedin.com/in/vikramreddy",
    email: "vikram.reddy@research.iiit.ac.in",
    email_confidence: "inferred",
    github_url: "github.com/vikramr",
    competitions: [
      {
        competition_name: "Amazon ML Challenge",
        competition_category: "software",
        result_tier: "winner",
        year: 2024,
        team_name: "GradientDescent",
      },
      {
        competition_name: "MathWorks Minidrone",
        competition_category: "hardware",
        result_tier: "top_3",
        year: 2023,
      },
    ],
    positions: [],
    culture_score: 48,
  },
  {
    id: "c6",
    full_name: "Kavya Iyer",
    university: "IIT Delhi",
    degree: "B.Tech",
    branch: "Mechanical Engineering",
    graduation_year: 2024,
    source: "competition_scrape" as CandidateSource,
    linkedin_url: "linkedin.com/in/kavyaiyer",
    email: "kavya.iyer@gmail.com",
    email_confidence: "github_profile",
    github_url: "github.com/kavyai",
    competitions: [
      {
        competition_name: "BAJA SAE India",
        competition_category: "hardware",
        result_tier: "winner",
        year: 2023,
        team_name: "Team Defianz",
      },
      {
        competition_name: "Smart India Hackathon – Hardware",
        competition_category: "hardware",
        result_tier: "finalist",
        year: 2022,
      },
    ],
    positions: [
      {
        organisation_name: "Student Senate IIT Delhi",
        role_title: "Secretary — Technical Affairs",
        por_category: "student_body",
        year_start: 2022,
        year_end: 2023,
      },
      {
        organisation_name: "Automotive Club",
        role_title: "Team Captain",
        por_category: "technical_committee",
        year_start: 2021,
        year_end: 2023,
      },
    ],
    culture_score: 85,
  },
];