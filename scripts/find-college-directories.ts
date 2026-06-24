/**
 * find-college-directories.ts
 *
 * Uses Apify's google-search-scraper (same actor as the experienced pipeline)
 * to discover publicly accessible student directory / roll-list URLs for each
 * target college. Outputs a JSON report to:
 *   scripts/college-directories-output.json
 *
 * Run:
 *   npx tsx scripts/find-college-directories.ts
 *
 * BITS Pilani (Goa + Hyd) are already in the DB — not listed here.
 */

import "dotenv/config";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const APIFY_BASE = "https://api.apify.com/v2";
const APIFY_ACTOR = "apify~google-search-scraper";

// ---------------------------------------------------------------------------
// College definitions
// ---------------------------------------------------------------------------

type CollegeType = "engineering" | "mba";

interface College {
  name: string;
  shortName: string;
  domain: string;
  type: CollegeType;
}

const COLLEGES: College[] = [
  // ── Top 10 IITs ────────────────────────────────────────────────────────────
  { name: "IIT Bombay",      shortName: "IITB",   domain: "iitb.ac.in",    type: "engineering" },
  { name: "IIT Delhi",       shortName: "IITD",   domain: "iitd.ac.in",    type: "engineering" },
  { name: "IIT Madras",      shortName: "IITM",   domain: "iitm.ac.in",    type: "engineering" },
  { name: "IIT Kharagpur",   shortName: "IITKGP", domain: "iitkgp.ac.in",  type: "engineering" },
  { name: "IIT Kanpur",      shortName: "IITK",   domain: "iitk.ac.in",    type: "engineering" },
  { name: "IIT Roorkee",     shortName: "IITR",   domain: "iitr.ac.in",    type: "engineering" },
  { name: "IIT Guwahati",    shortName: "IITG",   domain: "iitg.ac.in",    type: "engineering" },
  { name: "IIT Hyderabad",   shortName: "IITH",   domain: "iith.ac.in",    type: "engineering" },
  { name: "IIT BHU",         shortName: "IITBHU", domain: "iitbhu.ac.in",  type: "engineering" },
  { name: "IIT Indore",      shortName: "IITI",   domain: "iiti.ac.in",    type: "engineering" },

  // ── Top 5 NITs ─────────────────────────────────────────────────────────────
  { name: "NIT Trichy",      shortName: "NITT",   domain: "nitt.edu",      type: "engineering" },
  { name: "NIT Warangal",    shortName: "NITW",   domain: "nitw.ac.in",    type: "engineering" },
  { name: "NIT Surathkal",   shortName: "NITK",   domain: "nitk.edu.in",   type: "engineering" },
  { name: "NIT Calicut",     shortName: "NITC",   domain: "nitc.ac.in",    type: "engineering" },
  { name: "NIT Rourkela",    shortName: "NITR",   domain: "nitrkl.ac.in",  type: "engineering" },

  // ── IIITs ──────────────────────────────────────────────────────────────────
  { name: "IIIT Hyderabad",  shortName: "IIITH",  domain: "iiit.ac.in",    type: "engineering" },
  { name: "IIIT Bangalore",  shortName: "IIITB",  domain: "iiitb.ac.in",   type: "engineering" },

  // ── Top 6 IIMs ─────────────────────────────────────────────────────────────
  { name: "IIM Ahmedabad",   shortName: "IIMA",   domain: "iima.ac.in",    type: "mba" },
  { name: "IIM Bangalore",   shortName: "IIMB",   domain: "iimb.ac.in",    type: "mba" },
  { name: "IIM Calcutta",    shortName: "IIMC",   domain: "iimcal.ac.in",  type: "mba" },
  { name: "IIM Lucknow",     shortName: "IIML",   domain: "iiml.ac.in",    type: "mba" },
  { name: "IIM Kozhikode",   shortName: "IIMK",   domain: "iimk.ac.in",    type: "mba" },
  { name: "IIM Indore",      shortName: "IIMI",   domain: "iimidr.ac.in",  type: "mba" },

  // ── Other MBA ──────────────────────────────────────────────────────────────
  { name: "XLRI Jamshedpur", shortName: "XLRI",   domain: "xlri.ac.in",    type: "mba" },
  { name: "MDI Gurgaon",     shortName: "MDI",    domain: "mdi.ac.in",     type: "mba" },
  { name: "ISB Hyderabad",   shortName: "ISB",    domain: "isb.edu",       type: "mba" },

  // ── Pune colleges ──────────────────────────────────────────────────────────
  { name: "COEP Pune",       shortName: "COEP",   domain: "coep.ac.in",    type: "engineering" },
  { name: "PICT Pune",       shortName: "PICT",   domain: "pict.edu",      type: "engineering" },
];

