import { createClient } from "@supabase/supabase-js";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const projectRoot = path.resolve(
  __dirname,
  "..",
);

function loadEnvFile(filePath: string): Record<string, string> {
  const raw = fs.readFileSync(filePath, "utf8");
  const out: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    // strip optional quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const env = loadEnvFile(path.join(projectRoot, ".env"));
const supabaseUrl = env.SUPABASE_URL;
const supabaseServiceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function main() {
  const { data: rows, error } = await supabase
    .from("experienced_candidates")
    .select(
      "campaign_id, full_name, current_title, current_company, linkedin_url, fit_tier, fit_score, campaigns(name)",
    )
    .neq("fit_tier", "irrelevant")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch experienced candidates:", error);
    process.exit(1);
  }

  const docsDir = path.join(projectRoot, "docs");
  fs.mkdirSync(docsDir, { recursive: true });

  const outPath = path.join(docsDir, "candidate-qa-review.csv");

  const header =
    "campaign_name,candidate_name,current_title,current_company,fit_tier,fit_score,linkedin_url,review_notes\n";

  const escapeCsv = (value: string | null | undefined): string => {
    const text = value == null ? "" : String(value);
    if (
      text.includes(",") ||
      text.includes('"') ||
      text.includes("\n") ||
      text.includes("\r")
    ) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const lines = rows
    .map((row) => {
      const campaignName =
        (row.campaigns as { name?: string } | null)?.name ?? "";
      const candidateName = row.full_name ?? "";
      const title = row.current_title ?? "";
      const company = row.current_company ?? "";
      const fitTier = row.fit_tier ?? "";
      const fitScore =
        typeof row.fit_score === "number"
          ? row.fit_score
          : row.fit_score != null
            ? Number(row.fit_score)
            : NaN;
      const fitScoreSafe = Number.isNaN(fitScore) ? "" : fitScore.toString();
      const linkedinUrl = row.linkedin_url ?? "";

      const reviewNotes = `Review candidate ${candidateName} (${title} at ${company}) with fit_tier=${fitTier} and fit_score=${fitScore}. Verify role relevance, company legitimacy, and LinkedIn profile alignment before proceeding.`;

      return [
        escapeCsv(campaignName),
        escapeCsv(candidateName),
        escapeCsv(title),
        escapeCsv(company),
        escapeCsv(fitTier),
        escapeCsv(fitScore.toString()),
        escapeCsv(linkedinUrl),
        escapeCsv(reviewNotes),
      ].join(",");
    })
    .join("\n");

  const csvContent = header + lines + (lines.length > 0 ? "\n" : "");

  fs.writeFileSync(outPath, csvContent, "utf8");
  console.log(`Wrote ${outPath} (${rows.length} rows)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
