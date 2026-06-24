import type { SupabaseClient } from "@supabase/supabase-js";

// ── Name helpers ──────────────────────────────────────────────────────────────

function normalizeNameParts(fullName: string): {
  first: string;
  last: string;
  all: string[];
} {
  const parts = fullName
    .trim()
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  return {
    first: parts[0] ?? "",
    last: parts[parts.length - 1] ?? "",
    all: parts,
  };
}

// ── Email pattern detection ───────────────────────────────────────────────────

interface PatternResult {
  apply: (p: { first: string; last: string }) => string;
  domain: string;
}

/**
 * Infers the email format used by a college by analysing a sample of
 * (name, email) pairs from student_records. Returns a function that
 * generates an email address for a given name, or null if no clear
 * pattern is found.
 */
function detectEmailPattern(
  samples: Array<{ name: string; email: string }>,
): PatternResult | null {
  const parsed = samples.flatMap((s) => {
    const atIdx = s.email.indexOf("@");
    if (atIdx === -1) return [];
    const local = s.email.slice(0, atIdx).toLowerCase();
    const domain = s.email.slice(atIdx + 1).toLowerCase();
    const p = normalizeNameParts(s.name);
    if (!p.first || !p.last) return [];
    return [{ local, domain, p }];
  });

  if (!parsed.length) return null;

  // Identify dominant domain
  const domainCounts = new Map<string, number>();
  for (const { domain } of parsed) {
    domainCounts.set(domain, (domainCounts.get(domain) ?? 0) + 1);
  }
  const domain = [...domainCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const domainSamples = parsed.filter((x) => x.domain === domain);

  type PatternCandidate = {
    test: (
      local: string,
      p: ReturnType<typeof normalizeNameParts>,
    ) => boolean;
    apply: (p: { first: string; last: string }) => string;
  };

  const candidates: PatternCandidate[] = [
    {
      // first.last@domain
      test: (l, p) => l === `${p.first}.${p.last}`,
      apply: (p) => `${p.first}.${p.last}@${domain}`,
    },
    {
      // firstlast@domain
      test: (l, p) => l === `${p.first}${p.last}`,
      apply: (p) => `${p.first}${p.last}@${domain}`,
    },
    {
      // f.last@domain  (first initial + dot + last)
      test: (l, p) => p.first.length > 0 && l === `${p.first[0]}.${p.last}`,
      apply: (p) => `${p.first[0]}.${p.last}@${domain}`,
    },
    {
      // flast@domain  (first initial + last)
      test: (l, p) => p.first.length > 0 && l === `${p.first[0]}${p.last}`,
      apply: (p) => `${p.first[0]}${p.last}@${domain}`,
    },
    {
      // first_last@domain
      test: (l, p) => l === `${p.first}_${p.last}`,
      apply: (p) => `${p.first}_${p.last}@${domain}`,
    },
    {
      // first@domain
      test: (l, p) => l === p.first,
      apply: (p) => `${p.first}@${domain}`,
    },
  ];

  const threshold = Math.ceil(domainSamples.length * 0.5);

  for (const cand of candidates) {
    const hits = domainSamples.filter((s) => cand.test(s.local, s.p)).length;
    if (hits >= threshold) {
      return { apply: cand.apply, domain };
    }
  }

  return null;
}

// ── College name resolution ───────────────────────────────────────────────────

/**
 * Returns a list of search terms to try when matching a university name
 * against the student_records.college column.  Ordered from most to least
 * specific so we stop at the first match.
 */
function getCollegeSearchTerms(university: string): string[] {
  const terms: string[] = [university]; // exact match first

  // IIT / NIT / IIIT: try both short and long form
  const iitMatch = university.match(/^(IIT|NIT|IIIT)\s+(.+)$/i);
  if (iitMatch) {
    const [, abbr, city] = iitMatch;
    const fullForms: Record<string, string> = {
      IIT: "Indian Institute of Technology",
      NIT: "National Institute of Technology",
      IIIT: "International Institute of Information Technology",
    };
    const full = fullForms[abbr.toUpperCase()];
    if (full) {
      terms.push(`${full} ${city}`);
      terms.push(city); // fallback: just the city (e.g. "Bombay")
    }
  }

  // IIM
  const iimMatch = university.match(/^IIM\s+(.+)$/i);
  if (iimMatch) {
    terms.push(`Indian Institute of Management ${iimMatch[1]}`);
  }

  // BITS Pilani
  if (/^BITS\s+Pilani$/i.test(university)) {
    terms.push("Birla Institute of Technology");
    terms.push("BITS");
  }

  // ISB
  if (/ISB/i.test(university)) {
    terms.push("Indian School of Business");
  }

  // XLRI
  if (/XLRI/i.test(university)) {
    terms.push("XLRI");
  }

  return [...new Set(terms)];
}

/**
 * Query student_records for direct name+college matches, trying progressively
 * looser college matching until a result is found.
 * Returns the rows and the actual college string that matched (for caching).
 */
async function findDirectMatch(
  supabase: SupabaseClient<any>,
  fullName: string,
  university: string,
  limit = 3,
): Promise<{ rows: any[]; matchedCollege: string | null }> {
  const terms = getCollegeSearchTerms(university);

  for (const term of terms) {
    const { data } = await supabase
      .from("student_records")
      .select("name, college, email_1, email_2")
      .ilike("name", `%${fullName.trim()}%`)
      .ilike("college", `%${term}%`)
      .limit(limit);

    if (data?.length) {
      return { rows: data, matchedCollege: data[0].college as string };
    }
  }

  return { rows: [], matchedCollege: null };
}

/**
 * Sample student_records rows for the same college to infer the email pattern.
 * Returns the pattern and the actual matched college name for caching.
 */
async function findCollegePattern(
  supabase: SupabaseClient<any>,
  university: string,
): Promise<{ pattern: PatternResult | null; matchedCollege: string | null }> {
  const terms = getCollegeSearchTerms(university);

  for (const term of terms) {
    const { data } = await supabase
      .from("student_records")
      .select("name, email_1, college")
      .ilike("college", `%${term}%`)
      .not("email_1", "is", null)
      .limit(15);

    if (data?.length) {
      const samplePairs = data
        .filter((s: any) => s.name && s.email_1)
        .map((s: any) => ({ name: s.name as string, email: s.email_1 as string }));
      const matchedCollege = data[0].college as string;
      return { pattern: detectEmailPattern(samplePairs), matchedCollege };
    }
  }

  return { pattern: null, matchedCollege: null };
}

// ── GitHub search ─────────────────────────────────────────────────────────────

/** Rate-limited flag — set true within a single enrichment run when we hit the limit. */
let githubRateLimitedThisRun = false;

async function searchGitHub(
  fullName: string,
  university: string,
): Promise<string | null> {
  if (githubRateLimitedThisRun) return null;

  const token = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "FlytBase-TalentRadar/1.0",
  };
  if (token) headers.Authorization = `token ${token}`;

  // Strip "IIT" abbreviations: "IIT Bombay" → "IIT Bombay" stays, good enough.
  const query = `${fullName} ${university}`;

  const res = await fetch(
    `https://api.github.com/search/users?q=${encodeURIComponent(query)}&per_page=5`,
    { headers },
  );

  // Handle rate limit
  const remaining = res.headers.get("x-ratelimit-remaining");
  if (remaining !== null && Number(remaining) <= 1) {
    githubRateLimitedThisRun = true;
  }

  if (res.status === 403 || res.status === 429) {
    githubRateLimitedThisRun = true;
    return null;
  }

  if (!res.ok) return null;

  const data = (await res.json()) as {
    total_count: number;
    items: Array<{ login: string; name?: string | null }>;
  };

  // If too many results, match is ambiguous — skip
  if (!data.items?.length || data.total_count > 10) return null;

  const nameParts = normalizeNameParts(fullName);
  const topResult = data.items[0];
  const loginLower = topResult.login.toLowerCase();
  const resultNameLower = (topResult.name ?? "").toLowerCase();

  // Verify the result plausibly matches the candidate
  const matchesFirst =
    loginLower.includes(nameParts.first) ||
    resultNameLower.includes(nameParts.first);
  const matchesLast =
    loginLower.includes(nameParts.last) ||
    resultNameLower.includes(nameParts.last);

  if (matchesFirst || matchesLast) {
    return `https://github.com/${topResult.login}`;
  }

  return null;
}

