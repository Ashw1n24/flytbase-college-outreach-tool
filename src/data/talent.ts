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
  | "cultural_fest"
  | "student_body"
  | "sports";

export type EmailConfidence = "github_profile" | "github_commit" | "inferred";

export interface CompetitionResult {
  competition_name: string;
  competition_category: CompetitionCategory;
  result_tier: ResultTier;
  year: number;
  team_name?: string | null;
}

export interface PositionOfResponsibility {
  organisation_name: string;
  role_title: string;
  por_category: PorCategory;
  year_start: number;
  year_end: number | null;
}

export interface Candidate {
  id: string;
  full_name: string;
  university: string;
  degree: string;
  branch: string;
  graduation_year: number;
  linkedin_url: string | null;
  email: string | null;
  email_confidence: EmailConfidence | null;
  github_url: string | null;
  in_pipeline?: boolean;
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
  { value: "ecell", label: "E-Cell" },
  { value: "technical_committee", label: "Technical Committee" },
  { value: "cultural_fest", label: "Cultural Fest Core" },
  { value: "student_body", label: "Student Government" },
  { value: "sports", label: "Sports" },
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

export const MOCK_CANDIDATES: Candidate[] = [
  {
    id: "c1",
    full_name: "Arjun Mehta",
    university: "IIT Bombay",
    degree: "B.Tech",
    branch: "Computer Science",
    graduation_year: 2025,
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
  },
  {
    id: "c2",
    full_name: "Priya Nair",
    university: "IIT Madras",
    degree: "Dual Degree",
    branch: "Electrical Engineering",
    graduation_year: 2024,
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
  },
  {
    id: "c3",
    full_name: "Rohan Gupta",
    university: "BITS Pilani",
    degree: "B.E.",
    branch: "Computer Science",
    graduation_year: 2026,
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
  },
  {
    id: "c4",
    full_name: "Ananya Sharma",
    university: "IIM Ahmedabad",
    degree: "MBA",
    branch: "Management",
    graduation_year: 2025,
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
  },
  {
    id: "c5",
    full_name: "Vikram Reddy",
    university: "IIIT Hyderabad",
    degree: "B.Tech",
    branch: "Computer Science",
    graduation_year: 2025,
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
    positions: [
      {
        organisation_name: "Felicity IIIT-H",
        role_title: "Cultural Fest Core Team",
        por_category: "cultural_fest",
        year_start: 2022,
        year_end: 2023,
      },
    ],
  },
  {
    id: "c6",
    full_name: "Kavya Iyer",
    university: "IIT Delhi",
    degree: "B.Tech",
    branch: "Mechanical Engineering",
    graduation_year: 2024,
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
  },
];