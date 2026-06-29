import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Plus, X, RefreshCw } from "lucide-react";
import { TopNav } from "@/components/talent/TopNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  getTargetCompaniesFn,
  addTargetCompanyFn,
  setTargetCompanyActiveFn,
  replaceCuratedCompaniesFn,
} from "@/lib/api/experienced.functions";
import { ALL_TAGS } from "@/data/target-companies";

export const Route = createFileRoute("/experienced/companies")({
  head: () => ({
    meta: [{ title: "Target Companies · Talent Radar · FlytBase" }],
  }),
  component: TargetCompanies,
});

// ---------------------------------------------------------------------------
// Tag colour map — one colour per semantic group
// ---------------------------------------------------------------------------

const TAG_COLORS: Record<string, string> = {
  // Domain
  drone:                "bg-sky-900/50 text-sky-300 border-sky-700/50",
  aerospace:            "bg-indigo-900/50 text-indigo-300 border-indigo-700/50",
  "defense-adjacent":   "bg-red-900/40 text-red-300 border-red-700/50",
  robotics:             "bg-violet-900/50 text-violet-300 border-violet-700/50",
  "autonomous-vehicles":"bg-purple-900/50 text-purple-300 border-purple-700/50",
  "embedded-systems":   "bg-cyan-900/50 text-cyan-300 border-cyan-700/50",
  "industrial-automation":"bg-orange-900/40 text-orange-300 border-orange-700/50",
  deeptech:             "bg-fuchsia-900/50 text-fuchsia-300 border-fuchsia-700/50",
  // Commercial
  "b2b-enterprise":     "bg-emerald-900/50 text-emerald-300 border-emerald-700/50",
  "global-clientele":   "bg-teal-900/50 text-teal-300 border-teal-700/50",
  "india-origin-global":"bg-green-900/50 text-green-300 border-green-700/50",
  "mission-critical":   "bg-amber-900/40 text-amber-300 border-amber-700/50",
  // Culture / size
  startup:              "bg-pink-900/40 text-pink-300 border-pink-700/50",
  "high-agency":        "bg-rose-900/40 text-rose-300 border-rose-700/50",
  "fast-growth":        "bg-lime-900/40 text-lime-300 border-lime-700/50",
  large:                "bg-zinc-700/60 text-zinc-300 border-zinc-600/50",
  "mid-size":           "bg-zinc-800/60 text-zinc-400 border-zinc-700/50",
};

