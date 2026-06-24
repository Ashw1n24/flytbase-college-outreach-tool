/**
 * Student candidate sourcing via Apify Google Search Scraper + Jina AI.
 *
 * Pipeline:
 * 1. Apify Google Search → LinkedIn profile URLs + snippets
 * 2. Jina AI Reader (r.jina.ai) → fetch each LinkedIn page for richer content
 *    (free, no API key; falls back to Google snippet if LinkedIn returns a login wall)
 * 3. Claude Haiku → parse profile content for competition/PoR signals
 * 4. Insert candidates + competition_results + positions_of_responsibility
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";

import { getSupabaseAdmin } from "@/lib/supabase.server";
import { computeStudentCultureFit } from "@/lib/utils/culturefit";
import type { Candidate } from "@/data/talent";

const APIFY_BASE = "https://api.apify.com/v2";
const JINA_BASE = "https://r.jina.ai";
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * College groups — each group runs as one Apify batch.
 * Splitting into groups keeps per-run credit usage predictable.
 */
export const COLLEGE_GROUPS = {
  tier1a: {
    label: "Tier 1A Engineering",
    universities: [
      "IIT Bombay",
      "IIT Delhi",
      "IIT Madras",
      "IIT Kharagpur",
      "IIT Kanpur",
      "BITS Pilani",
    ],
  },
  tier1b: {
    label: "Tier 1B Engineering",
    universities: [
      "IIT Roorkee",
      "IIT Guwahati",
      "IIT Hyderabad",
      "IIT BHU Varanasi",
      "IIT Indore",
      "IIIT Hyderabad",
    ],
  },
  tier2a: {
    label: "Tier 2A Engineering",
    universities: [
      "BITS Goa",
      "BITS Hyderabad",
      "IIIT Bangalore",
      "VJTI Mumbai",
      "College of Engineering Pune",
      "PICT Pune",
    ],
  },
  tier2b: {
    label: "Tier 2B Engineering",
    universities: [
      "IIIT Allahabad",
      "NIT Trichy",
      "NIT Warangal",
      "NIT Surathkal",
      "NIT Calicut",
      "NIT Rourkela",
    ],
  },
  business: {
    label: "Business Schools",
    universities: [
      "IIM Ahmedabad",
      "IIM Bangalore",
      "IIM Calcutta",
      "IIM Lucknow",
      "IIM Kozhikode",
      "IIM Indore",
      "XLRI Jamshedpur",
      "ISB Hyderabad",
    ],
  },
} as const;

export type CollegeGroup = keyof typeof COLLEGE_GROUPS;

/**
 * Keyword profiles — independent of college group.
 * Applied as an OR clause in the Google search query.
 */
export const KEYWORD_PROFILES = {
  technical: {
    label: "Technical / Robotics / Hackathon",
    keywords: [
      // Hackathons & coding competitions
      "hackathon",
      "Smart India Hackathon",
      "Inter IIT",
      "Devfolio",
      "HackerEarth",
      "Flipkart Grid",
      "Amazon ML Challenge",
      "Google Summer of Code",
      "GDSC",
      "Kaggle",
      // Robotics & hardware
      "robotics",
      "drone",
      "embedded systems",
      "e-yantra",
      "Robocon",
      "BAJA SAE",
      "autonomous systems",
      "firmware",
      "IoT",
      // Achievement signals
      "technical club",
      "open source",
      "winner",
    ],
  },
  ecell: {
    label: "E-Cell / Startup / Entrepreneurship",
    keywords: [
      "e-cell",
      "entrepreneurship cell",
      "E-Summit",
      "Eureka",
      "Conquest",
      "Hult Prize",
      "NSRCEL",
      "startup",
      "TBI",
      "incubation",
      "venture",
      "founder",
    ],
  },
  consulting: {
    label: "Consulting / Marketing / Product",
    keywords: [
      "case competition",
      "consulting club",
      "Dare2Compete",
      "marketing competition",
      "brand management",
      "growth marketing",
      "product management",
      "product case",
      "business plan",
      "strategy",
      "BCG",
      "McKinsey",
      "Bain",
      "analytics club",
      "finance club",
      "investment banking",
    ],
  },
} as const;

