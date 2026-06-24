/**
 * parse-college-directories.ts
 *
 * Reads college-directories-output.json, fetches each high-confidence PDF,
 * sends it to Claude Haiku (native PDF support) to extract student names and
 * roll numbers, derives institutional emails, and upserts into Supabase.
 *
 * Run:
 *   npx tsx scripts/parse-college-directories.ts
 *
 * Options (env vars):
 *   CONFIDENCE=medium   also include medium-confidence URLs (default: high only)
 *   DRY_RUN=1           print what would be inserted, skip Supabase writes
 *   COLLEGE=IITB        only process one college (by shortName)
 */

import "dotenv/config";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import * as https from "https";
import * as http from "http";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { extractText } from "unpdf";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DRY_RUN = process.env.DRY_RUN === "1";
const MIN_CONFIDENCE = (process.env.CONFIDENCE ?? "high") as "high" | "medium";
const ONLY_COLLEGE = process.env.COLLEGE ?? "";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// ---------------------------------------------------------------------------
// College metadata: university name (as stored in DB) + email pattern
// ---------------------------------------------------------------------------

interface CollegeMeta {
  universityName: string;         // value stored in candidates.university
  defaultDegree: string;          // 'B.Tech' | 'B.E.' | 'MBA' etc.
  emailDomain: string;            // used to derive email from roll number
  emailPattern: "roll@domain" | "firstname.lastname@domain" | "none";
}

