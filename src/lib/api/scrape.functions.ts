/**
 * scrape.functions.ts
 *
 * Triggers the Puppeteer-based competition scraper (compscraper/index.js) as a
 * child process.  The compscraper searches Twitter and LinkedIn for hackathon /
 * competition posts and writes new candidates directly to Supabase.
 *
 * Prerequisites in .env:
 *   TWITTER_COOKIE   — Twitter auth_token cookie (required for Twitter scrape)
 *   LINKEDIN_COOKIE  — LinkedIn li_at cookie     (required for LinkedIn scrape)
 */

import { createServerFn } from "@tanstack/react-start";
import { spawn } from "child_process";
import path from "path";

export interface ScrapeCompetitionsResult {
  newCandidates: number;
  newCompetitions: number;
  failures: number;
  twitterSkipped: boolean;
  linkedinSkipped: boolean;
  timedOut: boolean;
  /** Last ~800 chars of stdout for the UI to surface if something went wrong */
  tail: string;
}

const TIMEOUT_MS = 8 * 60 * 1000; // 8 minutes — enough for both scrapers

export const scrapeCompetitionsFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<ScrapeCompetitionsResult> => {
    // The compscraper lives one level above the project root
    const compscraperDir = path.resolve(process.cwd(), "../compscraper");

    return new Promise((resolve, reject) => {
      const chunks: string[] = [];
      let timedOut = false;

      const child = spawn(process.execPath, ["index.js"], {
        cwd: compscraperDir,
        // Inherit the parent's env so Supabase/cookie vars are available.
        // compscraper/index.js also calls dotenv.config() which will load its
        // own .env on top — that's fine for local use.
        env: { ...process.env },
      });

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
      }, TIMEOUT_MS);

      child.stdout.on("data", (d: Buffer) => {
        const text = d.toString();
        chunks.push(text);
        process.stdout.write(`[compscraper] ${text}`);
      });

      child.stderr.on("data", (d: Buffer) => {
        chunks.push(d.toString());
      });

      child.on("error", (err) => {
        clearTimeout(timer);
        reject(new Error(`Failed to start compscraper: ${err.message}`));
      });

      child.on("close", () => {
        clearTimeout(timer);
        const fullOutput = chunks.join("");

        // Parse the summary line printed by ingestLeads():
        // "Done — X new candidates, Y new competition rows, Z failures."
        const summaryMatch = fullOutput.match(
          /(\d+) new candidates?,\s*(\d+) new competition rows?,\s*(\d+) failures?/,
        );

        resolve({
          newCandidates: summaryMatch ? parseInt(summaryMatch[1], 10) : 0,
          newCompetitions: summaryMatch ? parseInt(summaryMatch[2], 10) : 0,
          failures: summaryMatch ? parseInt(summaryMatch[3], 10) : 0,
          twitterSkipped:
            fullOutput.includes("TWITTER_COOKIE not set") ||
            fullOutput.includes("SKIP_TWITTER=true"),
          linkedinSkipped:
            fullOutput.includes("LINKEDIN_COOKIE not set") ||
            fullOutput.includes("SKIP_LINKEDIN=true"),
          timedOut,
          tail: fullOutput.slice(-800),
        });
      });
    });
  },
);