export type KeywordProfile = keyof typeof KEYWORD_PROFILES;

const DEFAULT_GROUP: CollegeGroup = "tier1a";
const DEFAULT_KEYWORD_PROFILE: KeywordProfile = "technical";

const COMPANY_WORDS =
  /\b(pvt|ltd|limited|llp|inc|corp|corporation|technologies|solutions|services)\b/i;

/**
 * Returns true for names that are clearly not individual people:
 * - Faculty/staff with Dr./Prof. prefix
 * - Organisation/chapter pages (contain university abbreviations or event-page words)
 */
function isNonPersonName(name: string): boolean {
  // Faculty: "Dr. Xyz", "Prof Xyz", "Professor Xyz"
  if (/^(dr\.?\s|prof\.?\s|professor\s)/i.test(name)) return true;
  // Org pages containing institution abbreviations as standalone words
  if (/\b(IIT|NIT|IIIT|BITS|IIM|XLRI|ISB|VJTI|COEP|PICT)\b/.test(name)) return true;
  // Common event/chapter/club page words in the name
  if (/\b(chapter|club|cell|society|association|council|community|fest|summit|prize|award|incubator|lab|foundation|cohort|batch|team)\b/i.test(name)) return true;
  return false;
}

// LinkedIn login-wall signals — if Jina content contains these, it's gated
const LOGIN_WALL_SIGNALS = [
  "join now to see",
  "sign in to see",
  "sign in to view",
  "log in to see",
  "log in to view",
  "be the first to see",
  "1,000,000+ members",
  "join linkedin",
  "agree & join",
  // Jina error responses — treat rate-limit / upstream errors as blocked
  "error 429",
  "too many requests",
  "returned error 4",
  "returned error 5",
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface GoogleOrganicResult {
  title?: string;
  url?: string;
  description?: string;
}

interface GoogleSearchDatasetItem {
  organicResults?: GoogleOrganicResult[];
}

type CompetitionCategory = "hardware" | "software" | "founders_office" | "product_gtm";
type ResultTier = "winner" | "runner_up" | "top_3" | "top_10" | "finalist" | "participant";
type PorCategory = "ecell" | "technical_committee" | "student_body";

interface ParsedCompetition {
  name: string;
  category: CompetitionCategory;
  tier: ResultTier;
  year: number;
}

interface ParsedPosition {
  role: string;
  org: string;
  category: PorCategory;
  year_start: number;
  year_end: number | null;
}

interface ParsedSignals {
  competitions: ParsedCompetition[];
  positions: ParsedPosition[];
  graduation_year: number | null;
  degree: string | null;
  branch: string | null;
}

const VALID_CATEGORIES = new Set<CompetitionCategory>([
  "hardware", "software", "founders_office", "product_gtm",
]);
const VALID_TIERS = new Set<ResultTier>([
  "winner", "runner_up", "top_3", "top_10", "finalist", "participant",
]);
const VALID_POR_CATEGORIES = new Set<PorCategory>([
  "ecell", "technical_committee", "student_body",
]);

// ── Jina AI: fetch LinkedIn profiles ─────────────────────────────────────────

/**
 * Returns true if the Jina-fetched content is actually useful profile data
 * rather than a login wall / empty page.
 */
function isUsefulContent(text: string): boolean {
  if (!text || text.length < 100) return false;
  const lower = text.toLowerCase();
  return !LOGIN_WALL_SIGNALS.some((sig) => lower.includes(sig));
}

/**
 * Fetch a single LinkedIn profile via Jina AI Reader.
 * Returns the markdown content, or null if blocked/failed.
 */
/** Strip query params and trailing slashes so Jina cache keys match consistently. */
function normalizeLinkedInUrl(url: string): string {
  try {
    const u = new URL(url);
    // Keep only origin + pathname, normalised to lowercase, no trailing slash
    return `${u.origin}${u.pathname}`.replace(/\/+$/, "").toLowerCase();
  } catch {
    return url;
  }
}

async function fetchJinaProfile(linkedinUrl: string): Promise<string | null> {
  const cleanUrl = normalizeLinkedInUrl(linkedinUrl);
  const jinaKey = process.env.JINA_API_KEY;
  const headers: Record<string, string> = {
    Accept: "text/markdown",
    // Do NOT send X-No-Cache — Jina's cached LinkedIn snapshots have far
    // higher hit rates than forcing fresh fetches, which LinkedIn's bot
    // detection blocks on almost every request.
  };
  if (jinaKey) {
    headers["Authorization"] = `Bearer ${jinaKey}`;
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch(`${JINA_BASE}/${cleanUrl}`, {
        headers,
        signal: controller.signal,
      });
      if (!res.ok) return null;
      const text = await res.text();
      if (isUsefulContent(text)) return text.slice(0, 4000);
      // If content is a login wall, no point retrying
      return null;
    } catch {
      // Timeout or network error — retry once after a short wait
      if (attempt === 0) await new Promise((r) => setTimeout(r, 2000));
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

/**
 * Fetch LinkedIn profiles in parallel, respecting both Jina and LinkedIn limits.
 *
 * LinkedIn's bot detection is the bottleneck — not Jina's rate limit.
 * Keeping concurrency low and delays generous lets requests look more human.
 *
 * Authenticated (JINA_API_KEY set): concurrency=2, delay=1000–2000ms
 * Anonymous: concurrency=1, delay=3000–4000ms (stay under ~20 RPM cap)
 *
 * Returns an array aligned 1-to-1 with `urls` (null = failed/blocked).
 */
async function fetchJinaProfilesConcurrent(
  urls: string[],
): Promise<(string | null)[]> {
  const hasKey = Boolean(process.env.JINA_API_KEY);
  const concurrency = hasKey ? 2 : 1;
  const minDelay   = hasKey ? 1000 : 3000;
  const jitter     = hasKey ? 1000 : 1000;

  console.log(`[jina] mode=${hasKey ? "authenticated" : "anonymous"} concurrency=${concurrency} delay=${minDelay}-${minDelay + jitter}ms`);

  const results: (string | null)[] = new Array(urls.length).fill(null);
  let idx = 0;

  async function worker() {
    while (idx < urls.length) {
      const i = idx++;
      results[i] = await fetchJinaProfile(urls[i]);
      await new Promise((r) => setTimeout(r, minDelay + Math.random() * jitter));
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}

// ── Claude Haiku: parse profile content ──────────────────────────────────────

const PROFILE_PARSE_PROMPT = `You are parsing Indian engineering/business student LinkedIn profiles to extract education details, competition achievements, and positions of responsibility.

The input may be a full LinkedIn page (markdown from Jina AI) or just a Google search snippet.
Extract every competition win and club/committee role you can find.

Return exactly this JSON structure for each candidate:
{
  "graduation_year": <integer 2020-2028> | null,
  "degree": "B.Tech" | "B.E." | "M.Tech" | "MBA" | "B.S." | "M.S." | "Ph.D" | null,
  "branch": "Computer Science" | "Electrical" | "Mechanical" | "Civil" | "Chemical" | "Electronics" | "Information Technology" | "MBA" | <other branch string> | null,
  "competitions": [
    {
      "name": "Competition or hackathon name",
      "category": "hardware" | "software" | "founders_office" | "product_gtm",
      "tier": "winner" | "runner_up" | "top_3" | "top_10" | "finalist" | "participant",
      "year": <integer 2015-2026>
    }
  ],
  "positions": [
    {
      "role": "role title",
      "org": "club or organisation name",
      "category": "ecell" | "technical_committee" | "student_body",
      "year_start": <integer 2015-2026>,
      "year_end": <integer 2015-2027> | null
    }
  ]
}

graduation_year rules:
- Extract from education section: "B.Tech 2021–2025" → graduation_year = 2025
- "Class of 2026", "Graduating 2026", "Batch of 2026" → 2026
- "IIT Bombay (2022-2026)" → 2026
- If only start year visible (e.g. "2022–present"), add 4 for B.Tech/B.E., 2 for MBA/M.Tech
- Return null if no education dates found at all

degree rules:
- Return the degree abbreviation if visible. Default to "B.Tech" for IIT/NIT/BITS profiles if not specified.

branch rules:
- Return the branch/specialisation if visible. Return null if not found.

Category rules:
- hardware: robotics, drone, embedded systems, hardware, IoT, circuits, FPGA, autonomous vehicles
- software: hackathon, coding contest, app dev, AI/ML, data science, open source, web dev
- founders_office: business plan competition, entrepreneurship, case study, startup pitch
- product_gtm: marketing competition, design sprint, product challenge

PoR category rules:
- ecell: entrepreneurship cell, e-cell, startup club, incubator, NSRCEL, TBI
- technical_committee: tech club, coding club, robotics club, IEEE, ACM, GDSC, CSE Dept club, science/engineering society
- student_body: student council, general secretary, cultural fest committee, sports, NSS, NCC, hostel committee

year_end rules:
- If a specific end year/date is mentioned, use it.
- If the role says "present" or "current", set year_end to null.
- If no dates at all, assume year_end = year_start + 1 (most college PORs are 1-year tenures).
- Never leave year_end undefined — always null or an integer.

Default year_start to 2023 if not mentioned. Return ONLY a JSON object keyed by the candidate's "i" value — no extra keys, no markdown.`;

const EMPTY_SIGNALS: ParsedSignals = {
  competitions: [],
  positions: [],
  graduation_year: null,
  degree: null,
  branch: null,
};

async function parseProfilesBatch(
  batch: Array<{ i: number; content: string; source: "jina" | "snippet" }>,
): Promise<ParsedSignals[]> {
  // Each candidate object is keyed by its index so we can recover even if
  // Claude returns fewer items than expected (e.g. output gets truncated).
  const prompt = `${PROFILE_PARSE_PROMPT}

CANDIDATES (${batch.length}):
${JSON.stringify(
  batch.map((b) => ({
    i: b.i,
    source: b.source,
    content: b.content.slice(0, 1500), // trim per-candidate to give output room
  })),
)}

Return a JSON object mapping each candidate's "i" value to its parsed result:
{ "<i>": { graduation_year, degree, branch, competitions, positions }, ... }
Include an entry for every candidate index, even if all arrays are empty.`;

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = (response.content[0] as { type: string; text: string }).text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(raw) as Record<string, ParsedSignals>;
    // Map back by index — any missing entries get empty signals
    return batch.map((b) => {
      const entry = parsed[String(b.i)];
      if (!entry || typeof entry !== "object") return { ...EMPTY_SIGNALS };
      return {
        graduation_year: entry.graduation_year ?? null,
        degree: entry.degree ?? null,
        branch: entry.branch ?? null,
        competitions: Array.isArray(entry.competitions) ? entry.competitions : [],
        positions: Array.isArray(entry.positions) ? entry.positions : [],
      };
    });
  } catch {
    console.error("[profile parse] JSON.parse failed:", raw.slice(0, 300));
    return batch.map(() => ({ ...EMPTY_SIGNALS }));
  }
}

async function parseAllProfiles(
  candidates: Array<{ content: string; source: "jina" | "snippet" }>,
): Promise<ParsedSignals[]> {
  const BATCH_SIZE = 8; // smaller batches: more output budget per candidate
  const results: ParsedSignals[] = [];

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const slice = candidates.slice(i, i + BATCH_SIZE);
    const batchInput = slice.map((c, j) => ({ i: i + j, ...c }));

    let batchResult: ParsedSignals[];
    try {
      batchResult = await parseProfilesBatch(batchInput);
    } catch (err) {
      console.warn(`[profile parse] batch offset=${i} failed:`, err);
      batchResult = slice.map(() => ({ competitions: [], positions: [] }));
    }
    results.push(...batchResult);
  }

  return results;
}

// ── Main scrape function ──────────────────────────────────────────────────────

async function scrapeStudentProfiles(params: {
  group?: CollegeGroup;
  keywordProfile?: KeywordProfile;
  universities?: string[];
  keywords?: string[];
  maxResults: number;
}): Promise<{ inserted: number; skipped: number; jinaHits: number }> {
  const apifyKey = process.env.APIFY_API_KEY;
  if (!apifyKey) throw new Error("APIFY_API_KEY not configured in .env");

  const supabase = getSupabaseAdmin();

  const groupKey = params.group ?? DEFAULT_GROUP;
  const groupDef = COLLEGE_GROUPS[groupKey];
  const unis = params.universities?.length ? params.universities : groupDef.universities;

  const kwProfileKey = params.keywordProfile ?? DEFAULT_KEYWORD_PROFILE;
  const keywords = params.keywords?.length
    ? params.keywords
    : KEYWORD_PROFILES[kwProfileKey].keywords;

  // ── 1. Apify Google Search ───────────────────────────────────────────────

  const kwClause = keywords.map((k) => `"${k}"`).join(" OR ");
  const queries = unis
    .map((uni) => `site:linkedin.com/in "${uni}" (${kwClause}) -inurl:company`)
    .join("\n");

  const runRes = await fetch(
    `${APIFY_BASE}/acts/apify~google-search-scraper/runs?token=${apifyKey}&timeoutSecs=180`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        queries,
        maxPagesPerQuery: 2,
        countryCode: "in",
        languageCode: "en",
      }),
    },
  );
  if (!runRes.ok) {
    const text = await runRes.text().catch(() => runRes.statusText);
    throw new Error(`Apify start failed (${runRes.status}): ${text}`);
  }
  const runResp = (await runRes.json()) as { data?: { id?: string } };
  const runId = runResp?.data?.id;
  if (!runId) throw new Error("Apify did not return a run ID");

  const deadline = Date.now() + 3 * 60 * 1000;
  let apifyStatus: string | undefined = "READY";
  while (
    (apifyStatus === "READY" || apifyStatus === "RUNNING") &&
    Date.now() < deadline
  ) {
    await new Promise((r) => setTimeout(r, 5_000));
    const sr = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${apifyKey}`);
    const sd = (await sr.json()) as { data?: { status?: string } };
    apifyStatus = sd?.data?.status;
  }

  const datasetRes = await fetch(
    `${APIFY_BASE}/actor-runs/${runId}/dataset/items?token=${apifyKey}&limit=500`,
  );
  if (!datasetRes.ok) throw new Error(`Apify dataset fetch failed (${datasetRes.status})`);
  const rawItems = (await datasetRes.json()) as GoogleSearchDatasetItem[];
  const items = Array.isArray(rawItems) ? rawItems : [];

  // ── 2. Dedup + extract candidates ───────────────────────────────────────

  const { data: existing } = await supabase
    .from("candidates")
    .select("linkedin_url")
    .not("linkedin_url", "is", null);
  const existingUrls = new Set((existing ?? []).map((r) => r.linkedin_url as string));

  type NewCandidate = {
    full_name: string;
    university: string;
    degree: null;
    branch: null;
    graduation_year: null;
    source: "google_search";
    linkedin_url: string;
    email: null;
    email_confidence: null;
    github_url: null;
  };

  type CandidateWithMeta = NewCandidate & { _snippet: string; _title: string };

  const candidates: CandidateWithMeta[] = [];

  outer: for (const item of items) {
    for (const result of item.organicResults ?? []) {
      if (candidates.length >= params.maxResults) break outer;

      const url = result.url ?? "";
      if (!url.includes("linkedin.com/in/")) continue;
      if (existingUrls.has(url)) continue;
      existingUrls.add(url);

      const title = result.title ?? "";
      const snippet = result.description ?? "";
      if (!title) continue;

      const clean = title.replace(/\s*[|–]\s*LinkedIn\s*$/i, "").trim();
      const fullName = clean.split(/\s+-\s+/)[0]?.trim();
      if (!fullName || COMPANY_WORDS.test(fullName) || isNonPersonName(fullName)) continue;

      const haystack = `${title} ${snippet}`.toLowerCase();
      const university = unis.find((u) => haystack.includes(u.toLowerCase()));
      if (!university) continue;

      candidates.push({
        full_name: fullName,
        university,
        degree: null,
        branch: null,
        graduation_year: null,
        source: "google_search",
        linkedin_url: url,
        email: null,
        email_confidence: null,
        github_url: null,
        _snippet: snippet,
        _title: title,
      });
    }
  }

  if (candidates.length === 0) {
    return { inserted: 0, skipped: items.length, jinaHits: 0 };
  }

  // ── 3. Jina AI: fetch LinkedIn pages concurrently ────────────────────────

  console.log(`[jina] Fetching ${candidates.length} LinkedIn profiles…`);
  const jinaResults = await fetchJinaProfilesConcurrent(
    candidates.map((c) => c.linkedin_url),
  );

  let jinaHits = 0;
  const profileInputs = candidates.map((c, i) => {
    const jinaContent = jinaResults[i];
    if (jinaContent) {
      jinaHits++;
      return { content: jinaContent, source: "jina" as const };
    }
    // Fall back to Google snippet + title
    return {
      content: `${c._title}\n\n${c._snippet}`,
      source: "snippet" as const,
    };
  });

  console.log(
    `[jina] ${jinaHits}/${candidates.length} profiles fetched successfully, ` +
    `${candidates.length - jinaHits} using Google snippet fallback`,
  );

  // ── 4. Claude Haiku: parse profile content ──────────────────────────────

  const signals = await parseAllProfiles(profileInputs);

  // ── 5. Insert candidates ─────────────────────────────────────────────────

  // Merge Claude-parsed academic fields back into candidate rows
  const dbCandidates = candidates.map(({ _snippet: _s, _title: _t, ...rest }, i) => {
    const parsed = signals[i];
    const gradYear = parsed?.graduation_year;
    return {
      ...rest,
      graduation_year:
        gradYear != null && Number.isFinite(gradYear) && gradYear >= 2020 && gradYear <= 2030
          ? gradYear
          : null,
      degree: parsed?.degree ?? null,
      branch: parsed?.branch ?? null,
    };
  });

  const { data: insertedRows, error: insertErr } = await supabase
    .from("candidates")
    .insert(dbCandidates)
    .select("id, linkedin_url");

  if (insertErr) throw new Error(`Failed to insert candidates: ${insertErr.message}`);

  const urlToId = new Map<string, string>(
    (insertedRows ?? []).map((r) => [r.linkedin_url as string, r.id]),
  );

  // ── 6. Build + insert competition/PoR rows ───────────────────────────────

  const currentYear = new Date().getFullYear();

  const competitionRows: Array<{
    candidate_id: string;
    competition_name: string;
    competition_category: CompetitionCategory;
    result_tier: ResultTier;
    year: number;
    team_name: null;
    source_url: string;
    ingestion_method: "manual";
  }> = [];

  const positionRows: Array<{
    candidate_id: string;
    organisation_name: string;
    role_title: string;
    por_category: PorCategory;
    institution: string;
    year_start: number;
    year_end: number | null;
    source_url: string;
    ingestion_method: "manual";
  }> = [];

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const candidateId = urlToId.get(candidate.linkedin_url);
    if (!candidateId) continue;

    const parsed = signals[i] ?? { competitions: [], positions: [] };

    for (const comp of parsed.competitions ?? []) {
      if (!comp.name || !VALID_CATEGORIES.has(comp.category) || !VALID_TIERS.has(comp.tier)) continue;
      competitionRows.push({
        candidate_id: candidateId,
        competition_name: comp.name.slice(0, 200),
        competition_category: comp.category,
        result_tier: comp.tier,
        year: Number.isFinite(comp.year)
          ? Math.min(Math.max(comp.year, 2015), currentYear)
          : currentYear,
        team_name: null,
        source_url: candidate.linkedin_url,
        ingestion_method: "manual",
      });
    }

    for (const pos of parsed.positions ?? []) {
      if (!pos.role || !pos.org || !VALID_POR_CATEGORIES.has(pos.category)) continue;
      positionRows.push({
        candidate_id: candidateId,
        organisation_name: pos.org.slice(0, 200),
        role_title: pos.role.slice(0, 200),
        por_category: pos.category,
        institution: candidate.university,
        year_start: Number.isFinite(pos.year_start)
          ? Math.min(Math.max(pos.year_start, 2015), currentYear)
          : currentYear,
        year_end:
          pos.year_end != null && Number.isFinite(pos.year_end)
            ? Math.min(Math.max(pos.year_end, 2015), currentYear + 1)
            : null,
        source_url: candidate.linkedin_url,
        ingestion_method: "manual",
      });
    }
  }

  if (competitionRows.length > 0) {
    const { error } = await supabase.from("competition_results").insert(competitionRows);
    if (error) console.warn("[insert] competition_results:", error.message);
  }

  if (positionRows.length > 0) {
    const { error } = await supabase.from("positions_of_responsibility").insert(positionRows);
    if (error) console.warn("[insert] positions_of_responsibility:", error.message);
  }

  // ── 7. Compute + store culture_score for each new candidate ─────────────
  // Build a minimal Candidate-shaped object from the parsed signals so we can
  // reuse computeStudentCultureFit without a second DB round-trip.
  const scoreUpdates: Array<{ id: string; culture_score: number }> = [];
  for (let i = 0; i < candidates.length; i++) {
    const candidateId = urlToId.get(candidates[i].linkedin_url);
    if (!candidateId) continue;
    const parsed = signals[i] ?? EMPTY_SIGNALS;

    const fake = {
      branch: dbCandidates[i].branch ?? null,
      competitions: (parsed.competitions ?? [])
        .filter((c) => VALID_CATEGORIES.has(c.category) && VALID_TIERS.has(c.tier))
        .map((c) => ({
          competition_name: c.name,
          competition_category: c.category,
          result_tier: c.tier,
          year: c.year,
          team_name: null,
          source_url: null,
        })),
      positions: (parsed.positions ?? [])
        .filter((p) => VALID_POR_CATEGORIES.has(p.category))
        .map((p) => ({
          organisation_name: p.org,
          role_title: p.role,
          por_category: p.category,
          year_start: p.year_start,
          year_end: p.year_end ?? null,
          source_url: null,
        })),
    } as unknown as Candidate;

    scoreUpdates.push({ id: candidateId, culture_score: computeStudentCultureFit(fake).score });
  }

  // Batch update in chunks of 50 using individual updates (Supabase doesn't
  // support bulk UPDATE with different values per row without RPC).
  for (const { id, culture_score } of scoreUpdates) {
    await supabase.from("candidates").update({ culture_score }).eq("id", id);
  }

  console.log(
    `[student scrape] ${candidates.length} candidates, ` +
    `${jinaHits} jina hits, ` +
    `${competitionRows.length} competitions, ${positionRows.length} positions`,
  );

  return {
    inserted: candidates.length,
    skipped: items.length - candidates.length,
    jinaHits,
  };
}

export const scrapeStudentLinkedinFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      group: z.enum(["tier1a", "tier1b", "tier2a", "tier2b", "business"]).optional(),
      keywordProfile: z.enum(["technical", "ecell", "consulting"]).optional(),
      universities: z.array(z.string()).optional(),
      keywords: z.array(z.string()).optional(),
      maxResults: z.number().int().min(10).max(200).default(50),
    }),
  )
  .handler(async ({ data }) => scrapeStudentProfiles(data));