const COLLEGE_META: Record<string, CollegeMeta> = {
  IITB:   { universityName: "IIT Bombay",      defaultDegree: "B.Tech", emailDomain: "iitb.ac.in",           emailPattern: "roll@domain" },
  IITD:   { universityName: "IIT Delhi",        defaultDegree: "B.Tech", emailDomain: "iitd.ac.in",           emailPattern: "roll@domain" },
  IITM:   { universityName: "IIT Madras",       defaultDegree: "B.Tech", emailDomain: "smail.iitm.ac.in",     emailPattern: "roll@domain" },
  IITKGP: { universityName: "IIT Kharagpur",    defaultDegree: "B.Tech", emailDomain: "kgpian.iitkgp.ac.in",  emailPattern: "roll@domain" },
  IITK:   { universityName: "IIT Kanpur",       defaultDegree: "B.Tech", emailDomain: "iitk.ac.in",           emailPattern: "roll@domain" },
  IITR:   { universityName: "IIT Roorkee",      defaultDegree: "B.Tech", emailDomain: "iitr.ac.in",           emailPattern: "roll@domain" },
  IITG:   { universityName: "IIT Guwahati",     defaultDegree: "B.Tech", emailDomain: "iitg.ac.in",           emailPattern: "roll@domain" },
  IITH:   { universityName: "IIT Hyderabad",    defaultDegree: "B.Tech", emailDomain: "student.iith.ac.in",   emailPattern: "roll@domain" },
  IITBHU: { universityName: "IIT BHU",          defaultDegree: "B.Tech", emailDomain: "itbhu.ac.in",          emailPattern: "roll@domain" },
  IITI:   { universityName: "IIT Indore",       defaultDegree: "B.Tech", emailDomain: "iiti.ac.in",           emailPattern: "roll@domain" },
  NITT:   { universityName: "NIT Trichy",       defaultDegree: "B.Tech", emailDomain: "student.nitt.edu",     emailPattern: "roll@domain" },
  NITW:   { universityName: "NIT Warangal",     defaultDegree: "B.Tech", emailDomain: "student.nitw.ac.in",   emailPattern: "roll@domain" },
  NITK:   { universityName: "NIT Surathkal",    defaultDegree: "B.Tech", emailDomain: "nitk.edu.in",          emailPattern: "roll@domain" },
  NITC:   { universityName: "NIT Calicut",      defaultDegree: "B.Tech", emailDomain: "nitc.ac.in",           emailPattern: "roll@domain" },
  NITR:   { universityName: "NIT Rourkela",     defaultDegree: "B.Tech", emailDomain: "nitrkl.ac.in",         emailPattern: "roll@domain" },
  IIITH:  { universityName: "IIIT Hyderabad",   defaultDegree: "B.Tech", emailDomain: "students.iiit.ac.in",  emailPattern: "roll@domain" },
  IIITB:  { universityName: "IIIT Bangalore",   defaultDegree: "B.Tech", emailDomain: "iiitb.ac.in",          emailPattern: "roll@domain" },
  IIMA:   { universityName: "IIM Ahmedabad",    defaultDegree: "MBA",    emailDomain: "iima.ac.in",           emailPattern: "firstname.lastname@domain" },
  IIMB:   { universityName: "IIM Bangalore",    defaultDegree: "MBA",    emailDomain: "iimb.ac.in",           emailPattern: "firstname.lastname@domain" },
  IIMC:   { universityName: "IIM Calcutta",     defaultDegree: "MBA",    emailDomain: "email.iimcal.ac.in",   emailPattern: "firstname.lastname@domain" },
  IIML:   { universityName: "IIM Lucknow",      defaultDegree: "MBA",    emailDomain: "iiml.ac.in",           emailPattern: "firstname.lastname@domain" },
  IIMK:   { universityName: "IIM Kozhikode",    defaultDegree: "MBA",    emailDomain: "iimk.ac.in",           emailPattern: "firstname.lastname@domain" },
  IIMI:   { universityName: "IIM Indore",       defaultDegree: "MBA",    emailDomain: "iimidr.ac.in",         emailPattern: "firstname.lastname@domain" },
  XLRI:   { universityName: "XLRI Jamshedpur",  defaultDegree: "MBA",    emailDomain: "xlri.ac.in",           emailPattern: "firstname.lastname@domain" },
  MDI:    { universityName: "MDI Gurgaon",      defaultDegree: "MBA",    emailDomain: "mdi.ac.in",            emailPattern: "firstname.lastname@domain" },
  ISB:    { universityName: "ISB Hyderabad",    defaultDegree: "MBA",    emailDomain: "isb.edu",              emailPattern: "firstname.lastname@domain" },
  COEP:   { universityName: "COEP Pune",        defaultDegree: "B.E.",   emailDomain: "coep.ac.in",           emailPattern: "roll@domain" },
  PICT:   { universityName: "PICT Pune",        defaultDegree: "B.E.",   emailDomain: "pict.edu",             emailPattern: "roll@domain" },
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CollegeResult {
  college: string;
  shortName: string;
  domain: string;
  type: "engineering" | "mba";
  urls: Array<{
    url: string;
    title: string;
    description: string;
    isPdf: boolean;
    confidence: "high" | "medium" | "low";
  }>;
  errors: string[];
}

interface ExtractedStudent {
  name: string;
  roll_no?: string;
  branch?: string;
  year?: number;       // graduation year
  email?: string;      // if the PDF already contains it
}

interface CandidateRow {
  full_name: string;
  university: string;
  degree: string;
  branch: string;
  graduation_year: number;
  email: string | null;
  email_confidence: "inferred" | null;
  source: "manual";
}

// ---------------------------------------------------------------------------
// Email derivation
// ---------------------------------------------------------------------------

function deriveEmail(
  student: ExtractedStudent,
  meta: CollegeMeta,
): { email: string | null; confidence: "inferred" | null } {
  if (student.email) return { email: student.email.toLowerCase(), confidence: "inferred" };

  if (meta.emailPattern === "roll@domain" && student.roll_no) {
    const roll = student.roll_no.toLowerCase().replace(/\s+/g, "");
    return { email: `${roll}@${meta.emailDomain}`, confidence: "inferred" };
  }

  if (meta.emailPattern === "firstname.lastname@domain" && student.name) {
    const parts = student.name.trim().toLowerCase().split(/\s+/);
    if (parts.length >= 2) {
      const first = parts[0].replace(/[^a-z]/g, "");
      const last = parts[parts.length - 1].replace(/[^a-z]/g, "");
      if (first && last) {
        return { email: `${first}.${last}@${meta.emailDomain}`, confidence: "inferred" };
      }
    }
  }

  return { email: null, confidence: null };
}

// ---------------------------------------------------------------------------
// PDF fetch (with browser-like headers + Node https fallback)
// ---------------------------------------------------------------------------

async function fetchPdf(url: string): Promise<Buffer> {
  const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Accept": "application/pdf,*/*;q=0.9",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": `https://${new URL(url).hostname}/`,
  };

  // Try native fetch first
  try {
    const res = await fetch(url, {
      headers: HEADERS,
      redirect: "follow",
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  } catch (firstErr) {
    // Fallback: Node https/http module (handles some TLS quirks native fetch can't)
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const lib = parsed.protocol === "https:" ? https : http;
      const req = lib.get(url, { headers: HEADERS, timeout: 45_000 }, res => {
        // Handle redirects manually (up to 5 hops)
        if (res.statusCode && [301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          fetchPdf(res.headers.location).then(resolve).catch(reject);
          return;
        }
        if (!res.statusCode || res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        const chunks: Buffer[] = [];
        res.on("data", c => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", reject);
      });
      req.on("error", () => reject(firstErr)); // surface the original error
      req.on("timeout", () => { req.destroy(); reject(new Error("Timeout")); });
    });
  }
}

// ---------------------------------------------------------------------------
// Extraction strategies
// ---------------------------------------------------------------------------

/**
 * ENGINEERING COLLEGES — regex-based (free, instant, no truncation).
 *
 * Roll list PDFs from IITs/NITs always follow one of these patterns per line:
 *   23B0001  DIVYA NAYAN MEHTA          AE
 *   2023ME10001  Some Name              CS
 *   ED23B001  Another Name
 *
 * We anchor on the roll number (the most reliable token) and capture the
 * name that follows it on the same line.
 */

// Covers: IIT (23B0001, 22D1234, 21CS0001), NIT (120CS0001, 20UGCS001), etc.
const ROLL_PATTERN = /\b([A-Z0-9]{2,4}\d{3,6}|(?:20|21|22|23|24|25)\d{2}[A-Z]{2,4}\d{3,6})\b/i;

// Branch codes/names to recognise
const BRANCH_PATTERN = /\b(AE|CS|CE|EE|ME|CH|BT|MA|PH|HS|EP|ES|MM|MN|MT|NA|CY|AI|DS|ECE|CSE|EEE|IT|VLSI|MBA|MCA|Civil|Mechanical|Electrical|Computer|Chemical|Aerospace|Materials)\b/i;

function extractEngineeringStudents(text: string): ExtractedStudent[] {
  const students: ExtractedStudent[] = [];
  const seen = new Set<string>();

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length < 5) continue;

    const rollMatch = trimmed.match(ROLL_PATTERN);
    if (!rollMatch) continue;

    const roll = rollMatch[1].toUpperCase();
    if (seen.has(roll)) continue;

    // Everything after the roll number on the same line
    const afterRoll = trimmed.slice(trimmed.indexOf(rollMatch[0]) + rollMatch[0].length).trim();

    // Name: grab the leading run of letters/spaces/dots (stop at 2+ spaces or tab or digit run)
    const nameMatch = afterRoll.match(/^([A-Za-z][A-Za-z\s.']{2,50?})(?:\s{2,}|\t|\d|$)/);
    if (!nameMatch) continue;

    const name = nameMatch[1].trim().replace(/\s+/g, " ");
    if (name.length < 3) continue;

    // Branch: look in the remainder of the line after the name
    const afterName = afterRoll.slice(nameMatch[0].length).trim();
    const branchMatch = (afterName || trimmed).match(BRANCH_PATTERN);

    seen.add(roll);
    students.push({
      name,
      roll_no: roll,
      branch: branchMatch?.[1] ?? undefined,
    });
  }

  return students;
}

/**
 * MBA COLLEGES — Claude Haiku with a single call (directories are small,
 * typically < 500 names and fit comfortably in one request).
 */
const MBA_PROMPT = `List every student name you can find in this text.
Return a JSON array of objects: [{"name":"Full Name","roll_no":"if present","email":"if present"}]
Only names — no descriptions. Return [] if none found.
No markdown, no code fences, just the JSON array.`;

async function extractMbaStudents(text: string): Promise<ExtractedStudent[]> {
  // Trim to 30k chars — MBA directories are small; if larger, take first 30k
  const input = text.length > 30_000 ? text.slice(0, 30_000) : text;

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    messages: [{ role: "user", content: `${MBA_PROMPT}\n\n---\n${input}` }],
  });

  const raw = response.content.find(b => b.type === "text")?.text?.trim() ?? "[]";
  let cleaned = raw.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
  if (!cleaned.startsWith("[")) {
    const s = cleaned.indexOf("["), e = cleaned.lastIndexOf("]");
    cleaned = (s !== -1 && e > s) ? cleaned.slice(s, e + 1) : "[]";
  }
  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed)
      ? parsed.filter((s: unknown) => typeof (s as ExtractedStudent).name === "string" && (s as ExtractedStudent).name.trim().length > 1)
      : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Main PDF extraction dispatcher
// ---------------------------------------------------------------------------

async function extractStudentsFromPdf(
  pdfBuffer: Buffer,
  collegeType: "engineering" | "mba",
): Promise<ExtractedStudent[]> {
  // Extract raw text with unpdf
  let text: string;
  let numPages: number;
  try {
    const result = await extractText(new Uint8Array(pdfBuffer), { mergePages: true });
    const pages = result.text;
    text = Array.isArray(pages) ? pages.join("\n") : pages;
    numPages = result.totalPages ?? 0;
  } catch (err) {
    throw new Error(`PDF text extraction failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!text.trim()) throw new Error("PDF has no extractable text (scanned image?)");

  console.log(`    📑 ${numPages} pages, ${(text.length / 1000).toFixed(0)}k chars`);

  // Debug: print first 800 chars so we can see the actual text structure
  console.log("    ── TEXT SAMPLE (first 800 chars) ──");
  console.log(text.slice(0, 800).replace(/\n/g, "↵\n"));
  console.log("    ────────────────────────────────────");

  if (collegeType === "engineering") {
    const students = extractEngineeringStudents(text);
    console.log(`    ✦ ${students.length} students via regex`);
    return students;
  } else {
    console.log(`    ✦ sending to Claude Haiku…`);
    const students = await extractMbaStudents(text);
    console.log(`    ✦ ${students.length} students via Claude`);
    return students;
  }
}

// ---------------------------------------------------------------------------
// Supabase dedup + insert
// ---------------------------------------------------------------------------

async function fetchExistingKeys(university: string): Promise<{
  emails: Set<string>;
  nameKeys: Set<string>;
}> {
  const { data } = await supabase
    .from("candidates")
    .select("email, full_name")
    .eq("university", university);

  const emails = new Set<string>();
  const nameKeys = new Set<string>();
  for (const row of data ?? []) {
    if (row.email) emails.add(row.email.toLowerCase());
    if (row.full_name) nameKeys.add(normalizeNameKey(row.full_name));
  }
  return { emails, nameKeys };
}

function normalizeNameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

async function insertCandidates(rows: CandidateRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  const BATCH = 100;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error, count } = await supabase
      .from("candidates")
      .insert(batch, { count: "exact" });
    if (error) {
      console.warn(`    ⚠ Insert error: ${error.message}`);
    } else {
      inserted += count ?? batch.length;
    }
  }
  return inserted;
}

// ---------------------------------------------------------------------------
// Per-URL processing
// ---------------------------------------------------------------------------

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function processUrl(
  url: string,
  meta: CollegeMeta,
  collegeType: "engineering" | "mba",
  existing: { emails: Set<string>; nameKeys: Set<string> },
): Promise<CandidateRow[]> {
  // Fetch the PDF
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await fetchPdf(url);
  } catch (err) {
    throw new Error(`Fetch failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  const fileSizeMb = pdfBuffer.byteLength / 1024 / 1024;
  console.log(`    📄 ${fileSizeMb.toFixed(1)} MB`);

  if (fileSizeMb > 50) {
    throw new Error(`PDF too large (${fileSizeMb.toFixed(1)} MB) — skipping`);
  }

  const students = await extractStudentsFromPdf(pdfBuffer, collegeType);
  console.log(`    ✦ ${students.length} students extracted`);

  const rows: CandidateRow[] = [];
  const currentYear = new Date().getFullYear();

  for (const student of students) {
    if (!student.name?.trim()) continue;
    const nameKey = normalizeNameKey(student.name);
    if (existing.nameKeys.has(nameKey)) continue; // already in DB

    const { email, confidence } = deriveEmail(student, meta);
    if (email && existing.emails.has(email.toLowerCase())) continue; // dup email

    // Infer a plausible graduation year if missing
    const gradYear = student.year && student.year > 2000 && student.year < currentYear + 6
      ? student.year
      : currentYear + 1; // default: next year

    const row: CandidateRow = {
      full_name: student.name.trim(),
      university: meta.universityName,
      degree: meta.defaultDegree,
      branch: student.branch?.trim() || "Unknown",
      graduation_year: gradYear,
      email,
      email_confidence: confidence,
      source: "manual",
    };

    rows.push(row);
    if (email) existing.emails.add(email.toLowerCase());
    existing.nameKeys.add(nameKey);
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const jsonPath = join(__dirname, "college-directories-output.json");
  const allColleges: CollegeResult[] = JSON.parse(readFileSync(jsonPath, "utf-8"));

  const confLevels = MIN_CONFIDENCE === "medium"
    ? ["high", "medium"]
    : ["high"];

  const targets = allColleges.filter(c =>
    (!ONLY_COLLEGE || c.shortName === ONLY_COLLEGE) &&
    COLLEGE_META[c.shortName]
  );

  console.log(`\nParsing student directories`);
  console.log(`Confidence filter : ${confLevels.join(" + ")}`);
  console.log(`Colleges          : ${ONLY_COLLEGE || "all"} (${targets.length})`);
  console.log(`Dry run           : ${DRY_RUN ? "YES — no DB writes" : "no"}\n`);

  let totalInserted = 0;
  let totalSkipped = 0;

  for (const college of targets) {
    const meta = COLLEGE_META[college.shortName];
    const urls = college.urls.filter(u =>
      u.isPdf && confLevels.includes(u.confidence)
    );

    if (urls.length === 0) {
      console.log(`⦿ ${college.college} — no ${confLevels.join("/")} PDF URLs, skipping`);
      continue;
    }

    console.log(`\n▸ ${college.college} (${urls.length} PDF${urls.length > 1 ? "s" : ""})`);

    // Load existing candidates for this university to dedup
    const existing = DRY_RUN
      ? { emails: new Set<string>(), nameKeys: new Set<string>() }
      : await fetchExistingKeys(meta.universityName);

    const collegeRows: CandidateRow[] = [];

    for (const { url, title } of urls) {
      console.log(`  → ${title || url}`);
      console.log(`    ${url}`);
      try {
        const rows = await processUrl(url, meta, college.type, existing);
        console.log(`    ✓ ${rows.length} new candidates`);
        collegeRows.push(...rows);
      } catch (err) {
        console.warn(`    ✗ ${err instanceof Error ? err.message : String(err)}`);
      }
      await sleep(1_000); // brief pause between Claude calls
    }

    if (DRY_RUN) {
      console.log(`  [DRY RUN] Would insert ${collegeRows.length} candidates`);
      if (collegeRows.length > 0) {
        console.log("  Sample:", JSON.stringify(collegeRows[0], null, 2));
      }
      totalInserted += collegeRows.length;
    } else {
      const inserted = await insertCandidates(collegeRows);
      const skipped = collegeRows.length - inserted;
      console.log(`  ✓ Inserted ${inserted} | skipped ${skipped}`);
      totalInserted += inserted;
      totalSkipped += skipped;
    }

    await sleep(500);
  }

  console.log("\n═══════════════════════════════════════════════════════");
  console.log(`Total inserted : ${totalInserted}`);
  if (!DRY_RUN) console.log(`Total skipped  : ${totalSkipped}`);
  console.log("═══════════════════════════════════════════════════════\n");
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
