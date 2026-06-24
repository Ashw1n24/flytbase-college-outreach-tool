import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";

import { getSupabaseAdmin } from "@/lib/supabase.server";
import type { Json } from "@/types/database";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const campaignFiltersSchema = z.object({
  industries: z.array(z.string()).default([]),
  company_sizes: z.array(z.string()).default([]),
  exp_min: z.number().int().min(0).default(3),
  exp_max: z.string().default(""), // empty = no ceiling
  domains: z.array(z.string()).default([]),
  previous_companies: z.array(z.string()).default([]),
  past_roles: z.array(z.string()).default([]),
  locations: z.array(z.string()).default([]),
  employment_statuses: z.array(z.string()).default([]),
});

const parseJdInputSchema = z.object({
  name: z.string().min(1),
  jdText: z.string().min(1),
  filters: campaignFiltersSchema,
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface JdParsed {
  required_skills: string[];
  nice_to_have: string[];
  titles: string[];
  industries: string[];
  seniority: string[];
  min_experience: number;
  function: string;
  seniority_label: string;
  top_skills: string[];
}

// ---------------------------------------------------------------------------
// Anthropic JD parser
// ---------------------------------------------------------------------------

const JD_PARSE_SYSTEM = `Extract structured hiring requirements from this job description. Return JSON only, no explanation, no markdown.
Schema:
{
  "required_skills": ["string"],
  "nice_to_have": ["string"],
  "titles": ["string"],
  "industries": ["string"],
  "seniority": ["string"],
  "min_experience": number,
  "function": "string",
  "seniority_label": "string",
  "top_skills": ["string"]
}
Rules:
- required_skills: must-have technical and domain skills explicitly stated
- nice_to_have: skills listed as preferred, bonus, or nice to have
- titles: 3-6 job titles that would describe this role
- industries: industries this role typically comes from
- seniority: one or more of ["junior", "mid", "senior", "lead", "manager", "director"]
- min_experience: minimum years of experience, default 3
- function: the job function in 1-2 words, e.g. "software engineering", "product management", "sales", "marketing"
- seniority_label: the experience level as a plain label, e.g. "senior", "manager", "lead", "director", "junior"
- top_skills: array of 2-3 most distinctive skills from the JD`;

async function parseJdWithClaude(jdText: string): Promise<JdParsed> {
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: JD_PARSE_SYSTEM,
    messages: [{ role: "user", content: jdText }],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text content returned from Claude.");
  }

  // Strip any accidental markdown fences before parsing
  const raw = textBlock.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  let parsed: JdParsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.error("[JSON.parse failed] raw input:", raw.slice(0, 500));
    throw e;
  }
  return parsed;
}

// ---------------------------------------------------------------------------
// Merge: user-set filters override JD-inferred values
// ---------------------------------------------------------------------------

function mergeFilters(
  jdParsed: JdParsed,
  userFilters: z.infer<typeof campaignFiltersSchema>,
): z.infer<typeof campaignFiltersSchema> {
  return {
    ...userFilters,
    // If user specified industries, use them; otherwise fall back to JD-inferred
    industries:
      userFilters.industries.length > 0
        ? userFilters.industries
        : jdParsed.industries,
    // Use JD min_experience only when user left exp_min at its default (3) and JD has a higher value
    exp_min:
      userFilters.exp_min === 3 && jdParsed.min_experience > 3
        ? jdParsed.min_experience
        : userFilters.exp_min,
    // Domains: merge JD titles into domains if user didn't restrict
    domains:
      userFilters.domains.length > 0
        ? userFilters.domains
        : jdParsed.required_skills,
  };
}

// ---------------------------------------------------------------------------
// DB helpers (extracted so TypeScript can resolve Supabase generics correctly)
// ---------------------------------------------------------------------------

async function insertCampaign(
  name: string,
  jdText: string,
  jdParsed: JdParsed,
  mergedFilters: z.infer<typeof campaignFiltersSchema>,
): Promise<string> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("campaigns")
    .insert({
      name,
      jd_raw: jdText,
      jd_parsed: jdParsed as unknown as Json,
      filters: mergedFilters as unknown as Json,
      status: "pending",
    })
    .select("id")
    .single();
  if (error) throw new Error(`Failed to save campaign: ${error.message}`);
  return data.id;
}

// ---------------------------------------------------------------------------
// Server function: parse JD and create campaign
// ---------------------------------------------------------------------------

export const parseJdFn = createServerFn({ method: "POST" })
  .validator(parseJdInputSchema)
  .handler(async ({ data }) => {
    const jdParsed = await parseJdWithClaude(data.jdText);
    const mergedFilters = mergeFilters(jdParsed, data.filters);
    const campaignId = await insertCampaign(data.name, data.jdText, jdParsed, mergedFilters);
    return { campaignId };
  });

// ---------------------------------------------------------------------------
// Fetch a single campaign by id (used by the detail route)
// ---------------------------------------------------------------------------

async function fetchCampaign(id: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw new Error(`Campaign not found: ${error.message}`);
  return data;
}

export const getCampaignFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => {
    const campaign = await fetchCampaign(data.id);
    // Live candidate count — avoids showing stale campaign.candidate_count
    const supabase = getSupabaseAdmin();
    const { count } = await supabase
      .from("experienced_candidates")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", data.id)
      .neq("fit_tier", "skip");
    return { ...campaign, candidate_count: count ?? campaign.candidate_count };
  });

// ---------------------------------------------------------------------------
// Fetch all campaigns (landing page list)
// ---------------------------------------------------------------------------

