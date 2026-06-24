import { createServerFn } from "@tanstack/react-start";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseAdmin } from "@/lib/supabase.server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ---------------------------------------------------------------------------
// Individual checks
// ---------------------------------------------------------------------------

async function checkSupabase() {
  const t = Date.now();
  try {
    const supabase = getSupabaseAdmin();
    const [r1, r2, r3] = await Promise.all([
      supabase.from("candidates").select("*", { count: "exact", head: true }),
      supabase.from("experienced_candidates").select("*", { count: "exact", head: true }),
      supabase.from("campaigns").select("*", { count: "exact", head: true }),
    ]);
    if (r1.error) throw new Error(r1.error.message);
    const candidates = r1.count ?? 0;
    const experienced = r2.count ?? 0;
    const campaigns = r3.count ?? 0;
    return {
      id: "supabase",
      name: "Supabase (Postgres)",
      status: "ok" as const,
      latencyMs: Date.now() - t,
      detail: `${candidates} students · ${experienced} experienced · ${campaigns} campaigns`,
      counts: { candidates, experienced, campaigns },
    };
  } catch (e) {
    return {
      id: "supabase",
      name: "Supabase (Postgres)",
      status: "fail" as const,
      latencyMs: Date.now() - t,
      detail: String(e),
      counts: { candidates: 0, experienced: 0, campaigns: 0 },
    };
  }
}

async function checkApify() {
  const t = Date.now();
  const token = process.env.APIFY_API_KEY;
  if (!token) {
    return {
      id: "apify",
      name: "Apify",
      status: "fail" as const,
      latencyMs: 0,
      detail: "APIFY_API_KEY not configured",
      credits: null as null | { totalUsd: number; usedUsd: number },
    };
  }
  try {
    // Fetch user profile + monthly limits in parallel
    const [userRes, limitsRes] = await Promise.all([
      fetch(`https://api.apify.com/v2/users/me?token=${token}`),
      fetch(`https://api.apify.com/v2/account/limits?token=${token}`),
    ]);
    if (!userRes.ok) throw new Error(`HTTP ${userRes.status} ${userRes.statusText}`);

    const userJson = await userRes.json() as {
      data?: {
        username?: string;
        plan?: {
          monthlyUsageCreditsCents?: number;
          availableMonthlyUsageUsd?: number;
          usedMonthlyUsageUsd?: number;
        };
      };
    };

    // /account/limits returns current period usage in compute units and USD
    let cuTotal: number | null = null;
    let cuUsed: number | null = null;
    if (limitsRes.ok) {
      const limitsJson = await limitsRes.json() as {
        data?: {
          currentBillingPeriod?: {
            usageUsd?: number;
            limitUsd?: number;
          };
          monthlyUsageCreditsCents?: number;
          currentMonthlyUsageUsd?: number;
        };
      };
      const period = limitsJson?.data?.currentBillingPeriod;
      if (period?.limitUsd !== undefined) {
        cuTotal = period.limitUsd;
        cuUsed  = period.usageUsd ?? 0;
      } else if (limitsJson?.data?.currentMonthlyUsageUsd !== undefined) {
        // fallback: use plan credits from profile
        const plan = userJson?.data?.plan;
        const centsTotal = limitsJson.data.monthlyUsageCreditsCents
          ?? plan?.monthlyUsageCreditsCents
          ?? null;
        cuTotal = centsTotal !== null ? centsTotal / 100 : null;
        cuUsed  = limitsJson.data.currentMonthlyUsageUsd ?? 0;
      }
    }

    // Final fallback: pull from user profile plan fields
    if (cuTotal === null) {
      const plan = userJson?.data?.plan;
      cuTotal = plan?.availableMonthlyUsageUsd ?? null;
      cuUsed  = plan?.usedMonthlyUsageUsd ?? 0;
    }

    const username = userJson?.data?.username ?? "unknown";
    const detail =
      cuTotal !== null
        ? `$${(cuTotal - (cuUsed ?? 0)).toFixed(2)} of $${cuTotal.toFixed(2)} remaining this month`
        : `Connected as ${username}`;

    return {
      id: "apify",
      name: "Apify",
      status: "ok" as const,
      latencyMs: Date.now() - t,
      detail,
      credits: cuTotal !== null ? { totalUsd: cuTotal, usedUsd: cuUsed ?? 0 } : null,
    };
  } catch (e) {
    return {
      id: "apify",
      name: "Apify",
      status: "fail" as const,
      latencyMs: Date.now() - t,
      detail: String(e),
      credits: null as null | { totalUsd: number; usedUsd: number },
    };
  }
}

