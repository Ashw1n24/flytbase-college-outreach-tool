import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Plus, X } from "lucide-react";
import { TopNav } from "@/components/talent/TopNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  getTargetCompaniesFn,
  addTargetCompanyFn,
  setTargetCompanyActiveFn,
  updateTargetCompanyFn,
} from "@/lib/api/experienced.functions";

export const Route = createFileRoute("/experienced/companies")({
  head: () => ({
    meta: [{ title: "Target Companies · Talent Radar · FlytBase" }],
  }),
  component: TargetCompanies,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractOneSentenceDescription(markdown: string): string {
  const text = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#*`>_~\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 20);

  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    if (
      lower.includes("company") ||
      lower.includes("business") ||
      lower.includes("platform") ||
      lower.includes("build") ||
      lower.includes("provide") ||
      lower.includes("software") ||
      lower.includes("service")
    ) {
      return sentence;
    }
  }

  return sentences[0] || "";
}

// ---------------------------------------------------------------------------
// Add company form
// ---------------------------------------------------------------------------

const EMPTY_FORM = { name: "", linkedin_url: "", industry: "", why_similar: "" };

function AddCompanyForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);

  const { mutate: addCompany, isPending, error } = useMutation({
    mutationFn: () => addTargetCompanyFn({ data: {
      name:         form.name.trim(),
      linkedin_url: form.linkedin_url.trim(),
      industry:     form.industry.trim() || undefined,
      why_similar:  form.why_similar.trim() || undefined,
    }}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["target-companies"] });
      onDone();
    },
  });

  const canSubmit = form.name.trim() && form.linkedin_url.trim();

  return (
    <div className="rounded-lg border border-border bg-card p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium">Add Company</p>
        <button onClick={onDone} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Company Name *</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. FlytBase"
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">LinkedIn URL *</Label>
          <Input
            value={form.linkedin_url}
            onChange={(e) => setForm((f) => ({ ...f, linkedin_url: e.target.value }))}
            placeholder="https://linkedin.com/company/…"
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Industry</Label>
          <Input
            value={form.industry}
            onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}
            placeholder="e.g. Drone Software"
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Why Similar</Label>
          <Input
            value={form.why_similar}
            onChange={(e) => setForm((f) => ({ ...f, why_similar: e.target.value }))}
            placeholder="e.g. B2B SaaS India"
            className="h-8 text-xs"
          />
        </div>
      </div>

      {error && (
        <p className="text-xs text-destructive mb-2">
          {error instanceof Error ? error.message : "Failed to add company."}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onDone} disabled={isPending}>
          Cancel
        </Button>
        <Button size="sm" onClick={() => addCompany()} disabled={!canSubmit || isPending}>
          {isPending ? "Saving…" : "Add"}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function TargetCompanies() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [enrichStatus, setEnrichStatus] = useState<string | null>(null);

  const { data: companies, isLoading, error } = useQuery({
    queryKey: ["target-companies"],
    queryFn: () => getTargetCompaniesFn(),
  });

  const { mutate: toggleActive } = useMutation({
    mutationFn: (vars: { id: string; is_active: boolean }) =>
      setTargetCompanyActiveFn({ data: vars }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["target-companies"] }),
  });
  const filtered = (companies ?? []).filter((c) => {
    if (!showInactive && !c.is_active) return false;

    if (search) {
      const hay = [c.name, c.industry, c.why_similar].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(search.toLowerCase())) return false;
    }
    return true;
  });

  const activeCount = (companies ?? []).filter((c) => c.is_active).length;

  const GENERIC_TEXTS = new Set([
    "b2b saas india",
    "saas",
    "tech",
    "software",
    "education",
    "it services",
    "internet",
    "" ,
  ]);

  const isGenericWhySimilar = (value: string | null | undefined) => {
    if (!value) return true;
    return GENERIC_TEXTS.has(value.trim().toLowerCase());
  };

  const homepageUrl = (url: string) => {
    try {
      const u = new URL(url);
      return `${u.protocol}//${u.hostname}/`;
    } catch {
      return url;
    }
  };

  const enrichTargetCompanies = async () => {
    const candidates = (companies ?? []).filter((c) => {
      if (!c.linkedin_url) return false;
      return isGenericWhySimilar(c.why_similar);
    });

    if (!candidates.length) {
      setEnrichStatus("No eligible companies to enrich.");
      return;
    }
    const limit = Math.min(candidates.length, 50);
    const run = candidates.slice(0, limit);
    setEnriching(true);
    setEnrichStatus(`Enriching 0/${run.length}…`);
    let done = 0;
    let failed = 0;

    for (const company of run) {
      try {
        const page = await fetch("/api/firecrawl/+server", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url: homepageUrl(company.linkedin_url) }),
        });
        const data = await page.json();
        if (!page.ok || data?.success === false) {
          throw new Error(data?.error || `HTTP ${page.status}`);
        }
        const markdown = (data?.markdown as string) || "";
        const description = extractOneSentenceDescription(markdown).trim();
        if (!description) {
          failed++;
        } else {
          await updateTargetCompanyFn({
            data: { id: company.id, updates: { why_similar: description } },
          });
        }
      } catch (err) {
        console.error(`[enrich] ${company.name}`, err);
        failed++;
      } finally {
        done += 1;
        setEnrichStatus(`Enriched ${done}/${run.length}${failed ? ` (${failed} failed)` : ""}…`);
      }
    }

    setEnriching(false);
    setEnrichStatus(
      `Done. Updated ${run.length - failed} of ${run.length} shown companies.${failed ? ` ${failed} skipped.` : ""}`,
    );
    void queryClient.invalidateQueries({ queryKey: ["target-companies"] });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopNav health="fail" hideCompetitions />

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Target Companies</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {activeCount} active {activeCount === 1 ? "company" : "companies"} used to filter candidate searches.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => setShowForm(true)}
              disabled={showForm}
            >
              <Plus className="h-3.5 w-3.5" />
              Add Company
            </Button>
            <Link to="/experienced">
              <Button variant="outline" size="sm" className="gap-1.5">
                <ArrowLeft className="h-3.5 w-3.5" />
                All Campaigns
              </Button>
            </Link>
          </div>
        </div>

        {/* Add form */}
        {showForm && <AddCompanyForm onDone={() => setShowForm(false)} />}

        {/* Enrichment */}
        <div className="flex items-center gap-3 mb-4">
          <Button
            variant="secondary"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={enrichTargetCompanies}
            disabled={enriching}
          >
            Enrich Descriptions
          </Button>
          {enrichStatus && (
            <span className="text-xs text-muted-foreground">{enrichStatus}</span>
          )}
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-2 mb-4">
          <Input
            placeholder="Search name, industry, tag…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-xs w-60"
          />
          <button
            onClick={() => setShowInactive((v) => !v)}
            className={cn(
              "h-8 px-3 rounded-md text-xs border transition-colors",
              showInactive
                ? "bg-foreground text-background border-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {showInactive ? "Hiding inactive" : "Show inactive"}
          </button>
          {search && (
            <button
              onClick={() => setSearch("")}
              className="h-8 px-3 rounded-md text-xs text-muted-foreground hover:text-foreground border border-border transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {/* Count */}
        {!isLoading && !error && (
          <p className="text-xs text-muted-foreground mb-3">
            {filtered.length} {filtered.length === 1 ? "company" : "companies"}
          </p>
        )}

        {/* States */}
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {error && (
          <p className="text-sm text-destructive">
            {error instanceof Error ? error.message : "Failed to load companies."}
          </p>
        )}

        {/* Table */}
        {!isLoading && !error && (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Company</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Industry</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Why Similar</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">LinkedIn</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Status</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                      No companies found.
                    </td>
                  </tr>
                )}
                {filtered.map((c, i) => (
                  <tr
                    key={c.id}
                    className={cn(
                      "border-b border-border last:border-0",
                      !c.is_active && "opacity-50",
                      i % 2 === 0 ? "bg-background" : "bg-muted/20",
                    )}
                  >
                    <td className="px-4 py-2.5 font-medium text-xs">{c.name}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{c.industry ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      {c.why_similar ? (
                        <span className="inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-[11px] text-accent-foreground">
                          {c.why_similar}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
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
                    <td className="px-4 py-2.5">
                      <span className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                        c.is_active
                          ? "bg-ok/15 text-ok border border-ok/30"
                          : "bg-muted text-muted-foreground border border-border",
                      )}>
                        {c.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => toggleActive({ id: c.id, is_active: !c.is_active })}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {c.is_active ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
