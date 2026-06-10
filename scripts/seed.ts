/**
 * Seeds Supabase with mock candidates from src/data/talent.ts.
 *
 * Usage:
 *   1. Run supabase/migrations/001_schema.sql in your Supabase SQL editor.
 *   2. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
 *   3. npm run seed
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

import { MOCK_CANDIDATES } from "../src/data/talent";
import type { Database } from "../src/types/database";

config();

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.",
  );
  process.exit(1);
}

const supabase = createClient<Database>(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Stable UUIDs so local pipeline membership can reference seeded rows. */
export const SEED_CANDIDATE_IDS: Record<string, string> = {
  c1: "11111111-1111-4111-8111-111111111111",
  c2: "22222222-2222-4222-8222-222222222222",
  c3: "33333333-3333-4333-8333-333333333333",
  c4: "44444444-4444-4444-8444-444444444444",
  c5: "55555555-5555-4555-8555-555555555555",
  c6: "66666666-6666-4666-8666-666666666666",
};

const SOURCE_URLS: Record<string, string> = {
  "Smart India Hackathon – Hardware": "https://sih.gov.in/results/2023",
  "e-Yantra Robotics Competition": "https://www.e-yantra.org/result/2022",
  ETHIndia: "https://ethindia.co/projects",
  "Robocon India": "https://roboconindia.org/results/2023",
  "Inter IIT Tech Meet – Hardware":
    "https://interiit-tech.org/results/2022/hardware",
  "Google Summer of Code":
    "https://summerofcode.withgoogle.com/archive/2024",
  "Flipkart Grid": "https://unstop.com/competitions/flipkart-grid",
  "Conquest BITS Pilani": "https://conquest.org.in/winners/2023",
  "HUL LIME": "https://unstop.com/competitions/hul-lime",
  "Mahindra War Room": "https://unstop.com/competitions/mahindra-war-room",
  "Hult Prize India": "https://www.hultprize.org/competitions",
  "Amazon ML Challenge": "https://unstop.com/competitions/amazon-ml-challenge",
  "MathWorks Minidrone": "https://www.mathworks.com/minidrone",
  "BAJA SAE India": "https://www.bajasaeindia.com/results",
};

async function clearExisting() {
  await supabase.from("competition_results").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("positions_of_responsibility").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("candidates").delete().neq("id", "00000000-0000-0000-0000-000000000000");
}

async function seed() {
  console.log("Clearing existing candidate data…");
  await clearExisting();

  console.log(`Inserting ${MOCK_CANDIDATES.length} candidates…`);

  for (const candidate of MOCK_CANDIDATES) {
    const id = SEED_CANDIDATE_IDS[candidate.id] ?? candidate.id;

    const { error: candidateError } = await supabase.from("candidates").insert({
      id,
      full_name: candidate.full_name,
      university: candidate.university,
      degree: candidate.degree,
      branch: candidate.branch,
      graduation_year: candidate.graduation_year,
      linkedin_url: candidate.linkedin_url,
      email: candidate.email,
      email_confidence: candidate.email_confidence,
      github_url: candidate.github_url,
      source: "manual",
    });

    if (candidateError) {
      throw new Error(
        `Failed to insert ${candidate.full_name}: ${candidateError.message}`,
      );
    }

    if (candidate.competitions.length > 0) {
      const { error: compError } = await supabase
        .from("competition_results")
        .insert(
          candidate.competitions.map((comp) => ({
            candidate_id: id,
            competition_name: comp.competition_name,
            competition_category: comp.competition_category,
            result_tier: comp.result_tier,
            year: comp.year,
            team_name: comp.team_name ?? null,
            source_url:
              comp.source_url ??
              SOURCE_URLS[comp.competition_name] ??
              "https://example.com/source",
            ingestion_method: "manual" as const,
          })),
        );

      if (compError) {
        throw new Error(
          `Failed to insert competitions for ${candidate.full_name}: ${compError.message}`,
        );
      }
    }

    if (candidate.positions.length > 0) {
      const { error: porError } = await supabase
        .from("positions_of_responsibility")
        .insert(
          candidate.positions.map((por) => ({
            candidate_id: id,
            organisation_name: por.organisation_name,
            role_title: por.role_title,
            por_category: por.por_category,
            institution: candidate.university,
            year_start: por.year_start,
            year_end: por.year_end,
            source_url:
              por.source_url ??
              `https://example.com/por/${encodeURIComponent(por.organisation_name)}`,
            ingestion_method: "manual" as const,
          })),
        );

      if (porError) {
        throw new Error(
          `Failed to insert PoRs for ${candidate.full_name}: ${porError.message}`,
        );
      }
    }

    console.log(`  ✓ ${candidate.full_name}`);
  }

  const arjunId = SEED_CANDIDATE_IDS.c1;
  const { error: pipelineError } = await supabase.from("pipelines").upsert(
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      name: "SWE Intern — July 2025",
      created_by: "seed",
      candidate_ids: [arjunId],
      notes: "Seeded pipeline with Arjun Mehta (SIH Hardware winner + Techfest PoR).",
    },
    { onConflict: "id" },
  );

  if (pipelineError) {
    throw new Error(`Failed to seed pipeline: ${pipelineError.message}`);
  }

  console.log("\nSeed complete.");
  console.log(`  Candidates: ${MOCK_CANDIDATES.length}`);
  console.log(`  Example: Arjun Mehta → ${arjunId}`);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
