import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, Download, ExternalLink, Loader2 } from "lucide-react";
import { TopNav } from "@/components/talent/TopNav";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getAllCandidatesFn, getCampaignsFn, seedTargetCompaniesFn } from "@/lib/api/experienced.functions";

export const Route = createFileRoute("/experienced/candidates")({
  head: () => ({
    meta: [{ title: "Master Candidate Database · Talent Radar · FlytBase" }],
  }),
  component: MasterDatabase,
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FitTier = "strong" | "good" | "partial";

const TIER_META: Record<FitTier, { label: string; badge: string }> = {
  strong:  { label: "Strong",  badge: "bg-ok/15 text-ok border border-ok/30" },
  good:    { label: "Good",    badge: "bg-blue-500/15 text-blue-400 border border-blue-500/30" },
  partial: { label: "Partial", badge: "bg-warn/15 text-warn border border-warn/30" },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function MasterDatabase() {
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<FitTier | "">("");
  const [campaignFilter, setCampaignFilter] = useState("");

  const { data: candidates, isLoading, error } = useQuery({
    queryKey: ["all-candidates"],
    queryFn: () => getAllCandidatesFn(),
  });

  const { data: campaigns } = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => getCampaignsFn(),
  });

  const { mutate: seedCompanies, isPending: seeding, data: seedResult } = useMutation({
    mutationFn: () => seedTargetCompaniesFn(),
  });

  const filtered = useMemo(() => {
    if (!candidates) return [];
    const q = search.toLowerCase();
    return candidates.filter((c) => {
      if (tierFilter && c.fit_tier !== tierFilter) return false;
      if (campaignFilter && c.campaign_id !== campaignFilter) return false;
      if (q) {
        const hay = [c.full_name, c.current_title, c.current_company, c.campaign_name]
          .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [candidates, search, tierFilter, campaignFilter]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopNav health="fail" hideCompetitions />

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Master Candidate Database</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              All candidates across every campaign.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {import.meta.env.DEV && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => seedCompanies()}
                  disabled={seeding}
                >
                  {seeding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  {seeding ? "Seeding…" : "Seed Companies"}
                </Button>
                {seedResult && (
                  <span className="text-xs text-muted-foreground">
                    ✓ {seedResult.inserted} inserted, {seedResult.skipped} skipped
                  </span>
                )}
              </div>
            )}
            <Button
              variant="secondary"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => {
                const rows = filtered.length ? filtered : candidates ?? [];
                const header = [
                  'candidate_name',
                  'current_title',
                  'current_company',
                  'fit_tier',
                  'fit_score',
                  'linkedin_url',
                  'campaign_name',
                ];
                const escape = (value: unknown) => {
                  const text = String(value ?? '');
                  return /[,"\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
                };
                const csv = [
                  header.join(','),
                  ...rows.map((c) => [
                    escape(c.full_name),
                    escape(c.current_title),
                    escape(c.current_company),
                    escape(c.fit_tier),
                    escape(c.fit_score),
                    escape(c.linkedin_url),
                    escape(c.campaign_name),
                  ].join(',')),
                ].join('\n');
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'master-candidates.csv';
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download className="h-3.5 w-3.5" />
              Download CSV
            </Button>
            <Link to="/experienced">
              <Button variant="outline" size="sm" className="gap-1.5">
                <ArrowLeft className="h-3.5 w-3.5" />
                All Campaigns
              </Button>
            </Link>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap gap-2 mb-4">
          <Input
            placeholder="Search name, title, company…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-xs w-60"
          />

          {/* Tier filter */}
          <div className="flex gap-1">
            {(["", "strong", "good", "partial"] as const).map((tier) => (
              <button
                key={tier}
                onClick={() => setTierFilter(tier)}
                className={cn(
                  "h-8 px-3 rounded-md text-xs border transition-colors",
                  tierFilter === tier
                    ? "bg-foreground text-background border-foreground"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/40",
                )}
              >
                {tier === "" ? "All tiers" : TIER_META[tier].label}
              </button>
            ))}
          </div>

          {/* Campaign filter */}
          <select
            value={campaignFilter}
            onChange={(e) => setCampaignFilter(e.target.value)}
            className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">All campaigns</option>
            {(campaigns ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {(search || tierFilter || campaignFilter) && (
            <button
              onClick={() => { setSearch(""); setTierFilter(""); setCampaignFilter(""); }}
              className="h-8 px-3 rounded-md text-xs text-muted-foreground hover:text-foreground border border-border transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {/* Count */}
        {!isLoading && !error && (
          <p className="text-xs text-muted-foreground mb-3">
            {filtered.length} candidate{filtered.length !== 1 ? "s" : ""}
            {candidates && filtered.length !== candidates.length
              ? ` of ${candidates.length}`
              : ""}
          </p>
        )}

        {/* States */}
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {error && (
          <p className="text-sm text-destructive">
            {error instanceof Error ? error.message : "Failed to load candidates."}
          </p>
        )}

        {/* Table */}
        {!isLoading && !error && (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Name</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Current Title</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Company</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Fit</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Campaign</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">LinkedIn</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                      No candidates found.
                    </td>
                  </tr>
                )}
                {filtered.map((c, i) => {
                  const tier = c.fit_tier as FitTier | null;
                  return (
                    <tr
                      key={c.id}
                      className={cn(
                        "border-b border-border last:border-0",
                        i % 2 === 0 ? "bg-background" : "bg-muted/20",
                      )}
                    >
                      <td className="px-4 py-2.5 font-medium text-xs">{c.full_name ?? "—"}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{c.current_title ?? "—"}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{c.current_company ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        {tier && TIER_META[tier] ? (
                          <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium", TIER_META[tier].badge)}>
                            {TIER_META[tier].label}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{c.campaign_name ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        {c.linkedin_url ? (
                          <a
                            href={c.linkedin_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