async function checkAnthropic() {
  const t = Date.now();
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      id: "anthropic",
      name: "Anthropic (Claude)",
      status: "fail" as const,
      latencyMs: 0,
      detail: "ANTHROPIC_API_KEY not configured",
    };
  }
  try {
    // models.list() is a lightweight GET — no tokens consumed
    const models = await anthropic.models.list();
    const count = models.data?.length ?? 0;
    return {
      id: "anthropic",
      name: "Anthropic (Claude)",
      status: "ok" as const,
      latencyMs: Date.now() - t,
      detail: `API key valid · ${count} model${count !== 1 ? "s" : ""} accessible`,
    };
  } catch (e) {
    return {
      id: "anthropic",
      name: "Anthropic (Claude)",
      status: "fail" as const,
      latencyMs: Date.now() - t,
      detail: String(e),
    };
  }
}

// ---------------------------------------------------------------------------
// Exported server function
// ---------------------------------------------------------------------------

export type ServiceStatus = "ok" | "warn" | "fail";

export interface ServiceCheck {
  id: string;
  name: string;
  status: ServiceStatus;
  latencyMs: number;
  detail: string;
  counts?: { candidates: number; experienced: number; campaigns: number };
  credits?: { totalUsd: number; usedUsd: number } | null;
}

export interface SystemHealth {
  services: ServiceCheck[];
  overallStatus: ServiceStatus;
  checkedAt: string;
}

// Lightweight Apify-only credit check (used by Re-run dialog)
export const getApifyCreditsFn = createServerFn({ method: "GET" }).handler(async () => {
  const token = process.env.APIFY_API_KEY;
  if (!token) return { configured: false, totalUsd: null, usedUsd: null, remainingUsd: null };
  try {
    const [userRes, limitsRes] = await Promise.all([
      fetch(`https://api.apify.com/v2/users/me?token=${token}`),
      fetch(`https://api.apify.com/v2/account/limits?token=${token}`),
    ]);
    const userJson = await userRes.json() as { data?: { plan?: { availableMonthlyUsageUsd?: number; usedMonthlyUsageUsd?: number } } };
    let totalUsd: number | null = null;
    let usedUsd: number | null = null;
    if (limitsRes.ok) {
      const limitsJson = await limitsRes.json() as { data?: { currentBillingPeriod?: { limitUsd?: number; usageUsd?: number } } };
      const period = limitsJson?.data?.currentBillingPeriod;
      if (period?.limitUsd !== undefined) { totalUsd = period.limitUsd; usedUsd = period.usageUsd ?? 0; }
    }
    if (totalUsd === null) {
      const plan = userJson?.data?.plan;
      totalUsd = plan?.availableMonthlyUsageUsd ?? null;
      usedUsd = plan?.usedMonthlyUsageUsd ?? 0;
    }
    const remainingUsd = totalUsd !== null ? totalUsd - (usedUsd ?? 0) : null;
    return { configured: true, totalUsd, usedUsd, remainingUsd };
  } catch {
    return { configured: true, totalUsd: null, usedUsd: null, remainingUsd: null };
  }
});

export const getSystemHealthFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<SystemHealth> => {
    const results = await Promise.allSettled([
      checkSupabase(),
      checkApify(),
      checkAnthropic(),
    ]);

    const services: ServiceCheck[] = results.map((r) => {
      if (r.status === "fulfilled") {
        return r.value as ServiceCheck;
      }
      return {
        id: "unknown",
        name: "Unknown",
        status: "fail" as const,
        latencyMs: 0,
        detail: String((r as PromiseRejectedResult).reason),
      };
    });

    const anyFail = services.some((s) => s.status === "fail");
    const anyWarn = services.some((s) => s.status === "warn");
    const overallStatus: ServiceStatus = anyFail ? "fail" : anyWarn ? "warn" : "ok";

    return { services, overallStatus, checkedAt: new Date().toISOString() };
  },
);