function TagChip({ tag, onRemove, onClick, selected }: {
  tag: string;
  onRemove?: () => void;
  onClick?: () => void;
  selected?: boolean;
}) {
  const base = TAG_COLORS[tag] ?? "bg-accent text-accent-foreground border-border";
  return (
    <span
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none",
        base,
        onClick && "cursor-pointer hover:opacity-80",
        selected && "ring-1 ring-white/40",
      )}
    >
      {tag}
      {onRemove && (
        <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="hover:text-white ml-0.5">
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Add company form
// ---------------------------------------------------------------------------

const EMPTY_FORM = { name: "", linkedin_url: "", industry: "", why_similar: "", tags: [] as string[] };

function AddCompanyForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);

  const { mutate: addCompany, isPending, error } = useMutation({
    mutationFn: () => addTargetCompanyFn({ data: {
      name:         form.name.trim(),
      linkedin_url: form.linkedin_url.trim(),
      industry:     form.industry.trim() || undefined,
      why_similar:  form.why_similar.trim() || undefined,
      tags:         form.tags,
    }}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["target-companies"] });
      onDone();
    },
  });

  const toggleTag = (tag: string) =>
    setForm((f) => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter((t) => t !== tag) : [...f.tags, tag],
    }));

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
            placeholder="e.g. Quest Global"
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
            placeholder="e.g. Engineering Services"
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Description</Label>
          <Input
            value={form.why_similar}
            onChange={(e) => setForm((f) => ({ ...f, why_similar: e.target.value }))}
            placeholder="Why is this a target company?"
            className="h-8 text-xs"
          />
        </div>
      </div>

      <div className="mb-3">
        <Label className="text-xs mb-1.5 block">Tags</Label>
        <div className="flex flex-wrap gap-1.5">
          {ALL_TAGS.map((tag) => (
            <button key={tag} onClick={() => toggleTag(tag)}>
              <TagChip tag={tag} selected={form.tags.includes(tag)} />
            </button>
          ))}
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
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [confirmReplace, setConfirmReplace] = useState(false);

  const { data: companies, isLoading, error } = useQuery({
    queryKey: ["target-companies"],
    queryFn: () => getTargetCompaniesFn(),
  });

  const { mutate: toggleActive } = useMutation({
    mutationFn: (vars: { id: string; is_active: boolean }) =>
      setTargetCompanyActiveFn({ data: vars }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["target-companies"] }),
  });

  const { mutate: loadCurated, isPending: loadingCurated, error: curatedError } = useMutation({
    mutationFn: () => replaceCuratedCompaniesFn(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["target-companies"] });
      setConfirmReplace(false);
    },
  });

  const toggleTagFilter = (tag: string) =>
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );

  const filtered = (companies ?? []).filter((c) => {
    if (!showInactive && !c.is_active) return false;
    if (selectedTags.length > 0) {
      const cTags = c.tags ?? [];
      if (!selectedTags.every((t) => cTags.includes(t))) return false;
    }
    if (search) {
      const hay = [c.name, c.industry, c.why_similar, ...(c.tags ?? [])].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(search.toLowerCase())) return false;
    }
    return true;
  });

  const activeCount = (companies ?? []).filter((c) => c.is_active).length;

  // Count companies per tag (for active companies only)
  const tagCounts = new Map<string, number>();
  for (const c of (companies ?? []).filter((x) => x.is_active)) {
    for (const t of c.tags ?? []) {
      tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopNav health="fail" hideCompetitions />

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Target Companies</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {activeCount} active {activeCount === 1 ? "company" : "companies"} · {filtered.length} shown
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
            {!confirmReplace ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs text-amber-400 border-amber-700/50 hover:bg-amber-900/20"
                onClick={() => setConfirmReplace(true)}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Load Curated List
              </Button>
            ) : (
              <div className="flex items-center gap-2 rounded-md border border-amber-700/50 bg-amber-900/20 px-3 py-1.5">
                <span className="text-xs text-amber-300">Replace all companies?</span>
                <Button
                  size="sm"
                  className="h-6 px-2 text-xs bg-amber-600 hover:bg-amber-500 text-white"
                  onClick={() => loadCurated()}
                  disabled={loadingCurated}
                >
                  {loadingCurated ? "Loading…" : "Confirm"}
                </Button>
                <button
                  onClick={() => setConfirmReplace(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <Link to="/experienced">
              <Button variant="outline" size="sm" className="gap-1.5">
                <ArrowLeft className="h-3.5 w-3.5" />
                Campaigns
              </Button>
            </Link>
          </div>
        </div>

        {curatedError && (
          <p className="text-xs text-destructive mb-3">
            {curatedError instanceof Error ? curatedError.message : "Failed to load curated list."}
          </p>
        )}

        {/* Add form */}
        {showForm && <AddCompanyForm onDone={() => setShowForm(false)} />}

        {/* Tag filter */}
        <div className="mb-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2">
            Filter by tag {selectedTags.length > 0 && `· ${selectedTags.length} active`}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {ALL_TAGS.map((tag) => {
              const count = tagCounts.get(tag) ?? 0;
              if (count === 0) return null;
              return (
                <button key={tag} onClick={() => toggleTagFilter(tag)}>
                  <span className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none transition-opacity",
                    TAG_COLORS[tag] ?? "bg-accent text-accent-foreground border-border",
                    selectedTags.includes(tag) ? "ring-1 ring-white/50 opacity-100" : "opacity-60 hover:opacity-90",
                  )}>
                    {tag}
                    <span className="opacity-70">·{count}</span>
                  </span>
                </button>
              );
            })}
            {selectedTags.length > 0 && (
              <button
                onClick={() => setSelectedTags([])}
                className="text-xs text-muted-foreground hover:text-foreground px-2"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Search + inactive toggle */}
        <div className="flex items-center gap-2 mb-4">
          <Input
            placeholder="Search name, industry, tag…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-xs w-64"
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
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground w-44">Company</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Tags</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground w-64 hidden xl:table-cell">Description</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground w-16">Link</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground w-20">Status</th>
                  <th className="px-4 py-2.5 w-20" />
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
                      !c.is_active && "opacity-40",
                      i % 2 === 0 ? "bg-background" : "bg-muted/10",
                    )}
                  >
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-xs">{c.name}</div>
                      {c.industry && (
                        <div className="text-[11px] text-muted-foreground mt-0.5">{c.industry}</div>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {(c.tags ?? []).map((tag) => (
                          <TagChip key={tag} tag={tag} />
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 hidden xl:table-cell">
                      {c.why_similar ? (
                        <span className="text-xs text-muted-foreground line-clamp-2">{c.why_similar}</span>
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