async function fetchAllCampaigns() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("campaigns")
    .select("id, name, status, candidate_count, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to fetch campaigns: ${error.message}`);

  const campaigns = data ?? [];
  if (campaigns.length === 0) return [];

  // Live company count from campaign_companies (campaigns.company_count is a
  // denormalized cache that can go stale if an insert fails mid-run)
  const { data: companyRows } = await supabase
    .from("campaign_companies")
    .select("campaign_id")
    .in("campaign_id", campaigns.map((c) => c.id));

  const companyCountMap = new Map<string, number>();
  for (const row of companyRows ?? []) {
    companyCountMap.set(row.campaign_id, (companyCountMap.get(row.campaign_id) ?? 0) + 1);
  }

  return campaigns.map((c) => ({
    ...c,
    company_count: companyCountMap.get(c.id) ?? 0,
  }));
}

export const getCampaignsFn = createServerFn({ method: "GET" })
  .handler(() => fetchAllCampaigns());

// ---------------------------------------------------------------------------
// Fetch all candidates across all campaigns (master database)
// ---------------------------------------------------------------------------

async function fetchAllCandidates() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("experienced_candidates")
    .select("id, campaign_id, full_name, current_title, current_company, linkedin_url, email, fit_tier, fit_score, is_archived, created_at, campaigns(name)")
    .eq("is_archived", false)
    .order("fit_score", { ascending: false });
  if (error) throw new Error(`Failed to fetch candidates: ${error.message}`);
  return (data ?? []).map((row) => ({
    ...row,
    campaign_name: (row.campaigns as unknown as { name: string } | null)?.name ?? null,
  }));
}

export const getAllCandidatesFn = createServerFn({ method: "GET" })
  .handler(() => fetchAllCandidates());

// ---------------------------------------------------------------------------
// Fetch companies for a campaign, enriched with per-tier candidate counts
// ---------------------------------------------------------------------------

type TierCounts = { strong: number; good: number; partial: number };

async function fetchCampaignCompaniesEnriched(campaignId: string) {
  const supabase = getSupabaseAdmin();

  const { data: companies, error: compErr } = await supabase
    .from("campaign_companies")
    .select("*")
    .eq("campaign_id", campaignId);
  if (compErr) throw new Error(`Failed to fetch companies: ${compErr.message}`);
  if (!companies || companies.length === 0) return [];

  const { data: candidates, error: candErr } = await supabase
    .from("experienced_candidates")
    .select("company_id, fit_tier, title")
    .eq("campaign_id", campaignId)
    .neq("fit_tier", "skip");
  if (candErr) throw new Error(`Failed to fetch candidates: ${candErr.message}`);

  const tierMap = new Map<string, TierCounts>();
  const titleMap = new Map<string, Set<string>>();

  for (const c of candidates ?? []) {
    if (!c.company_id) continue;
    if (!tierMap.has(c.company_id)) tierMap.set(c.company_id, { strong: 0, good: 0, partial: 0 });
    if (!titleMap.has(c.company_id)) titleMap.set(c.company_id, new Set());
    const tc = tierMap.get(c.company_id)!;
    if (c.fit_tier === "strong") tc.strong++;
    else if (c.fit_tier === "good") tc.good++;
    else if (c.fit_tier === "partial") tc.partial++;
    if (c.title) titleMap.get(c.company_id)!.add(c.title);
  }

  const enriched = companies.map((co) => ({
    ...co,
    tier_counts: tierMap.get(co.apollo_org_id) ?? { strong: 0, good: 0, partial: 0 },
    candidate_titles: [...(titleMap.get(co.apollo_org_id) ?? [])].slice(0, 6),
  }));

  enriched.sort((a, b) => {
    const aStrong = a.tier_counts.strong > 0 ? 1 : 0;
    const bStrong = b.tier_counts.strong > 0 ? 1 : 0;
    if (bStrong !== aStrong) return bStrong - aStrong;
    const aTotal = a.tier_counts.strong + a.tier_counts.good + a.tier_counts.partial;
    const bTotal = b.tier_counts.strong + b.tier_counts.good + b.tier_counts.partial;
    return bTotal - aTotal;
  });

  return enriched;
}

export const getCampaignCompaniesFn = createServerFn({ method: "POST" })
  .validator(z.object({ campaignId: z.string().min(1) }))
  .handler(async ({ data }) => fetchCampaignCompaniesEnriched(data.campaignId));

// ---------------------------------------------------------------------------
// Fetch candidates for a campaign with optional filters
// ---------------------------------------------------------------------------

const campaignCandidatesValidator = z.object({
  campaignId: z.string().min(1),
  companyId: z.string().optional(),
  tiers: z.array(z.enum(["strong", "good", "partial"])).default([]),
  expMin: z.number().int().min(0).default(0),
  expMax: z.number().int().optional(),
  locations: z.array(z.string()).default([]),
  employmentStatuses: z.array(z.string()).default([]),
});

async function fetchCampaignCandidates(
  params: z.infer<typeof campaignCandidatesValidator>,
) {
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from("experienced_candidates")
    .select("*")
    .eq("campaign_id", params.campaignId)
    .neq("fit_tier", "skip")
    .order("fit_score", { ascending: false });

  if (params.companyId) query = query.eq("company_id", params.companyId);
  if (params.tiers.length > 0) query = query.in("fit_tier", params.tiers);
  if (params.expMin > 0) query = query.gte("years_experience", params.expMin);
  if (params.expMax !== undefined) query = query.lte("years_experience", params.expMax);
  if (params.locations.length > 0) {
    const locationFilter = params.locations.map((l) => `location.ilike.%${l}%`).join(",");
    query = query.or(locationFilter);
  }

  const { data: candidates, error } = await query;
  if (error) throw new Error(`Failed to fetch candidates: ${error.message}`);

  const tierOrder: Record<string, number> = { strong: 0, good: 1, partial: 2 };
  return [...(candidates ?? [])].sort((a, b) => {
    const ta = tierOrder[a.fit_tier] ?? 3;
    const tb = tierOrder[b.fit_tier] ?? 3;
    if (ta !== tb) return ta - tb;
    return (b.fit_score ?? 0) - (a.fit_score ?? 0);
  });
}

export const getCampaignCandidatesFn = createServerFn({ method: "POST" })
  .validator(campaignCandidatesValidator)
  .handler(async ({ data }) => fetchCampaignCandidates(data));