// ---------------------------------------------------------------------------
// Search query templates per college type
// ---------------------------------------------------------------------------

function buildQueries(college: College): string[] {
  if (college.type === "engineering") {
    return [
      // On-site PDF roll list
      `site:${college.domain} filetype:pdf student roll list OR "division wise" OR "branch wise" 2024`,
      // On-site HTML student list page
      `site:${college.domain} student list OR "roll list" OR "student directory" undergraduate`,
      // Web-wide PDF search
      `"${college.name}" student roll list filetype:pdf 2024 OR 2023`,
    ];
  } else {
    return [
      // On-site student directory
      `site:${college.domain} student directory OR "student list" OR "batch" 2024 OR 2025`,
      // Placement brochure PDF
      `"${college.name}" placement brochure student profiles 2024 OR 2025 filetype:pdf`,
      // Batch directory web-wide
      `"${college.name}" "student council" OR "student committee" 2024 site:${college.domain}`,
    ];
  }
}

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

interface FoundURL {
  url: string;
  title: string;
  description: string;
  query: string;
  isPdf: boolean;
  confidence: "high" | "medium" | "low";
}

interface CollegeResult {
  college: string;
  shortName: string;
  domain: string;
  type: CollegeType;
  urls: FoundURL[];
  errors: string[];
}

// ---------------------------------------------------------------------------
// URL confidence heuristics
// ---------------------------------------------------------------------------

const HIGH_PATTERNS = [
  /roll.?list/i, /student.?list/i, /student.?directory/i,
  /division.?wise/i, /branch.?wise/i, /ug.?list/i,
  /placement.?brochure/i, /student.?roll/i, /rolllist/i,
];

const LOW_PATTERNS = [
  /admission/i, /fee/i, /hostel/i, /exam/i, /result/i,
  /notification/i, /tender/i, /recruitment/i, /timetable/i,
];

function scoreUrl(url: string, title: string, desc: string): "high" | "medium" | "low" {
  const text = `${url} ${title} ${desc}`.toLowerCase();
  if (LOW_PATTERNS.some(p => p.test(text))) return "low";
  if (HIGH_PATTERNS.some(p => p.test(text))) return "high";
  return "medium";
}

// ---------------------------------------------------------------------------
// Apify helpers (mirrors experienced.functions.ts pattern)
// ---------------------------------------------------------------------------

interface ApifySearchResult {
  url?: string;
  title?: string;
  description?: string;
}

