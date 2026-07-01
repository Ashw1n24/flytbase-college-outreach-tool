import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseAdmin } from "@/lib/supabase.server";
import { uploadFile, mediaPath, getSignedUrl } from "@/lib/storage.server";
import type { Json } from "@/types/database";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Post types ───────────────────────────────────────────────────────────────

const POST_TYPES = [
  "jd_hook",
  "role_culture",
  "industry_insight",
  "ideal_profile",
  "day_in_life",
] as const;
type PostType = (typeof POST_TYPES)[number];

const POST_TYPE_LABELS: Record<PostType, string> = {
  jd_hook:          "Role & Ownership",
  role_culture:     "Life in the Role",
  industry_insight: "Industry Insight",
  ideal_profile:    "Ideal Profile",
  day_in_life:      "Day in the Life",
};

const POST_TYPE_FOCUS: Record<PostType, string> = {
  jd_hook:
    "Lead with what this person will own in the role. Make the scope of responsibility the core of the post.",
  role_culture:
    "Write what it is actually like to be in THIS SPECIFIC ROLE at FlytBase — not generic culture, but what is specific to this role: who they work with, what a real week looks like, what decisions they own, what their environment is different from a standard company.",
  industry_insight:
    "Lead with a genuine insight about the drone autonomy or Physical AI industry — a trend, a hard problem, or something counterintuitive. Connect it naturally to why FlytBase is working on this and why this role exists.",
  ideal_profile:
    "Describe the kind of person who would thrive in this role — not a list of requirements, but a portrait of mindset, working style, and instincts. What does this person get obsessed with? What does their approach to problems look like?",
  day_in_life:
    "Write about what a real week looks like in this role at FlytBase — what decisions get made, who they interact with, what they ship or move forward, what problems they hit.",
};

// ── Date helpers ──────────────────────────────────────────────────────────────