// ---------------------------------------------------------------------------
// Fetch experienced candidates by IDs (for pipelines page)
// ---------------------------------------------------------------------------

export const getExpCandidatesByIdsFn = createServerFn({ method: "POST" })
  .validator(z.object({ ids: z.array(z.string()) }))
  .handler(async ({ data }) => {
    if (!data.ids.length) return [];
    const supabase = getSupabaseAdmin();
    const { data: rows, error } = await supabase
      .from("experienced_candidates")
      .select("id, full_name, current_title, current_company, linkedin_url, email, fit_tier, fit_score, apollo_raw")
      .in("id", data.ids);
    if (error) throw new Error(`Failed to fetch experienced candidates: ${error.message}`);
    return rows ?? [];
  });

// ---------------------------------------------------------------------------
// Apify helpers (kept for seed-companies flow only)
// ---------------------------------------------------------------------------

const APIFY_BASE = "https://api.apify.com/v2";
const APIFY_ACTOR = "fabri-lab~linkedin-public-search-lead-extractor";
const POLL_INTERVAL_MS = 10_000;
const MAX_POLL_MS = 15 * 60 * 1000; // 15 minutes

const COMPANY_SIZE_MINS: Record<string, number> = {
  "Startup (1–50)":           1,
  "Scale-up (51–200)":        51,
  "Growth (201–1000)":        201,
  "Mid-market (1001–5000)":   1001,
  "Enterprise (5000+)":       5001,
};

const COMPANY_SIZE_MAXS: Record<string, number> = {
  "Startup (1–50)":           50,
  "Scale-up (51–200)":        200,
  "Growth (201–1000)":        1000,
  "Mid-market (1001–5000)":   5000,
  "Enterprise (5000+)":       10_000_000,
};

function getMinEmployees(sizes: string[]): number {
  if (!sizes.length) return 1;
  return Math.min(...sizes.map((s) => COMPANY_SIZE_MINS[s] ?? 1));
}

function getMaxEmployees(sizes: string[]): number | undefined {
  if (!sizes.length) return undefined;
  return Math.max(...sizes.map((s) => COMPANY_SIZE_MAXS[s] ?? 10_000_000));
}

const CITY_MAP: Record<string, string> = {
  "Bangalore":  "Bangalore, India",
  "Mumbai":     "Mumbai, India",
  "Delhi NCR":  "Delhi, India",
  "Hyderabad":  "Hyderabad, India",
  "Pune":       "Pune, India",
  "Chennai":    "Chennai, India",
  "Kolkata":    "Kolkata, India",
  "Ahmedabad":  "Ahmedabad, India",
  "Jaipur":     "Jaipur, India",
};

const SENIORITY_YOE: Record<string, number> = {
  junior: 2, mid: 4, senior: 7, lead: 9, manager: 9, director: 12,
};


function mapDepartments(domains: string[] = []): string[] | undefined {
  const map: Record<string, string> = {
    "Full Stack Engineering":      "engineering",
    "Backend Engineering":         "engineering",
    "Frontend Engineering":        "engineering",
    "AI / ML Engineering":         "engineering",
    "Robotics & Embedded Systems": "engineering",
    "DevOps & Cloud":              "engineering",
    "Data & Analytics":            "engineering",
    "Product Management":          "product",
    "UX & Design":                 "design",
    "Growth Marketing":            "marketing",
    "Performance Marketing":       "marketing",
    "Brand & Content":             "marketing",
    "Product Marketing":           "marketing",
    "Enterprise B2B Sales":        "sales",
    "SaaS Sales":                  "sales",
    "Channel Partnerships":        "sales",
    "Business Development":        "sales",
    "Strategy & Operations":       "operations",
    "Finance & Accounting":        "finance",
    "HR & Talent":                 "hr",
  };
  const mapped = [...new Set(domains.map((d) => map[d]).filter(Boolean))];
  return mapped.length ? mapped : undefined;
}

function buildLocations(locations: string[]): string[] {
  if (!locations.length || locations.includes("All India")) return ["India"];
  if (locations.includes("International (outside India)") &&
      locations.filter((l) => l !== "International (outside India)").length === 0) {
    return [];
  }
  return locations
    .filter((l) => l !== "International (outside India)" && l !== "All India")
    .map((l) => CITY_MAP[l] ?? l);
}

function mapSeniorities(seniorities: string[]): string[] {
  const sMap: Record<string, string> = {
    junior:    "entry",
    mid:       "senior",
    senior:    "senior",
    lead:      "manager",
    manager:   "manager",
    director:  "director",
    vp:        "vp",
    c_suite:   "c-suite",
    founder:   "c-suite",
  };
  const result = [...new Set(seniorities.map((s) => sMap[s]).filter(Boolean))];
  return result.length ? result : ["senior", "manager"];
}

function normaliseUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.replace(/^(https?):\/\/([^/])/, "$1://$2").replace(/^https?\/\//, "https://");
}