async function runGoogleSearch(token: string, queries: string[]): Promise<ApifySearchResult[]> {
  const body = {
    queries: queries.join("\n"),
    maxPagesPerQuery: 1, // 10 results per query
    countryCode: "in",
    languageCode: "en",
  };

  const runRes = await fetch(
    `${APIFY_BASE}/acts/${APIFY_ACTOR}/runs?token=${token}&timeoutSecs=120`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
  );
  if (!runRes.ok) {
    const text = await runRes.text().catch(() => runRes.statusText);
    throw new Error(`Apify start failed ${runRes.status}: ${text}`);
  }
  const runResp = await runRes.json() as { data?: { id?: string } };
  const runId = runResp?.data?.id;
  if (!runId) throw new Error("Apify did not return a run ID");

  // Poll until done (max 3 minutes)
  const deadline = Date.now() + 3 * 60 * 1000;
  let status = "RUNNING";
  while (status === "READY" || status === "RUNNING") {
    if (Date.now() >= deadline) {
      console.warn("  [Apify] timeout — fetching partial results");
      break;
    }
    await sleep(4_000);
    const sr = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${token}`);
    const sd = await sr.json() as { data?: { status?: string } };
    status = sd?.data?.status ?? "FAILED";
  }
  if (status === "FAILED" || status === "ABORTED") {
    throw new Error(`Apify run ${runId} ended with status: ${status}`);
  }

  // Fetch dataset
  const dr = await fetch(
    `${APIFY_BASE}/actor-runs/${runId}/dataset/items?token=${token}&format=json&clean=true`,
  );
  if (!dr.ok) throw new Error(`Dataset fetch failed: ${dr.status}`);
  const items = await dr.json() as Array<{ organicResults?: ApifySearchResult[] }>;

  // Flatten all organic results
  const results: ApifySearchResult[] = [];
  for (const page of items) {
    for (const r of page.organicResults ?? []) {
      if (r.url) results.push(r);
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function findDirectoriesForCollege(
  college: College,
  token: string,
): Promise<CollegeResult> {
  const result: CollegeResult = {
    college: college.name,
    shortName: college.shortName,
    domain: college.domain,
    type: college.type,
    urls: [],
    errors: [],
  };

  const queries = buildQueries(college);
  const seenUrls = new Set<string>();

  console.log(`  [${college.shortName}] Running ${queries.length} Google searches via Apify…`);

  try {
    const items = await runGoogleSearch(token, queries);

    for (const item of items) {
      const url = item.url;
      if (!url || seenUrls.has(url)) continue;
      seenUrls.add(url);

      const title = item.title ?? "";
      const description = item.description ?? "";
      const isPdf = /\.pdf(\?|$)/i.test(url);
      // Find which query this came from (best effort — Apify doesn't tag results per query)
      const confidence = scoreUrl(url, title, description);

      result.urls.push({ url, title, description, query: "batch", isPdf, confidence });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`  [${college.shortName}] Failed: ${msg}`);
    result.errors.push(msg);
  }

  // Sort: high confidence first, then PDFs
  result.urls.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    if (order[a.confidence] !== order[b.confidence])
      return order[a.confidence] - order[b.confidence];
    if (a.isPdf !== b.isPdf) return a.isPdf ? -1 : 1;
    return a.url.localeCompare(b.url);
  });

  const highCount = result.urls.filter(u => u.confidence === "high").length;
  const pdfCount = result.urls.filter(u => u.isPdf).length;
  console.log(
    `  [${college.shortName}] Done — ${result.urls.length} URLs` +
    ` (${highCount} high-confidence, ${pdfCount} PDFs)`,
  );

  return result;
}

async function main() {
  const token = process.env.APIFY_API_KEY ?? process.env.APIFY_TOKEN;
  if (!token) throw new Error("Missing APIFY_API_KEY in .env");

  console.log(`\nFinding student directories for ${COLLEGES.length} colleges via Apify Google Search…\n`);
  console.log("Note: Each college runs 3 queries in a single Apify call (~30–60s per college).\n");

  const allResults: CollegeResult[] = [];

  for (const college of COLLEGES) {
    console.log(`\n▸ ${college.name} (${college.domain})`);
    const result = await findDirectoriesForCollege(college, token);
    allResults.push(result);
    // Brief pause between colleges to be polite
    await sleep(2_000);
  }

  // Write JSON output
  const outputPath = join(__dirname, "college-directories-output.json");
  writeFileSync(outputPath, JSON.stringify(allResults, null, 2), "utf-8");

  // Print summary
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("SUMMARY");
  console.log("═══════════════════════════════════════════════════════");

  for (const r of allResults) {
    const high   = r.urls.filter(u => u.confidence === "high").length;
    const medium = r.urls.filter(u => u.confidence === "medium").length;
    const pdfs   = r.urls.filter(u => u.isPdf).length;
    const status = high > 0 ? "✓" : medium > 0 ? "~" : "✗";
    console.log(
      `${status} ${r.college.padEnd(22)}` +
      ` ${String(high).padStart(2)} high` +
      `  ${String(medium).padStart(2)} medium` +
      `  ${String(pdfs).padStart(2)} PDFs` +
      (r.errors.length ? `  ⚠ ${r.errors.length} error(s)` : ""),
    );
  }

  const totalHigh = allResults.reduce((s, r) => s + r.urls.filter(u => u.confidence === "high").length, 0);
  const totalPdfs = allResults.reduce((s, r) => s + r.urls.filter(u => u.isPdf).length, 0);
  console.log("\n───────────────────────────────────────────────────────");
  console.log(`Total high-confidence URLs : ${totalHigh}`);
  console.log(`Total PDF URLs             : ${totalPdfs}`);
  console.log(`\nFull results → ${outputPath}`);
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