// ── Main enrichment ───────────────────────────────────────────────────────────

export interface EnrichResult {
  processed: number;
  emailEnriched: number;
  githubFound: number;
  skipped: number;
  errors: number;
  githubRateLimited: boolean;
}

/**
 * Enriches student candidates that are missing an email address.
 *
 * For each unenriched candidate:
 *  1. Looks up their name + college in the `student_records` table.
 *     - Exact match → uses stored email directly.
 *     - No match → samples other records from the same college and infers
 *       the email from the dominant pattern (e.g. first.last@iit.ac.in).
 *  2. Searches the GitHub API to find a matching profile URL.
 *
 * All findings are written back to the `candidates` table.
 */
export async function enrichStudentCandidates(
  // SupabaseClient<any> so student_records (not in the generated types) works fine
  supabase: SupabaseClient<any>,
  {
    limit = 100,
    skipGithub = false,
  }: { limit?: number; skipGithub?: boolean } = {},
): Promise<EnrichResult> {
  githubRateLimitedThisRun = false;

  // Fetch candidates without an email that haven't been attempted yet.
  // email_confidence = null  → not yet tried
  // email_confidence = "inferred" → already enriched (has email)
  // email_confidence = "attempted" → tried and failed; skip to avoid infinite loops
  const { data: candidates, error: fetchError } = await supabase
    .from("candidates")
    .select("id, full_name, university, linkedin_url, email, github_url")
    .is("email", null)
    .is("email_confidence", null)
    .limit(limit);

  if (fetchError) throw fetchError;
  if (!candidates?.length) {
    return {
      processed: 0,
      emailEnriched: 0,
      githubFound: 0,
      skipped: 0,
      errors: 0,
      githubRateLimited: false,
    };
  }

  let emailEnriched = 0;
  let githubFound = 0;
  let skipped = 0;
  let errors = 0;

  // Cache college → email pattern so we only sample each college once
  const collegePatternCache = new Map<string, PatternResult | null>();

  const GITHUB_DELAY_MS = 250; // stay well inside GitHub's rate limit

  for (const candidate of candidates as Array<{
    id: string;
    full_name: string;
    university: string;
    linkedin_url: string | null;
    email: string | null;
    github_url: string | null;
  }>) {
    try {
      const update: Partial<{
        email: string;
        email_confidence: "inferred" | "github_profile" | "github_commit";
        github_url: string;
      }> = {};

      // ── Email enrichment ──────────────────────────────────────────────────

      // Step 1: direct name match via fuzzy college matching
      const { rows: directRows, matchedCollege } = await findDirectMatch(
        supabase,
        candidate.full_name,
        candidate.university,
      );

      const directHit = directRows.find(
        (m: { email_1?: string | null; email_2?: string | null }) =>
          m.email_1 || m.email_2,
      );

      if (directHit) {
        update.email = (directHit.email_1 || directHit.email_2) as string;
        update.email_confidence = "inferred";
        emailEnriched++;
      } else {
        // Step 2: infer email from the college's email pattern.
        // Cache key = matched college name (or university if no match found yet).
        const cacheKey = matchedCollege ?? candidate.university;
        let pattern = collegePatternCache.get(cacheKey);

        if (pattern === undefined) {
          const { pattern: p, matchedCollege: mc } = await findCollegePattern(
            supabase,
            candidate.university,
          );
          pattern = p;
          // Cache under both the matched name and the candidate.university alias
          const finalKey = mc ?? candidate.university;
          collegePatternCache.set(finalKey, pattern);
          if (mc && mc !== candidate.university) {
            collegePatternCache.set(candidate.university, pattern);
          }
        }

        if (pattern) {
          const nameParts = normalizeNameParts(candidate.full_name);
          if (nameParts.first && nameParts.last) {
            update.email = pattern.apply(nameParts);
            update.email_confidence = "inferred";
            emailEnriched++;
          }
        }
      }

      // ── GitHub enrichment ─────────────────────────────────────────────────

      if (!candidate.github_url && !skipGithub && !githubRateLimitedThisRun) {
        await new Promise((res) => setTimeout(res, GITHUB_DELAY_MS));
        const ghUrl = await searchGitHub(
          candidate.full_name,
          candidate.university,
        );
        if (ghUrl) {
          update.github_url = ghUrl;
          githubFound++;
        }
      }

      // ── Write back ────────────────────────────────────────────────────────

      if (Object.keys(update).length > 0) {
        const { error: updateError } = await supabase
          .from("candidates")
          .update(update)
          .eq("id", candidate.id);

        if (updateError) {
          console.error(
            `[enrich] Failed to update candidate ${candidate.id}:`,
            updateError.message,
          );
          errors++;
        }
      } else {
        // Nothing found — mark as attempted so this candidate is not repeatedly
        // re-processed on every enrichment run (email_confidence stays null = not tried).
        const { error: markErr } = await supabase
          .from("candidates")
          .update({ email_confidence: "attempted" })
          .eq("id", candidate.id);
        if (markErr) {
          console.warn(`[enrich] Failed to mark candidate ${candidate.id} as attempted:`, markErr.message);
        }
        skipped++;
      }
    } catch (err) {
      console.error(
        `[enrich] Unhandled error for candidate ${candidate.id}:`,
        err,
      );
      errors++;
    }
  }

  return {
    processed: candidates.length,
    emailEnriched,
    githubFound,
    skipped,
    errors,
    githubRateLimited: githubRateLimitedThisRun,
  };
}