async function apifyGet(token: string, path: string): Promise<unknown> {
  const res = await fetch(`${APIFY_BASE}${path}?token=${token}`);
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Apify GET ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

async function apifyPost(token: string, path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${APIFY_BASE}${path}?token=${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Apify POST ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Google Search → LinkedIn profiles (via Apify Google Search Scraper)
// ---------------------------------------------------------------------------
// Strategy: search Google for `site:linkedin.com/in "Title" "India"` — Google
// indexes public LinkedIn profiles and returns rich snippets with name, title,
// company, and location. Much more reliable than LinkedIn's own search (which
// blocks unauthenticated access) and very cheap (compute-unit billing).

interface GoogleOrganicResult {
  title?: string;
  url?: string;
  description?: string;
  displayedUrl?: string;
  position?: number;
}

interface GoogleSearchDatasetItem {
  organicResults?: GoogleOrganicResult[];
  searchQuery?: { term?: string; page?: number };
}

function parseLinkedInGoogleResult(title: string, snippet: string): {
  fullName: string | null;
  currentTitle: string | null;
  currentCompany: string | null;
  locationText: string | null;
} {
  // Titles look like: "Rahul Sharma - BDR at TechCorp | LinkedIn"
  // or: "Rahul Sharma - Business Development Representative | LinkedIn"
  const clean = title.replace(/\s*[|–]\s*LinkedIn\s*$/i, "").trim();
  const parts = clean.split(/\s+-\s+/);

  const fullName = parts[0]?.trim() || null;
  let currentTitle: string | null = null;
  let currentCompany: string | null = null;

  if (parts.length >= 2) {
    const mid = parts[1]?.trim() ?? "";
    const atMatch = mid.match(/^(.+?)\s+(?:at|@)\s+(.+)$/i);
    if (atMatch) {
      currentTitle = atMatch[1].trim();
      currentCompany = atMatch[2].trim();
    } else {
      currentTitle = mid || null;
      // Third segment (if present) is often the company
      if (parts.length >= 3) currentCompany = parts[2].trim() || null;
    }
  }

  // Extract location from snippet — look for city+India patterns
  const locMatch = snippet.match(
    /([A-Z][a-zÀ-ÖØ-öø-ÿ]+(?:\s+[A-Z][a-zÀ-ÖØ-öø-ÿ]+)*),?\s+(?:India|Maharashtra|Karnataka|Tamil\s*Nadu|Telangana|Delhi|Gujarat|Rajasthan|West\s*Bengal)/i,
  );
  const locationText = locMatch ? locMatch[0] : null;

  return { fullName, currentTitle, currentCompany, locationText };
}

async function searchViaGoogle(
  token: string,
  jdParsed: JdParsed,
  filters: z.infer<typeof campaignFiltersSchema>,
  maxResults = 100,
): Promise<ApifyPerson[]> {
  const titles = [...new Set((jdParsed.titles ?? []).filter(t => t.length > 2))].slice(0, 6);
  if (titles.length === 0 && jdParsed.function) titles.push(jdParsed.function);

  const locations = buildLocations(filters.locations ?? []);
  // Use first location (or "India" fallback) in the query; Google's countryCode handles the rest
  const locationQuery = locations.length > 0 ? `"${locations[0]}"` : '"India"';

  // Build one query per title: site:linkedin.com/in "Title" "India" -inurl:company
  const queries = titles
    .map(t => `site:linkedin.com/in "${t}" ${locationQuery} -inurl:company`)
    .join("\n");

  const pagesPerQuery = Math.max(1, Math.ceil(maxResults / (titles.length * 10)));

  const body = {
    queries,
    maxPagesPerQuery: Math.min(pagesPerQuery, 5),
    countryCode: "in",
    languageCode: "en",
  };

  console.log("[Google Search input]", { queries: queries.split("\n"), pagesPerQuery });

  const runRes = await fetch(
    `${APIFY_BASE}/acts/apify~google-search-scraper/runs?token=${token}&timeoutSecs=180`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
  );
  if (!runRes.ok) {
    const text = await runRes.text().catch(() => runRes.statusText);
    throw new Error(`Google Search Scraper start failed ${runRes.status}: ${text}`);
  }
  const runResp = await runRes.json() as { data?: { id?: string } };
  const runId = runResp?.data?.id;
  if (!runId) throw new Error("Google Search Scraper did not return a run ID.");
  console.log("[Google Search] run started:", runId);

  // Poll until done (target: 30–90s)
  const deadline = Date.now() + 4 * 60 * 1000;
  let status: string | undefined = "READY";
  while (status === "READY" || status === "RUNNING") {
    if (Date.now() >= deadline) {
      console.warn("[Google Search] timeout — fetching partial results");
      break;
    }
    await new Promise(r => setTimeout(r, 5_000));
    const sr = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${token}`);
    const sd = await sr.json() as { data?: { status?: string } };
    status = sd?.data?.status;
    console.log("[Google Search poll]", status);
  }

  // Fetch dataset items — each item = one SERP page with organicResults[]
  const datasetRes = await fetch(
    `${APIFY_BASE}/actor-runs/${runId}/dataset/items?token=${token}&limit=1000`,
  );
  if (!datasetRes.ok) {
    const text = await datasetRes.text().catch(() => datasetRes.statusText);
    throw new Error(`Google dataset fetch failed ${datasetRes.status}: ${text}`);
  }
  const rawItems = await datasetRes.json() as GoogleSearchDatasetItem[];
  const items: GoogleSearchDatasetItem[] = Array.isArray(rawItems) ? rawItems : [];
  console.log(`[Google Search] ${items.length} SERP pages returned`);

  const seen = new Set<string>();
  const people: ApifyPerson[] = [];

  for (const item of items) {
    for (const result of item.organicResults ?? []) {
      const url = result.url ?? "";
      // Only /in/ profile URLs, not /company/ pages
      if (!url.includes("linkedin.com/in/")) continue;
      if (seen.has(url)) continue;
      seen.add(url);

      const title = result.title ?? "";
      const snippet = result.description ?? "";
      if (!title) continue;

      const parsed = parseLinkedInGoogleResult(title, snippet);
      if (!parsed.fullName) continue;

      // Extract public identifier from the URL path
      const inMatch = url.match(/linkedin\.com\/in\/([^/?#]+)/);
      const publicIdentifier = inMatch?.[1] ?? undefined;

      people.push({
        publicIdentifier,
        linkedinUrl:  url,
        fullName:     parsed.fullName,
        currentTitle: parsed.currentTitle ?? undefined,
        company:      parsed.currentCompany ?? undefined,
        locationText: parsed.locationText ?? undefined,
        headline:     snippet.slice(0, 300) || undefined,
      });

      if (people.length >= maxResults) break;
    }
    if (people.length >= maxResults) break;
  }

  console.log(`[Google Search] ${people.length} LinkedIn profiles extracted`);
  return people;
}

interface ApifyPerson {
  // fabri-lab~linkedin-public-search-lead-extractor output fields
  publicIdentifier?: string;
  linkedinUrl?: string;
  url?: string;
  fullName?: string;
  searchTitle?: string;
  currentTitle?: string;
  jobTitle?: string;
  headline?: string;
  company?: string;
  currentCompany?: string;
  locationText?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Fit scoring
// ---------------------------------------------------------------------------

type FitTier = "strong" | "good" | "partial" | "skip";

interface ScorerInput {
  id: string;
  name?: string;
  title?: string;
  headline?: string;
  skills?: string[];
  [key: string]: unknown;
}

function scoreCandidate(
  person: ScorerInput,
  requiredSkills: string[],
  niceToHave: string[],
): { score: number; maxScore: number; requiredMatch: boolean; tier: FitTier } {
  const haystack = [
    person.title ?? "",
    person.headline ?? "",
    ...(person.skills ?? []),
  ]
    .join(" ")
    .toLowerCase();

  const pointsPerRequired = 10;
  const pointsPerNice = 3;
  const maxScore =
    requiredSkills.length * pointsPerRequired + niceToHave.length * pointsPerNice;

  let score = 0;
  let requiredMatched = 0;
  for (const skill of requiredSkills) {
    if (haystack.includes(skill.toLowerCase())) {
      score += pointsPerRequired;
      requiredMatched++;
    }
  }
  for (const skill of niceToHave) {
    if (haystack.includes(skill.toLowerCase())) {
      score += pointsPerNice;
    }
  }

  const requiredMatch = requiredMatched === requiredSkills.length;
  const ratio = maxScore > 0 ? score / maxScore : 0;
  const tier: FitTier =
    ratio >= 0.8 ? "strong" :
    ratio >= 0.5 ? "good" :
    ratio >= 0.3 ? "partial" :
    "skip";

  return { score, maxScore, requiredMatch, tier };
}

// ---------------------------------------------------------------------------
// Claude Haiku relevance scoring
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildJdSummary(parsedJd: JdParsed): string {
  return `Role: ${parsedJd?.function ?? ''} (${parsedJd?.seniority_label ?? ''})
Required skills: ${(parsedJd?.required_skills ?? []).join(', ')}
Nice to have: ${(parsedJd?.nice_to_have ?? []).join(', ')}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function scoreBatch(
  batch: any[],
  parsedJd: JdParsed,
  offset: number,
): Promise<(any & { jd_fit_tier: string; jd_fit_score: number })[]> {
  const prompt = `You are a senior recruiter scoring candidates for a B2B SaaS company (FlytBase — drone software, global enterprise clients). We are hiring in India only.

JOB:
${buildJdSummary(parsedJd)}

SCORING CRITERIA (100 pts total):
1. Role Match (35 pts): Exact same function/environment = 35; adjacent role = 20; distant but relevant = 5; unrelated = 0.
2. High Agency / Ownership (25 pts): Built function from scratch, owned revenue or KPIs, led a team, promoted early, solved ambiguous problems independently.
3. Global Client Exposure (25 pts): Managed enterprise accounts across multiple countries, international B2B sales/support, multi-timezone stakeholder coordination.
4. Smart / Learning Velocity (15 pts): Fast career trajectory, cross-functional ability, top-tier company or education, picked up new domains quickly.

PENALTIES (deduct from score before determining tier):
- Location outside India (e.g. USA, UK, Singapore, Dubai, Canada, Australia): −25 pts. If location is blank, assume India.
- Currently at a very large MNC or global enterprise (Google, Microsoft, Amazon, Meta, Salesforce, Oracle, SAP, Accenture, TCS, Infosys, Wipro, Cognizant, HCL, Capgemini, IBM, McKinsey, BCG, Deloitte, EY, PwC, KPMG, etc.): −15 pts. We need people comfortable with startup ambiguity, not polished MNC processes.

Tiers (after penalties): strong ≥ 75 | good 50–74 | partial 30–49 | irrelevant < 30

CANDIDATES (JSON array):
${JSON.stringify(batch.map((p, i) => ({
  i: offset + i,
  title: p.currentTitle ?? p.jobTitle ?? p.headline,
  company: p.company ?? p.currentCompany,
  location: p.locationText ?? null,
  snippet: p.headline?.slice(0, 200),
})))}

Return a JSON array with one object per candidate in the same order:
[{ "i": ${offset}, "score": 0-100, "tier": "strong"|"good"|"partial"|"irrelevant", "reason": "max 60 chars: top signal + penalty if any" }]
Return ONLY the JSON array, no other text.`;

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = (response.content[0] as { type: string; text: string }).text
    .replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  let scores: { i: number; score: number; tier: string; reason?: string }[];
  try {
    scores = JSON.parse(raw);
  } catch (e) {
    console.error('[scoreBatch JSON.parse failed] raw:', raw.slice(0, 500));
    throw e;
  }

  // Derive tier from numeric score — Claude's tier string is sometimes inconsistent
  const deriveTier = (score: number): 'strong' | 'good' | 'partial' | 'irrelevant' => {
    if (score >= 75) return 'strong';
    if (score >= 50) return 'good';
    if (score >= 30) return 'partial';
    return 'irrelevant';
  };

  console.log(`[Claude scoring batch offset=${offset}]`, scores.map(s => `#${s.i} ${deriveTier(s.score)} ${s.score}`).join(', '));

  return batch.map((p, i) => {
    const score = scores[i]?.score ?? 0;
    return {
      ...p,
      jd_fit_tier:   deriveTier(score),
      jd_fit_score:  score,
      jd_fit_reason: scores[i]?.reason ?? '',
    };
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function scoreCandidates(
  people: any[],
  parsedJd: JdParsed,
): Promise<(any & { jd_fit_tier: string; jd_fit_score: number })[]> {
  if (!people.length) return [];
  const BATCH_SIZE = 30;
  const results: (any & { jd_fit_tier: string; jd_fit_score: number })[] = [];
  for (let i = 0; i < people.length; i += BATCH_SIZE) {
    const batch = people.slice(i, i + BATCH_SIZE);
    let scored: (any & { jd_fit_tier: string; jd_fit_score: number })[] | null = null;
    try {
      scored = await scoreBatch(batch, parsedJd, i);
    } catch (err) {
      console.warn(`[Claude scoring] batch offset=${i} failed, retrying once`, err);
      try {
        scored = await scoreBatch(batch, parsedJd, i);
      } catch (err2) {
        console.error(`[Claude scoring] batch offset=${i} failed after retry; assigning partial fallback`, err2);
        scored = batch.map((p) => ({
          ...p,
          jd_fit_tier: 'partial',
          jd_fit_score: 50,
        }));
      }
    }
    results.push(...scored);
  }
  return results;
}

// ---------------------------------------------------------------------------
// Server function
// ---------------------------------------------------------------------------

async function runApifySearch(campaignId: string, maxResults = 100): Promise<{ candidateCount: number; companyCount: number }> {
  const supabase = getSupabaseAdmin();

  const campaign = await fetchCampaign(campaignId);
  const jdParsed = campaign.jd_parsed as unknown as JdParsed;
  const filters = campaign.filters as unknown as z.infer<typeof campaignFiltersSchema>;

  await supabase.from("campaigns").update({ status: "searching" }).eq("id", campaignId);

  try {
    // Phase 1: fetch candidates via Google Search → LinkedIn profiles
    const apifyKey = process.env.APIFY_API_KEY ?? process.env.APIFY_TOKEN;
    if (!apifyKey) throw new Error("Missing APIFY_API_KEY in environment. Add it to .env");
    const people = await searchViaGoogle(apifyKey, jdParsed, filters, maxResults);

    // Phase 2: Claude scoring
    await supabase.from("campaigns").update({ status: "scoring" }).eq("id", campaignId);

    console.log(`[Google→LinkedIn profiles: ${people.length}]`, people.slice(0, 2));

    // Filter: drop results with no identifying info
    const personResults = people.filter((p) => !!(p.fullName || p.linkedinUrl));
    console.log(`[pre-filter] ${personResults.length}/${people.length} valid person results`);

    const seen = new Set<string>();
    const uniquePeople = personResults.filter(p => {
      const key = p.publicIdentifier ?? p.linkedinUrl;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    console.log(`[Dedup] ${uniquePeople.length}/${personResults.length} unique candidates`);

    const scoredPeople = await scoreCandidates(uniquePeople, jdParsed);
    const relevantPeople = scoredPeople.filter(p => p.jd_fit_tier !== 'irrelevant');
    console.log(`[Claude scoring] ${relevantPeople.length}/${uniquePeople.length} candidates kept after filtering irrelevant`);

    type CompanyEntry = { apollo_org_id: string; company_name: string; count: number };
    const companyMap = new Map<string, CompanyEntry>();

    // Cross-campaign deduplication: skip LinkedIn URLs already in OTHER campaigns.
    // Candidates already in THIS campaign are handled by the merge logic below (update, not re-insert).
    const { data: existingRows } = await supabase
      .from("experienced_candidates")
      .select("linkedin_url")
      .not("linkedin_url", "is", null)
      .neq("campaign_id", campaignId);
    const existingUrls = new Set((existingRows ?? []).map((r) => r.linkedin_url as string));
    console.log(`[dedup] ${existingUrls.size} LinkedIn URLs in other campaigns`);

    // Blacklist: filter out company-page results + already-seen candidates.
    // IMPORTANT: Only apply company-name heuristic to fullName (a proper person name field).
    // Do NOT check searchTitle — it includes job title + company like "BDR at TechSolutions Pvt Ltd"
    // which would incorrectly blacklist real candidates at companies with common words in their name.
    const COMPANY_WORDS = /\b(pvt|ltd|limited|llp|inc|corp|corporation)\b/i;
    // Explicit non-India location signals in title, location, or snippet
    const NON_INDIA_GEO = /\b(usa|united states|u\.s\.a|new york|san francisco|seattle|boston|austin|chicago|los angeles|uk|united kingdom|london|manchester|singapore|dubai|uae|abu dhabi|canada|toronto|vancouver|australia|sydney|melbourne|germany|netherlands|france|europe)\b/i;

    const validPeople = relevantPeople.filter((p) => {
      const fullName: string = p.fullName ?? "";
      const displayName: string = fullName || p.searchTitle || "";
      if (!displayName) return false;
      // Only apply company-word check to fullName — never to searchTitle
      if (fullName && COMPANY_WORDS.test(fullName)) {
        console.log(`[blacklist] skipping company-named result: "${fullName}"`);
        return false;
      }
      const linkedinUrl: string | null = p.linkedinUrl ?? p.url ?? null;
      if (linkedinUrl && existingUrls.has(linkedinUrl)) {
        console.log(`[dedup] skipping already-seen: "${displayName}" (${linkedinUrl})`);
        return false;
      }
      // Drop candidates whose location or headline explicitly shows a non-India country
      const geoText = `${p.locationText ?? ''} ${p.headline ?? ''}`;
      if (NON_INDIA_GEO.test(geoText)) {
        console.log(`[geo-filter] skipping non-India: "${displayName}" (${p.locationText ?? 'no loc'})`);
        return false;
      }
      return true;
    });
    console.log(`[after dedup+blacklist] ${validPeople.length} candidates remaining`);

    // Phase 3: saving
    await supabase.from("campaigns").update({ status: "saving" }).eq("id", campaignId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const candidateRows = validPeople.map((p: any) => {
      const locText: string = p.locationText ?? '';
      const locParts = locText.split(',').map((s: string) => s.trim());
      // Prefer fullName; fall back to searchTitle only if fullName is absent
      const resolvedName = p.fullName || p.searchTitle || null;
      return {
        campaign_id:        campaignId,
        apollo_id:          p.publicIdentifier ?? p.linkedinUrl ?? p.url,
        full_name:          resolvedName,
        current_title:      p.currentTitle ?? p.jobTitle ?? p.headline ?? null,
        current_company:    p.company ?? p.currentCompany ?? null,
        current_department: null,
        linkedin_url:       p.linkedinUrl ?? p.url ?? null,
        // Apollo returns email directly (may be null on free plan — still pass through)
        email:              (p as unknown as { email?: string | null }).email ?? null,
        phone:              null,
        location_city:      locParts[0] || null,
        location_state:     locParts[1] || null,
        location_country:   locParts[2] || locParts[1] || null,
        years_experience:   null,
        previous_companies: [],
        skills:             [],
        employment_status:  null,
        fit_tier:           p.jd_fit_tier,
        fit_score:          p.jd_fit_score,
        required_match:     false,
        nice_to_have_count: 0,
        // Store fit reason + key Apify fields in apollo_raw for tooltip display
        apollo_raw: {
          _fit_reason:    p.jd_fit_reason ?? null,
          locationText:   p.locationText ?? null,
          searchSnippet:  p.headline ?? null,
        },
      };
    });

    // Rebuild companyMap from candidateRows for the upsert below
    for (const row of candidateRows) {
      const companyName = row.current_company;
      if (!companyName) continue;
      const orgId = companyName.toLowerCase().replace(/\s+/g, '-');
      const existing = companyMap.get(orgId);
      if (existing) {
        existing.count++;
      } else {
        companyMap.set(orgId, {
          apollo_org_id: orgId, company_name: companyName, count: 1,
        });
      }
    }

    console.log("[candidate row sample]", candidateRows[0]);

    const companyRows = [...companyMap.values()].map((c) => ({
      campaign_id:   campaignId,
      apollo_org_id: c.apollo_org_id,
      company_name:  c.company_name,
    }));

    // ── Merge strategy: update existing candidates, insert new ones ──────────
    // Replaces the old delete-then-insert approach which wiped is_archived flags,
    // outreach history, and pipeline assignments on every re-run.
    const { data: existingForCampaign } = await supabase
      .from("experienced_candidates")
      .select("id, linkedin_url, apollo_id")
      .eq("campaign_id", campaignId);

    const existingByLinkedIn = new Map<string, string>(
      (existingForCampaign ?? [])
        .filter((c) => c.linkedin_url)
        .map((c) => [c.linkedin_url as string, c.id as string]),
    );
    const existingByApolloId = new Map<string, string>(
      (existingForCampaign ?? [])
        .filter((c) => c.apollo_id)
        .map((c) => [c.apollo_id as string, c.id as string]),
    );

    type CandidateUpdate = {
      id: string;
      fit_tier: string;
      fit_score: number;
      current_title: string | null;
      current_company: string | null;
      apollo_raw: object;
    };

    const rowsToInsert: typeof candidateRows = [];
    const rowsToUpdate: CandidateUpdate[] = [];

    for (const row of candidateRows) {
      const existingId =
        (row.linkedin_url && existingByLinkedIn.get(row.linkedin_url)) ||
        (row.apollo_id   && existingByApolloId.get(row.apollo_id))    ||
        null;

      if (existingId) {
        // Refresh scores + title only — never touch is_archived, email, outreach links
        rowsToUpdate.push({
          id:              existingId,
          fit_tier:        row.fit_tier,
          fit_score:       row.fit_score,
          current_title:   row.current_title,
          current_company: row.current_company,
          apollo_raw:      row.apollo_raw,
        });
      } else {
        rowsToInsert.push(row);
      }
    }

    console.log(`[save] ${rowsToInsert.length} new, ${rowsToUpdate.length} re-scored (history preserved)`);

    // Insert new candidates
    if (rowsToInsert.length > 0) {
      const CHUNK = 50;
      for (let start = 0; start < rowsToInsert.length; start += CHUNK) {
        const chunk = rowsToInsert.slice(start, start + CHUNK);
        const { error: candErr } = await supabase
          .from("experienced_candidates")
          .insert(chunk);
        if (candErr) {
          console.error(`[insert] candidates offset=${start} failed:`, candErr.message);
          throw new Error(`Failed to insert candidates: ${candErr.message}`);
        }
      }
    }

    // Re-score existing candidates (sequential updates — safe, no history lost)
    for (const upd of rowsToUpdate) {
      const { id, ...fields } = upd;
      const { error: updErr } = await supabase
        .from("experienced_candidates")
        .update(fields)
        .eq("id", id);
      if (updErr) console.warn(`[update] candidate ${id} failed:`, updErr.message);
    }

    // Companies: rebuild from scratch — no manual curation lives here
    const { error: delCompErr } = await supabase
      .from("campaign_companies")
      .delete()
      .eq("campaign_id", campaignId);
    if (delCompErr) console.warn("[delete] companies:", delCompErr.message);

    if (companyRows.length > 0) {
      const CHUNK = 50;
      for (let start = 0; start < companyRows.length; start += CHUNK) {
        const chunk = companyRows.slice(start, start + CHUNK);
        const { error: compErr } = await supabase
          .from("campaign_companies")
          .insert(chunk);
        if (compErr) {
          console.error(`[insert] companies offset=${start} failed:`, compErr.message);
          // Non-fatal — candidates already saved; log and continue
        }
      }
    }

    const distinctCompanyCount = companyMap.size;
    // Total = candidates that existed before + newly inserted this run
    const totalCandidateCount = (existingForCampaign?.length ?? 0) + rowsToInsert.length;

    await supabase
      .from("campaigns")
      .update({ status: "done", candidate_count: totalCandidateCount, company_count: distinctCompanyCount })
      .eq("id", campaignId);

    return { candidateCount: totalCandidateCount, companyCount: distinctCompanyCount };
  } catch (err) {
    console.error("[Apify error]", err);
    await supabase.from("campaigns").update({ status: "error" }).eq("id", campaignId);
    throw err;
  }
}

export const searchExperiencedCandidatesFn = createServerFn({ method: "POST" })
  .validator(z.object({ campaignId: z.string().min(1), maxResults: z.number().int().min(10).max(300).default(100) }))
  .handler(async ({ data }) => runApifySearch(data.campaignId, data.maxResults));

// ---------------------------------------------------------------------------
// Seed target companies
// ---------------------------------------------------------------------------

const SEED_QUERIES = [
  'B2B SaaS startup India selling globally',
  'drone software company India',
  'robotics autonomy startup India',
  'deep tech B2B India global clients',
  'enterprise software India Series A Series B',
  'IoT platform company India',
  'defence tech startup India',
  'industrial automation software India',
];

async function runSeedTargetCompanies(): Promise<{ inserted: number; skipped: number }> {
  const supabase = getSupabaseAdmin();
  const apifyKey = process.env.APIFY_API_KEY;
  if (!apifyKey) throw new Error("Missing APIFY_API_KEY in environment.");

  let inserted = 0;
  let skipped = 0;

  for (const query of SEED_QUERIES) {
    console.log(`[seed] Running query: "${query}"`);

    const body = {
      searchQuery:        query,
      maxItems:           30,
      profileScraperMode: "Short",
      takePages:          2,
    };

    const runRes = await fetch(
      `${APIFY_BASE}/acts/${APIFY_ACTOR}/runs?token=${apifyKey}&timeoutSecs=300`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    );
    if (!runRes.ok) {
      const text = await runRes.text().catch(() => runRes.statusText);
      console.error(`[seed] Actor start failed for query "${query}": ${runRes.status} ${text}`);
      continue;
    }
    const runResp = await runRes.json() as { data?: { id?: string } };
    const runId = runResp?.data?.id;
    if (!runId) {
      console.error(`[seed] No runId returned for query "${query}"`);
      continue;
    }

    // Poll until done
    const deadline = Date.now() + 10 * 60 * 1000;
    let status: string | undefined = "READY";
    while (status === "READY" || status === "RUNNING") {
      if (Date.now() >= deadline) { status = "TIMED-OUT"; break; }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      const statusRes = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${apifyKey}`);
      const rawText = await statusRes.text();
      let statusData: { data?: { status?: string } } = {};
      try { statusData = JSON.parse(rawText); } catch { /* ignore */ }
      status = statusData?.data?.status;
      console.log(`[seed] poll "${query}" → ${status}`);
    }

    if (status !== "SUCCEEDED" && status !== "TIMED-OUT") {
      console.warn(`[seed] Run ended with ${status} for "${query}", skipping`);
      continue;
    }

    // Fetch results
    const itemsRes = await fetch(`${APIFY_BASE}/actor-runs/${runId}/dataset/items?token=${apifyKey}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: any[] = await itemsRes.json().catch(() => []);
    console.log(`[seed] "${query}" → ${items.length} raw results`);

    // Filter to company profiles only
    const companyItems = items.filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (item: any) => typeof item.linkedinUrl === "string" && item.linkedinUrl.includes("/company/"),
    );
    console.log(`[seed] "${query}" → ${companyItems.length} company profiles`);

    for (const item of companyItems) {
      const linkedinUrl: string = item.linkedinUrl;
      const name: string = item.fullName ?? item.name ?? item.searchTitle ?? linkedinUrl;

      const { error } = await supabase
        .from("target_companies")
        .upsert(
          { name, linkedin_url: linkedinUrl, why_similar: query },
          { onConflict: "linkedin_url" },
        );

      if (error) {
        console.error(`[seed] upsert failed for ${linkedinUrl}: ${error.message}`);
        skipped++;
      } else {
        inserted++;
      }
    }
  }

  console.log(`[seed] Done — inserted/updated: ${inserted}, skipped: ${skipped}`);
  return { inserted, skipped };
}

export const seedTargetCompaniesFn = createServerFn({ method: "POST" })
  .handler(() => runSeedTargetCompanies());

// ---------------------------------------------------------------------------
// Target companies CRUD
// ---------------------------------------------------------------------------

export const getTargetCompaniesFn = createServerFn({ method: "GET" })
  .handler(async () => {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("target_companies")
      .select("id, name, linkedin_url, industry, size, why_similar, is_active, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(`Failed to fetch target companies: ${error.message}`);
    return data ?? [];
  });

export const addTargetCompanyFn = createServerFn({ method: "POST" })
  .validator(z.object({
    name:         z.string().min(1),
    linkedin_url: z.string().min(1),
    industry:     z.string().optional(),
    why_similar:  z.string().optional(),
  }))
  .handler(async ({ data }) => {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("target_companies")
      .upsert({ ...data, is_active: true }, { onConflict: "linkedin_url" });
    if (error) throw new Error(`Failed to add company: ${error.message}`);
    return { ok: true };
  });

export const setTargetCompanyActiveFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1), is_active: z.boolean() }))
  .handler(async ({ data }) => {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("target_companies")
      .update({ is_active: data.is_active })
      .eq("id", data.id);
    if (error) throw new Error(`Failed to update company: ${error.message}`);
    return { ok: true };
  });

export const updateTargetCompanyFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().min(1),
      updates: z.object({
        why_similar: z.string().optional().nullable(),
      }),
    }),
  )
  .handler(async ({ data }) => {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("target_companies")
      .update(data.updates)
      .eq("id", data.id);
    if (error) throw new Error(`Failed to update company: ${error.message}`);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Archive / restore experienced candidates (soft delete)
// ---------------------------------------------------------------------------

export const archiveExpCandidateFn = createServerFn({ method: "POST" })
  .validator(z.object({ ids: z.array(z.string().min(1)).min(1), archive: z.boolean() }))
  .handler(async ({ data }) => {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("experienced_candidates")
      .update({ is_archived: data.archive })
      .in("id", data.ids);
    if (error) throw new Error(`Failed to archive candidates: ${error.message}`);
    return { ok: true };
  });