function countWeekdays(start: string, end: string): number {
  const endDate = new Date(end);
  let count = 0;
  const cur = new Date(start);
  while (cur <= endDate) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function postsPerPlatform(startDate: string | null, endDate: string | null): number {
  if (!startDate || !endDate) return 3;
  const weekdays = countWeekdays(startDate, endDate);
  return Math.max(1, Math.min(5, Math.round(weekdays / 2.5)));
}

// ── Constants ────────────────────────────────────────────────────────────────

export const DEFAULT_CUSTOM_INSTRUCTIONS = `Life at FlytBase brand voice:

Write as someone who actually works here — specific, high-energy, casual but smart. This is not corporate copy. It is the voice of a small, high-ownership team building drone autonomy infrastructure from the ground up.

Never use em dashes. Never write in a staccato sequence of short punchy fragments. That style sounds like AI-generated startup copy and is the exact opposite of what we want. Write in natural, flowing prose where ideas connect to each other.

Lead with what the candidate will own, not what we need from them. Avoid hype words entirely ("revolutionary", "cutting-edge", "next-gen", "passionate", "excited to announce").

Always write "FlytBase" with a capital F and capital B. Never "flytbase" or "Flytbase". We call team members "Flyters". Company context: FlytBase is the autonomy layer for commercial drone operations, part of the broader Physical AI space. Hard problems, meaningful work.

Tone: high-agency, builder mindset, specific rather than vague. Use real numbers where possible. No emojis. Assume the reader is technically sharp and will see through bullshit immediately.

End every post with a CTA pointing to lifeatflytbase.com/openings. Use casual language — "join the crew", "see all open roles", "apply at" — rather than generic "apply now". Never use the phrase "we are hiring" as an opener.`;

// Curated subreddit list — AI picks 3–5 most relevant per role
const INDIA_SUBREDDITS = [
  // Indian tech / career communities
  "r/developersIndia", "r/PuneTech", "r/bangalore", "r/startupIndia",
  "r/cscareerquestionsIN", "r/IndiaJobs", "r/IndiaTech", "r/EngineerBro",
  // Domain-specific
  "r/drones", "r/UAV", "r/robotics", "r/artificial", "r/MachineLearning",
  "r/SoftwareEngineering", "r/embedded", "r/aerospace", "r/hardware",
  "r/Futurology",
  // Role-specific
  "r/sales", "r/ProductManagement",
];

const PLATFORM_SPECS = {
  linkedin: `CHARACTER LIMITS — enforce these before anything else:
  - "content" field: minimum 600 characters, HARD MAXIMUM 1000 characters (count every space and punctuation mark). If your draft exceeds 1000 characters, cut sentences until it fits. Do not pad to reach 600 — substance over length.
  - Each carousel "headline": maximum 6 words.
  - Each carousel "body": maximum 25 words, exactly 1 sentence.

Write the post in flowing prose — no em dashes, no bullet-point fragments, no staccato one-liners. Structure: one opening paragraph that earns attention, two to three paragraphs of substance, one closing paragraph with CTA.

CAROUSEL RULE — the 6 carousel slides must tell the SAME story as the post content, not different content. Take the central argument or narrative from the post and break it into 6 sequential slides. Each slide should feel like the next step in the same journey. A reader who reads the slides and then the post should feel like they got the same message in two formats. Return carousel_slides as an array of 6 objects, each with "headline" (a short noun phrase or question, max 6 words, sentence case — NOT a full sentence) and "body" (exactly 1 sentence expanding on the headline, max 25 words).`,

  instagram: `CHARACTER LIMITS — enforce these first:
  - "content" field: minimum 150 characters, HARD MAXIMUM 220 characters (count every character including spaces). Count carefully. If your caption is 221 characters or more, cut words until it is under 220.

The caption should open with something a real person would say about the work, not a tagline. No em dashes. No sentence fragments stacked for effect. No hashtags in the caption field itself.

Also return a "hashtags" array of 12–15 tags relevant to the role, the industry, and the India tech community.`,

  twitter: `Write a thread of exactly 4 tweets. Each tweet HARD MAXIMUM 270 characters (count every character). Do not use em dashes anywhere. Each tweet should be a complete thought in natural language — not a one-liner fragment. Tweet 1: a hook that makes someone stop scrolling. Tweet 2: what the person will actually own in this role. Tweet 3: why FlytBase specifically and why now. Tweet 4: CTA linking to lifeatflytbase.com/openings. Return as a "tweets" array of 4 strings.`,

  reddit: `Write a value-first post between 250 and 400 words. Lead with a genuine insight, observation, or story about what FlytBase is building in the Physical AI or drone autonomy space — something the community would find interesting on its own merits. Do not hard sell. Mention hiring only in the last 1–2 sentences as a soft close. No em dashes. No bullet-point lists. Write in connected paragraphs. From this list, suggest the 3–5 most relevant subreddits for this specific role: ${INDIA_SUBREDDITS.join(", ")}. Return them as a "subreddits" array.`,
};

// ── Scrape JD URL ────────────────────────────────────────────────────────────

export const scrapeJdForSocialFn = createServerFn({ method: "POST" })
  .validator(z.object({ url: z.string().url() }))
  .handler(async ({ data }) => {
    let pageText: string;
    try {
      const headers: Record<string, string> = { Accept: "text/markdown" };
      if (process.env.JINA_API_KEY) {
        headers["Authorization"] = `Bearer ${process.env.JINA_API_KEY}`;
      }
      const res = await fetch(`https://r.jina.ai/${data.url}`, {
        headers,
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw new Error(`Jina returned HTTP ${res.status}`);
      pageText = (await res.text()).trim().slice(0, 12_000);
    } catch (err) {
      throw new Error(
        `Could not fetch URL: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    if (pageText.length < 100) {
      throw new Error(
        "No content extracted — check the URL is publicly accessible.",
      );
    }

    const prompt = `Extract key information from this job description for social media hiring content.

Return ONLY valid JSON, no markdown fences, no explanation:
{
  "role_title": "exact job title from the JD",
  "department": "department or function",
  "seniority": "intern | junior | mid | senior | lead | head",
  "experience_range": "e.g. 2-5 years",
  "location": "city, country",
  "top_responsibilities": ["3-4 most compelling things the person will own"],
  "key_skills": ["5-6 most important skills"],
  "why_compelling": "1-2 sentences on what makes this role uniquely exciting",
  "hook": "the single strongest thing to lead with in a social post"
}

JD text:
${pageText}`;

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    });

    const raw =
      response.content[0].type === "text" ? response.content[0].text.trim() : "{}";
    let parsed: Record<string, unknown> = {};
    try {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    } catch {}

    return {
      jd_text: pageText,
      jd_parsed: parsed,
      role_title: (parsed.role_title as string) ?? "",
    };
  });

// ── Create campaign ───────────────────────────────────────────────────────────

export const createSocialCampaignFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      name: z.string().min(1),
      role_title: z.string().min(1),
      jd_url: z.string().url().nullable().optional(),
      jd_text: z.string().min(10),
      jd_parsed: z.record(z.unknown()).default({}),
      target_audience: z.enum(["students", "experienced", "niche_tech"]),
      platforms: z.array(z.string()).min(1),
      start_date: z.string().nullable().optional(),
      end_date: z.string().nullable().optional(),
      custom_instructions: z.string().default(DEFAULT_CUSTOM_INSTRUCTIONS),
    }),
  )
  .handler(async ({ data }) => {
    const supabase = getSupabaseAdmin();

    const { data: campaign, error } = await supabase
      .from("social_campaigns")
      .insert({
        name: data.name,
        role_title: data.role_title,
        jd_url: data.jd_url ?? null,
        jd_text: data.jd_text,
        jd_parsed: data.jd_parsed as Json,
        target_audience: data.target_audience,
        platforms: data.platforms,
        start_date: data.start_date ?? null,
        end_date: data.end_date ?? null,
        custom_instructions: data.custom_instructions,
        status: "draft",
      })
      .select()
      .single();

    if (error || !campaign) throw new Error(error?.message ?? "Failed to create campaign");

    // Create N empty draft posts per platform (1 per ~2-3 weekdays in the campaign window)
    const n = postsPerPlatform(data.start_date ?? null, data.end_date ?? null);
    const posts = data.platforms.flatMap((platform) =>
      Array.from({ length: n }, (_, i) => ({
        campaign_id: campaign.id,
        platform: platform as "linkedin" | "instagram" | "twitter" | "reddit",
        content: "",
        status: "draft" as const,
        content_variant: { post_type: POST_TYPES[i % POST_TYPES.length] } as Json,
      })),
    );

    if (posts.length > 0) {
      const { error: postsError } = await supabase.from("social_posts").insert(posts);
      if (postsError) console.error("Failed to create post drafts:", postsError.message);
    }

    return { campaignId: campaign.id };
  });

// ── Upload campaign media ─────────────────────────────────────────────────────

export const uploadCampaignMediaFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      campaignId: z.string().uuid(),
      fileName: z.string().min(1),
      mimeType: z.string().min(1),
      base64: z.string().min(1), // base64-encoded file content
    }),
  )
  .handler(async ({ data }) => {
    const buffer = Buffer.from(data.base64, "base64");
    const path = mediaPath(data.campaignId, `${Date.now()}_${data.fileName}`);
    await uploadFile(path, buffer, data.mimeType);

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("social_campaign_media").insert({
      campaign_id: data.campaignId,
      file_name: data.fileName,
      storage_path: path,
      mime_type: data.mimeType,
    });

    if (error) throw new Error(`Failed to save media record: ${error.message}`);
    return { path };
  });

// ── List campaigns ────────────────────────────────────────────────────────────

export const getSocialCampaignsFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("social_campaigns")
      .select("id, name, role_title, platforms, status, target_audience, start_date, end_date, created_at")
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data ?? [];
  },
);

// ── Get single campaign ───────────────────────────────────────────────────────

export const getSocialCampaignFn = createServerFn({ method: "GET" })
  .validator(z.object({ campaignId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const supabase = getSupabaseAdmin();

    const [{ data: campaign, error }, { data: posts }, { data: media }] =
      await Promise.all([
        supabase
          .from("social_campaigns")
          .select("*")
          .eq("id", data.campaignId)
          .single(),
        supabase
          .from("social_posts")
          .select("*")
          .eq("campaign_id", data.campaignId)
          .order("platform"),
        supabase
          .from("social_campaign_media")
          .select("*")
          .eq("campaign_id", data.campaignId),
      ]);

    if (error || !campaign) throw new Error(error?.message ?? "Campaign not found");

    // Attach signed URLs to media items (1-hour expiry)
    const mediaWithUrls = await Promise.all(
      (media ?? []).map(async (m) => {
        try {
          const signed_url = await getSignedUrl(m.storage_path, 3600);
          return { ...m, signed_url };
        } catch {
          return { ...m, signed_url: null };
        }
      }),
    );

    return { campaign, posts: posts ?? [], media: mediaWithUrls };
  });

// ── Per-platform content generation helper ────────────────────────────────────

const PLATFORM_MAX_TOKENS: Record<string, number> = {
  linkedin:  6000,
  instagram: 2000,
  twitter:   2500,
  reddit:    4000,
};

function platformJsonShape(platform: string): string {
  if (platform === "linkedin")
    return `{"post_type": "...", "content": "...", "carousel_slides": [{"headline": "...", "body": "..."}]}`;
  if (platform === "instagram")
    return `{"post_type": "...", "content": "caption text — no hashtags in this field", "hashtags": ["tag1", "tag2"]}`;
  if (platform === "twitter")
    return `{"post_type": "...", "tweets": ["tweet1", "tweet2", "tweet3", "tweet4"]}`;
  if (platform === "reddit")
    return `{"post_type": "...", "content": "...", "subreddits": ["r/sub1", "r/sub2", "r/sub3"]}`;
  return `{"post_type": "...", "content": "..."}`;
}

async function generatePlatformContent(
  platform: string,
  posts: Array<{ id: string; post_type: PostType }>,
  campaign: {
    role_title: string;
    jd_text: string;
    jd_parsed: unknown;
    custom_instructions: string;
    target_audience: string;
  },
  parsed: Record<string, unknown>,
  audienceLabel: string,
  audienceGuidance: string,
): Promise<Array<Record<string, unknown>> | null> {
  if (posts.length === 0) return null;

  const spec = PLATFORM_SPECS[platform as keyof typeof PLATFORM_SPECS] ?? "";
  const shape = platformJsonShape(platform);

  const postList = posts
    .map(
      (ep, i) =>
        `Post ${i + 1}: post_type="${ep.post_type}" (${POST_TYPE_LABELS[ep.post_type]})\nFocus: ${POST_TYPE_FOCUS[ep.post_type]}`,
    )
    .join("\n\n");

  const prompt = `You are writing ${platform.toUpperCase()} hiring content for FlytBase. Generate exactly ${posts.length} post(s).

ABSOLUTE WRITING RULES — violating any of these makes output unusable:
1. Never use em dashes (— or –) anywhere.
2. No staccato fragments stacked for effect. Bad: "Own it. Build it. Ship it." Good: "You'd be the first to own this from end to end, which means deciding the tools, the markets, and what the playbook looks like six months from now."
3. No hype words: "revolutionary", "cutting-edge", "next-gen", "passionate", "excited to announce", "transformative".
4. No emojis.
5. Always write "FlytBase" with capital F and B.
6. Each post must be clearly distinct — different angle, different opening, different substance.
7. Never start two consecutive sentences with the same word. Before finalising each post, scan every sentence opening — if any two adjacent sentences share the same first word, rewrite one of them.
8. Respect the character limits in the PLATFORM section below. Count characters before outputting. If a field is over its limit, trim it before output.

BRAND VOICE:
${campaign.custom_instructions}

ROLE CONTEXT:
Title: ${campaign.role_title}
Department: ${(parsed.department as string) ?? ""}
Seniority: ${(parsed.seniority as string) ?? ""}
Experience: ${(parsed.experience_range as string) ?? ""}
Location: ${(parsed.location as string) ?? "Pune, India"}
What this person will own: ${((parsed.top_responsibilities as string[]) ?? []).join("; ")}
Key skills: ${((parsed.key_skills as string[]) ?? []).join(", ")}
Why it's compelling: ${(parsed.why_compelling as string) ?? ""}
Strongest hook: ${(parsed.hook as string) ?? ""}

TARGET AUDIENCE: ${audienceLabel}
${audienceGuidance}

FLYTBASE CONTEXT:
FlytBase is the enterprise software platform for commercial drone operations — fleet management, flight operations, payload integrations, airspace compliance, real-time telemetry. Customers include T-Mobile, Duke Energy, Verizon across 50+ countries. Founded 2018, HQ Pune. The core problem: scaling drone operations beyond one pilot, one drone, one mission. The team is lean and high-ownership — most people own entire systems or product areas, not just features.

JD EXCERPT:
${campaign.jd_text.slice(0, 2000)}

PLATFORM: ${platform.toUpperCase()}
${spec}

POSTS TO GENERATE (${posts.length} total, must generate ALL of them):
${postList}

Return ONLY a valid JSON array of exactly ${posts.length} object(s) — one per post, in the order listed above. No markdown fences, no explanation:
[${Array(posts.length).fill(shape).join(", ")}]`;

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: PLATFORM_MAX_TOKENS[platform] ?? 3000,
    messages: [{ role: "user", content: prompt }],
  });

  const raw =
    response.content[0].type === "text" ? response.content[0].text.trim() : "[]";

  // Parse JSON array — try direct array match first, fall back to object wrap
  try {
    const arrMatch = raw.match(/\[[\s\S]*\]/);
    if (arrMatch) return JSON.parse(arrMatch[0]) as Array<Record<string, unknown>>;
    // Single post generated without array brackets
    const objMatch = raw.match(/\{[\s\S]*\}/);
    if (objMatch) return [JSON.parse(objMatch[0]) as Record<string, unknown>];
  } catch {
    console.error(`[social] Failed to parse ${platform} generation response:`, raw.slice(0, 200));
  }
  return null;
}

// ── Generate social posts (Claude Haiku) ─────────────────────────────────────

export const generateSocialPostsFn = createServerFn({ method: "POST" })
  .validator(z.object({ campaignId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const supabase = getSupabaseAdmin();

    // Fetch campaign data
    const { data: campaign, error } = await supabase
      .from("social_campaigns")
      .select("*")
      .eq("id", data.campaignId)
      .single();

    if (error || !campaign) throw new Error("Campaign not found");

    const parsed = campaign.jd_parsed as Record<string, unknown>;
    const audienceLabel =
      campaign.target_audience === "students"
        ? "students and early-career candidates (0–2 years experience)"
        : campaign.target_audience === "experienced"
          ? "experienced professionals (3+ years)"
          : "niche tech and drone/robotics community members";

    const audienceGuidance =
      campaign.target_audience === "students"
        ? `This is for students and people at the start of their career. Write for someone ambitious who wants to prove themselves. Frame the role as a place to build something real from day one — not to assist, not to shadow, but to actually own a piece of work. Use vocabulary a recent grad would use, not corporate speak. Do not use phrases like "seasoned professional" or "track record".`
        : campaign.target_audience === "experienced"
          ? `This is for people with 3+ years experience evaluating whether FlytBase is a step up in ownership. Write for someone who already knows the domain. Frame the move as an increase in agency — more scope, more autonomy, more direct impact. Do not use language that sounds junior. Avoid "great opportunity to learn" — write about what they will lead, shape, or build.`
          : `This is for technical specialists in robotics, drones, embedded systems, or adjacent fields. Use technical vocabulary freely. Frame the role around solving hard, unsolved problems. The reader should feel like this post was written by a peer, not a recruiter.`;

    // Fetch existing posts grouped by platform
    const { data: existingPosts } = await supabase
      .from("social_posts")
      .select("id, platform, content_variant")
      .eq("campaign_id", data.campaignId)
      .order("created_at");

    // Build per-platform post lists
    const platformPostMap: Record<string, Array<{ id: string; post_type: PostType }>> = {};
    for (const p of campaign.platforms as string[]) {
      const platformPosts = (existingPosts ?? []).filter((ep) => ep.platform === p);
      platformPostMap[p] = platformPosts.map((ep, i) => ({
        id: ep.id,
        post_type:
          ((ep.content_variant as Record<string, unknown> | null)?.post_type as PostType) ??
          POST_TYPES[i % POST_TYPES.length],
      }));
      if (platformPostMap[p].length === 0) {
        platformPostMap[p] = [{ id: "", post_type: "jd_hook" }];
      }
    }

    // Generate all platforms in parallel — one focused Haiku call per platform
    const results = await Promise.all(
      (campaign.platforms as string[]).map(async (platform) => {
        const generated = await generatePlatformContent(
          platform,
          platformPostMap[platform],
          campaign,
          parsed,
          audienceLabel,
          audienceGuidance,
        );
        return { platform, generated };
      }),
    );

    // Write results back to DB
    await Promise.all(
      results.map(async ({ platform, generated }) => {
        if (!generated) return;
        const platformPosts = platformPostMap[platform];

        await Promise.all(
          platformPosts.map(async (ep, i) => {
            const genData = generated[i];
            if (!genData || !ep.id) return;

            let content = "";
            let content_variant: Json = null;

            if (platform === "linkedin") {
              content = (genData.content as string) ?? "";
              content_variant = {
                post_type: genData.post_type ?? ep.post_type,
                carousel_slides: genData.carousel_slides ?? [],
              } as Json;
            } else if (platform === "instagram") {
              content = (genData.content as string) ?? "";
              content_variant = {
                post_type: genData.post_type ?? ep.post_type,
                hashtags: genData.hashtags ?? [],
              } as Json;
            } else if (platform === "twitter") {
              const tweets = (genData.tweets as string[]) ?? [];
              content = tweets.join("\n\n---\n\n");
              content_variant = {
                post_type: genData.post_type ?? ep.post_type,
                tweets,
              } as Json;
            } else if (platform === "reddit") {
              content = (genData.content as string) ?? "";
              content_variant = {
                post_type: genData.post_type ?? ep.post_type,
                subreddits: genData.subreddits ?? [],
              } as Json;
            }

            await supabase
              .from("social_posts")
              .update({ content, content_variant, status: "draft" })
              .eq("id", ep.id);
          }),
        );
      }),
    );

    // Return updated posts
    const { data: updatedPosts } = await supabase
      .from("social_posts")
      .select("*")
      .eq("campaign_id", data.campaignId)
      .order("platform");

    return { posts: updatedPosts ?? [] };
  });

// ── Update a post ─────────────────────────────────────────────────────────────

export const updateSocialPostFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      postId: z.string().uuid(),
      content: z.string().optional(),
      content_variant: z.record(z.unknown()).nullable().optional(),
      status: z.enum(["draft", "approved", "posted"]).optional(),
      scheduled_date: z.string().nullable().optional(),
      subreddit: z.string().nullable().optional(),
      image_template: z.string().nullable().optional(),
      posted_at: z.string().nullable().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { postId, ...updates } = data;
    const supabase = getSupabaseAdmin();

    const payload: Record<string, unknown> = {};
    if (updates.content !== undefined) payload.content = updates.content;
    if (updates.content_variant !== undefined) payload.content_variant = updates.content_variant as Json;
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.scheduled_date !== undefined) payload.scheduled_date = updates.scheduled_date;
    if (updates.subreddit !== undefined) payload.subreddit = updates.subreddit;
    if (updates.image_template !== undefined) payload.image_template = updates.image_template;
    if (updates.posted_at !== undefined) payload.posted_at = updates.posted_at;

    const { error } = await supabase
      .from("social_posts")
      .update(payload)
      .eq("id", postId);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Update campaign status ────────────────────────────────────────────────────

export const updateSocialCampaignFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      campaignId: z.string().uuid(),
      status: z.enum(["draft", "active", "completed", "archived"]).optional(),
      name: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { campaignId, ...updates } = data;
    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from("social_campaigns")
      .update(updates)
      .eq("id", campaignId);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns IDs of all non-archived campaigns. Used to exclude archived posts from calendar views. */
async function getNonArchivedCampaignIds(supabase: ReturnType<typeof getSupabaseAdmin>): Promise<string[]> {
  const { data } = await supabase
    .from("social_campaigns")
    .select("id")
    .neq("status", "archived");
  return (data ?? []).map((c) => c.id);
}

// ── Calendar posts ────────────────────────────────────────────────────────────

export const getCalendarPostsFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const supabase = getSupabaseAdmin();

    const campaignIds = await getNonArchivedCampaignIds(supabase);
    if (campaignIds.length === 0) return [];

    const { data, error } = await supabase
      .from("social_posts")
      .select("id, campaign_id, platform, content, status, scheduled_date, social_campaigns(name, role_title)")
      .not("scheduled_date", "is", null)
      .in("campaign_id", campaignIds)
      .order("scheduled_date");

    if (error) throw new Error(error.message);
    return data ?? [];
  },
);

// ── Unscheduled posts (for calendar sidebar) ──────────────────────────────────

export const getUnscheduledPostsFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const supabase = getSupabaseAdmin();

    const campaignIds = await getNonArchivedCampaignIds(supabase);
    if (campaignIds.length === 0) return [];

    const { data, error } = await supabase
      .from("social_posts")
      .select("id, campaign_id, platform, content, status, social_campaigns(name, role_title)")
      .is("scheduled_date", null)
      .neq("status", "posted")
      .in("campaign_id", campaignIds)
      .order("platform");

    if (error) throw new Error(error.message);
    return data ?? [];
  },
);

// ── Auto-schedule campaign posts across its date window ───────────────────────

function getWeekdaysInRange(start: string, end: string): string[] {
  const result: string[] = [];
  const cur = new Date(start);
  const endDate = new Date(end);
  while (cur <= endDate) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) result.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return result;
}

export const scheduleCampaignPostsFn = createServerFn({ method: "POST" })
  .validator(z.object({ campaignId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const supabase = getSupabaseAdmin();

    const { data: campaign } = await supabase
      .from("social_campaigns")
      .select("start_date, end_date, platforms")
      .eq("id", data.campaignId)
      .single();

    if (!campaign?.start_date || !campaign?.end_date) {
      throw new Error("Campaign needs a start and end date to auto-schedule.");
    }

    const weekdays = getWeekdaysInRange(campaign.start_date, campaign.end_date);
    if (weekdays.length === 0) throw new Error("No weekdays found in the campaign date range.");

    // Fetch posts ordered by platform then created_at, so posts of the same
    // platform are grouped together before we interleave them
    const { data: posts } = await supabase
      .from("social_posts")
      .select("id, platform, created_at")
      .eq("campaign_id", data.campaignId)
      .order("created_at");

    if (!posts || posts.length === 0) throw new Error("No posts to schedule.");

    // Interleave platforms so consecutive dates alternate between platforms
    // e.g. [li-1, tw-1, ig-1, re-1, li-2, tw-2, ...] → each day gets a different platform
    const byPlatform: Record<string, string[]> = {};
    for (const p of posts) {
      if (!byPlatform[p.platform]) byPlatform[p.platform] = [];
      byPlatform[p.platform].push(p.id);
    }
    const interleaved: string[] = [];
    const maxPerPlatform = Math.max(...Object.values(byPlatform).map((arr) => arr.length));
    for (let i = 0; i < maxPerPlatform; i++) {
      for (const ids of Object.values(byPlatform)) {
        if (ids[i]) interleaved.push(ids[i]);
      }
    }

    // Spread posts evenly across weekdays (round-robin if more posts than days)
    await Promise.all(
      interleaved.map((id, i) =>
        supabase
          .from("social_posts")
          .update({ scheduled_date: weekdays[i % weekdays.length] })
          .eq("id", id),
      ),
    );

    return { scheduled: interleaved.length };
  });

// ── Delete campaigns ──────────────────────────────────────────────────────────

export const deleteSocialCampaignsFn = createServerFn({ method: "POST" })
  .validator(z.object({ campaignIds: z.array(z.string().uuid()).min(1) }))
  .handler(async ({ data }) => {
    const supabase = getSupabaseAdmin();

    // Delete posts first, then media records, then campaign
    await supabase.from("social_posts").delete().in("campaign_id", data.campaignIds);
    await supabase.from("social_campaign_media").delete().in("campaign_id", data.campaignIds);

    const { error } = await supabase
      .from("social_campaigns")
      .delete()
      .in("id", data.campaignIds);

    if (error) throw new Error(error.message);
    return { deleted: data.campaignIds.length };
  });

// ── Clear calendar (unschedule all posts) ─────────────────────────────────────

export const clearCalendarFn = createServerFn({ method: "POST" }).handler(
  async () => {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("social_posts")
      .update({ scheduled_date: null })
      .not("scheduled_date", "is", null);

    if (error) throw new Error(error.message);
    return { ok: true };
  },
);

// ── Image template preview HTML ───────────────────────────────────────────────

export const getPostPreviewHtmlFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      variant: z.enum([
        "dark-feature",
        "split-panel",
        "minimal-centered",
        "stats-grid",
        "responsibility-list",
        "bold-headline",
      ]),
      roleTitle: z.string(),
      hook: z.string(),
      responsibilities: z.array(z.string()).optional(),
      skills: z.array(z.string()).optional(),
      platform: z.enum(["linkedin", "instagram", "twitter", "reddit"]),
      campaignName: z.string().optional(),
      contentSnippet: z.string().optional(),
      mediaUrl: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    // Dynamic import keeps the large template module out of the client bundle
    const { renderTemplate } = await import("@/lib/social-image-templates");
    const html = renderTemplate(data.variant, data);
    return { html };
  });

// ── AI image generation (Pollinations.ai — free, no API key) ───────────────────

/** Aspect ratios per platform */
const IMAGE_DIMS: Record<string, { w: number; h: number; label: string }> = {
  linkedin:  { w: 1080, h: 1080, label: "1:1 square" },
  instagram: { w: 1080, h: 1350, label: "4:5 portrait" },
  twitter:   { w: 1200, h: 675, label: "16:9 landscape" },
  reddit:    { w: 1080, h: 1080, label: "1:1 square" },
};

/**
 * Brand-aware image prompt built from JD-parsed fields.
 *
 * Steers toward FlytBase's existing pixel/retro visual identity so AI images
 * never clash with the native templates.
 */
function buildImagePrompt(parsed: Record<string, unknown>, roleTitle: string, imageInstructions?: string): string {
  const department  = (parsed.department as string) ?? "tech";
  const seniority   = (parsed.seniority as string) ?? "";
  const hook        = (parsed.hook as string) ?? "";
  const skills      = ((parsed.key_skills as string[]) ?? []).slice(0, 4).join(", ");
  const responsib   = ((parsed.top_responsibilities as string[]) ?? []).slice(0, 2).join("; ");

  // Palette reference — exact brand colours so imagery matches templates
  const palette =
    "cream (#D4CDB8), yellow (#F5C800), dark navy blue (#1878C2), green (#267848), " +
    "dark charcoal (#1A1A1A), orange (#C87828)";

  const style =
    "vector illustration, pixel-art inspired, flat design with thick outlines, " +
    "graphic shapes and solid colour blocks, no gradients, playful tech aesthetic, " +
    "32-bit style. NO photographic realism, NO stock-photo people, NO 3D render.";

  const subject = hook
    ? `${hook}. ${responsib ? `The role involves: ${responsib}.` : ""}`
    : `${roleTitle} at FlytBase — drone autonomy and Physical AI. ${responsib}`;

  return [
    `Social recruiting image concept for a ${roleTitle} role at FlytBase.`,
    seniority ? `Seniority context: ${seniority}.` : "",
    `Department: ${department}.`,
    skills ? `Key skills in the work: ${skills}.` : "",
    "",
    `VISUAL STYLE — follow these exactly:`,
    style,
    "",
    `CONTEXT FROM THE ROLE (use this as inspiration for what to show, NOT as text to render):`,
    subject,
    "",
    `BRAND COLOURS—use these as major fills, not accents:`,
    palette,
    "",
    "Design a vertical card composition: abstract or illustrative " +
    "visual in the centre, bold colour blocks, thick dark borders around " +
    "every major section, flat graphic style.",
    "",
    "Critical rules: absolutely NO text, NO letters, NO numbers, NO words, " +
    "NO glyphs, NO symbols that look like writing anywhere in the image. " +
    "The image must be purely visual — icons, shapes, abstract patterns only.",
    "",
    "ADDITIONAL USER INSTRUCTIONS — follow these exactly:",
    imageInstructions || "none",
  ]
    .filter(Boolean)
    .join(" ");
}

export const generateSocialImageFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      campaignId: z.string().uuid(),
      prompt: z.string().optional(),
      platform: z.string().default("linkedin"),
      imageInstructions: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const supabase = getSupabaseAdmin();

    // Fetch campaign JD context
    const { data: campaign, error } = await supabase
      .from("social_campaigns")
      .select("id, role_title, jd_parsed, platforms")
      .eq("id", data.campaignId)
      .single();

    if (error || !campaign) throw new Error(error?.message ?? "Campaign not found");

    const parsed = (campaign.jd_parsed as Record<string, unknown>) ?? {};
    const prompt =
      data.prompt ??
      buildImagePrompt(parsed, campaign.role_title ?? "Open Role", data.imageInstructions);

    const dims = IMAGE_DIMS[data.platform] ?? IMAGE_DIMS.linkedin;
    const seed = Math.floor(Math.random() * 999999);
    const encodedPrompt = encodeURIComponent(prompt);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?nologo=true&width=${dims.w}&height=${dims.h}&seed=${seed}&model=flux`;

    // Fetch the generated PNG (60-second timeout — Pollinations can be slow on first call)
    const imgRes = await fetch(imageUrl, {
      signal: AbortSignal.timeout(60_000),
      headers: { Accept: "image/png" },
    });
    if (!imgRes.ok)
      throw new Error(`AI image provider returned HTTP ${imgRes.status}`);

    const contentType = imgRes.headers.get("content-type") ?? "image/png";
    if (!contentType.startsWith("image/"))
      throw new Error("AI image provider returned non-image response");

    const buffer = Buffer.from(await imgRes.arrayBuffer());

    // Upload to the existing social-campaign-media bucket
    const ext = contentType === "image/png" ? "png" : "jpg";
    const fileName = `ai-${Date.now()}.${ext}`;
    const path = mediaPath(data.campaignId, fileName);
    await uploadFile(path, buffer, contentType);

    // Register in social_campaign_media so it shows up in Campaign Media list
    await supabase.from("social_campaign_media").insert({
      campaign_id: data.campaignId,
      file_name: fileName,
      storage_path: path,
      mime_type: contentType,
    });

    // Serve a fresh signed URL to the client
    const signed_url = await getSignedUrl(path, 3600);
    return { path, signed_url, mime_type: contentType, file_name: fileName };
  });
