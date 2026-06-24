import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import {
  ArrowLeft, Download, ExternalLink, Loader2,
  Trash2, FolderPlus, Send, ChevronDown, Check,
} from "lucide-react";
import { TopNav } from "@/components/talent/TopNav";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  getAllCandidatesFn, getCampaignsFn, seedTargetCompaniesFn,
  archiveExpCandidateFn,
} from "@/lib/api/experienced.functions";
import {
  addToOutreachQueueFn, getOutreachTemplatesFn,
} from "@/lib/api/outreach.functions";
import { useTalent } from "@/context/TalentContext";

export const Route = createFileRoute("/experienced/candidates")({
  head: () => ({
    meta: [{ title: "Master Candidate Database · Talent Radar · FlytBase" }],
  }),
  component: MasterDatabase,
});

// ---------------------------------------------------------------------------
// Role bucket helpers
// ---------------------------------------------------------------------------

type RoleBucket = "Engineering" | "AI / ML" | "Product" | "Sales / GTM" | "Design" | "Leadership" | "Other";

const ROLE_BUCKETS: { label: RoleBucket; keywords: RegExp }[] = [
  {
    label: "AI / ML",
    keywords: /\b(ai|ml|machine.?learning|deep.?learning|llm|nlp|data.?sci|computer.?vision|agentic|gen.?ai|genai|artificial.?intel)\b/i,
  },
  {
    label: "Engineering",
    keywords: /\b(engineer|developer|dev|swe|sde|backend|frontend|front.end|full.?stack|platform|infra|devops|sre|architect|coder|programmer|software|mobile|android|ios|react|node|python|java|golang|rust|cloud|firmware|embedded|hardware|robotics|drone)\b/i,
  },
  {
    label: "Product",
    keywords: /\b(product.?manager|product.?owner|pm\b|product.?lead|product.?head|product.?director|product.?vp|product.?strategy|program.?manager)\b/i,
  },
  {
    label: "Sales / GTM",
    keywords: /\b(sales|account.?exec|account.?manager|business.?dev|bdr|sdr|sdr|ae\b|gtm|go.?to.?market|revenue|outbound|growth.?hacker|demand.?gen|partnerships|channel.?sales)\b/i,
  },
  {
    label: "Design",
    keywords: /\b(design|ux|ui|user.?experience|user.?interface|figma|product.?design|visual|brand|motion|graphic)\b/i,
  },
  {
    label: "Leadership",
    keywords: /\b(vp|avp|svp|evp|head.?of|director|cto|ceo|coo|cpo|chief|founder|co.?founder|president|managing.?director|gm\b|general.?manager)\b/i,
  },
];

function getRoleBucket(title: string | null): RoleBucket {
  if (!title) return "Other";
  // Test in order — first match wins (AI/ML before Engineering so "AI Engineer" → AI/ML)
  for (const { label, keywords } of ROLE_BUCKETS) {
    if (keywords.test(title)) return label;
  }
  return "Other";
}

const ALL_BUCKETS: RoleBucket[] = [
  "Engineering", "AI / ML", "Product", "Sales / GTM", "Design", "Leadership", "Other",
];

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
// Add to Pipeline dialog
// ---------------------------------------------------------------------------

function AddToPipelineDialog({
  open,
  onClose,
  candidateIds,
}: {
  open: boolean;
  onClose: () => void;
  candidateIds: string[];
}) {
  const { pipelines, addToExpPipeline, createPipeline } = useTalent();
  const [pipelineId, setPipelineId] = useState(pipelines[0]?.id ?? "");
  const [creating, setCreating]     = useState(false);
  const [newName, setNewName]       = useState("");

  useEffect(() => {
    if (pipelines.length > 0 && !pipelineId) setPipelineId(pipelines[0].id);
  }, [pipelines.length]);

  // Reset create form when dialog opens/closes
  useEffect(() => {
    if (!open) { setCreating(false); setNewName(""); }
  }, [open]);

  const handleConfirm = () => {
    candidateIds.forEach((id) => addToExpPipeline(id, pipelineId));
    onClose();
  };

  const handleCreateAndAdd = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const p = createPipeline(trimmed);
    candidateIds.forEach((id) => addToExpPipeline(id, p.id));
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Add to Pipeline</DialogTitle>
          <DialogDescription>
            {candidateIds.length} candidate{candidateIds.length !== 1 ? "s" : ""} will be added to the selected pipeline.
          </DialogDescription>
        </DialogHeader>

        {!creating ? (
          <>
            <div className="space-y-2 py-1">
              {pipelines.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPipelineId(p.id)}
                  className={cn(
                    "w-full text-left rounded-md border px-3 py-2.5 text-xs transition-colors",
                    pipelineId === p.id
                      ? "border-primary bg-primary/10 font-medium"
                      : "border-border text-muted-foreground hover:border-primary/40",
                  )}
                >
                  {p.name}
                </button>
              ))}
              <button
                onClick={() => setCreating(true)}
                className="w-full text-left rounded-md border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors flex items-center gap-1.5"
              >
                <FolderPlus className="h-3.5 w-3.5" />
                Create new pipeline…
              </button>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
              <Button size="sm" onClick={handleConfirm} disabled={!pipelineId}>
                <Check className="h-3.5 w-3.5 mr-1.5" />
                Add to Pipeline
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2 py-1">
              <p className="text-xs text-muted-foreground">New pipeline name:</p>
              <Input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateAndAdd()}
                placeholder="e.g. Agentic AI Engineer — 2026"
                className="h-8 text-xs"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setCreating(false)}>
                Back
              </Button>
              <Button size="sm" onClick={handleCreateAndAdd} disabled={!newName.trim()}>
                <FolderPlus className="h-3.5 w-3.5 mr-1.5" />
                Create &amp; Add
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Outreach Queue dialog (inline, for master DB)
// ---------------------------------------------------------------------------

function OutreachQueueDialog({
  open,
  onClose,
  candidateIds,
}: {
  open: boolean;
  onClose: () => void;
  candidateIds: string[];
}) {
  const [channel, setChannel]       = useState<"email" | "linkedin">("email");
  const [templateId, setTemplateId] = useState("");

  const { data: templates } = useQuery({
    queryKey: ["outreach-templates"],
    queryFn:  () => getOutreachTemplatesFn(),
    enabled:  open,
  });

  const filteredTemplates = (templates ?? []).filter(
    (t) =>
      (t.pipeline === "experienced" || t.pipeline === "both") &&
      t.message_type === "initial" &&
      t.channel === channel,
  );

  useEffect(() => {
    if (filteredTemplates.length > 0 && !filteredTemplates.find((t) => t.id === templateId)) {
      setTemplateId(filteredTemplates[0].id);
    }
  }, [channel, filteredTemplates.length]);

  const queueMutation = useMutation({
    mutationFn: () =>
      addToOutreachQueueFn({ data: { candidateIds, candidateType: "experienced", channel, templateId } }),
    onSuccess: (result) => {
      alert(`Queued ${result.queued} candidate(s) as drafts. ${result.skipped} skipped.`);
      onClose();
    },
  });

  const selectedTemplate = filteredTemplates.find((t) => t.id === templateId);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Queue for Outreach</DialogTitle>
          <DialogDescription>
            {candidateIds.length} candidate{candidateIds.length !== 1 ? "s" : ""} → outreach drafts
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Channel */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Channel</p>
            <div className="flex gap-2">
              {(["email", "linkedin"] as const).map((ch) => (
                <button
                  key={ch}
                  onClick={() => setChannel(ch)}
                  className={cn(
                    "flex-1 rounded-md border px-3 py-2 text-xs capitalize transition-colors",
                    channel === ch
                      ? "border-primary bg-primary/10 font-medium"
                      : "border-border text-muted-foreground hover:border-primary/40",
                  )}
                >
                  {ch}
                </button>
              ))}
            </div>
          </div>

          {/* Template picker */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Template</p>
            {filteredTemplates.length === 0 ? (
              <p className="text-xs text-muted-foreground">No templates for this channel.</p>
            ) : (
              <div className="space-y-1.5">
                {filteredTemplates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTemplateId(t.id)}
                    className={cn(
                      "w-full text-left rounded-md border px-3 py-2 text-xs transition-colors",
                      templateId === t.id
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/40",
                    )}
                  >
                    <span className="font-medium">{t.name}</span>
                    {t.subject_template && (
                      <span className="block text-muted-foreground mt-0.5 truncate">{t.subject_template}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Template preview */}
          {selectedTemplate?.body_template && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Preview</p>
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2.5 text-[11px] text-muted-foreground whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                {selectedTemplate.body_template}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Variables like <span className="font-mono">{"{{candidate_name}}"}</span> will be filled per candidate when sent.
              </p>
            </div>
          )}

          {queueMutation.error && (
            <p className="text-xs text-destructive">
              {queueMutation.error instanceof Error ? queueMutation.error.message : "Failed"}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={queueMutation.isPending}>Cancel</Button>
          <Button
            size="sm"
            onClick={() => queueMutation.mutate()}
            disabled={!templateId || queueMutation.isPending}
          >
            {queueMutation.isPending ? "Queuing…" : "Queue"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function MasterDatabase() {
  const queryClient = useQueryClient();

  const [search, setSearch]               = useState("");
  const [tierFilter, setTierFilter]       = useState<FitTier | "">("");
  const [campaignFilter, setCampaignFilter] = useState("");
  const [bucketFilter, setBucketFilter]   = useState<RoleBucket | "">("");
  const [scoreMin, setScoreMin]           = useState(0);

  // Selection
  const [selected, setSelected]           = useState<Set<string>>(new Set());
  const [pipelineOpen, setPipelineOpen]   = useState(false);
  const [outreachOpen, setOutreachOpen]   = useState(false);

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

  const archiveMutation = useMutation({
    mutationFn: (ids: string[]) => archiveExpCandidateFn({ data: { ids, archive: true } }),
    onSuccess: () => {
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["all-candidates"] });
    },
  });

  // Bucket counts (only over unfiltered data, for display)
  const bucketCounts = useMemo(() => {
    if (!candidates) return {} as Record<RoleBucket, number>;
    const counts: Record<string, number> = {};
    for (const c of candidates) {
      const b = getRoleBucket(c.current_title);
      counts[b] = (counts[b] ?? 0) + 1;
    }
    return counts as Record<RoleBucket, number>;
  }, [candidates]);

  const filtered = useMemo(() => {
    if (!candidates) return [];
    const q = search.toLowerCase();
    return candidates.filter((c) => {
      if (tierFilter && c.fit_tier !== tierFilter) return false;
      if (campaignFilter && c.campaign_id !== campaignFilter) return false;
      if (bucketFilter && getRoleBucket(c.current_title) !== bucketFilter) return false;
      if (scoreMin > 0 && (c.fit_score ?? 0) < scoreMin) return false;
      if (q) {
        const hay = [c.full_name, c.current_title, c.current_company, c.campaign_name]
          .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [candidates, search, tierFilter, campaignFilter, bucketFilter, scoreMin]);

  const allFilteredIds = filtered.map((c) => c.id);
  const allSelected = filtered.length > 0 && selected.size === filtered.length;

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allFilteredIds));
    }
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const selectedList = [...selected];

  const hasAnyFilter = !!(search || tierFilter || campaignFilter || bucketFilter || scoreMin > 0);

  const clearFilters = () => {
    setSearch(""); setTierFilter(""); setCampaignFilter(""); setBucketFilter(""); setScoreMin(0);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopNav health="fail" hideCompetitions />

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Master Candidate Database</h1>
            <p className="text-sm text-muted-foreground mt-0.5">All candidates across every campaign.</p>
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
                const header = ["candidate_name", "role", "company", "score", "fit_tier", "email", "linkedin_url", "campaign_name"];
                const escape = (v: unknown) => {
                  const t = String(v ?? "");
                  return /[,"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
                };
                const csv = [
                  header.join(","),
                  ...rows.map((c) => [
                    escape(c.full_name),
                    escape(c.current_title),
                    escape(c.current_company),
                    escape(c.fit_score),
                    escape(c.fit_tier),
                    escape((c as { email?: string }).email ?? ""),
                    escape(c.linkedin_url),
                    escape(c.campaign_name),
                  ].join(",")),
                ].join("\n");
                const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url; a.download = "master-candidates.csv"; a.click();
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
            placeholder="Search name, role, company…"
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

          {/* Score filter */}
          <div className="flex gap-1">
            {([0, 30, 50, 75] as const).map((min) => (
              <button
                key={min}
                onClick={() => setScoreMin(min)}
                className={cn(
                  "h-8 px-3 rounded-md text-xs border transition-colors",
                  scoreMin === min
                    ? "bg-foreground text-background border-foreground"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/40",
                )}
              >
                {min === 0 ? "Any score" : `${min}+`}
              </button>
            ))}
          </div>

          {/* Role bucket filter */}
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setBucketFilter("")}
              className={cn(
                "h-8 px-3 rounded-md text-xs border transition-colors",
                bucketFilter === ""
                  ? "bg-foreground text-background border-foreground"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/40",
              )}
            >
              All roles
            </button>
            {ALL_BUCKETS.filter((b) => (bucketCounts[b] ?? 0) > 0).map((bucket) => (
              <button
                key={bucket}
                onClick={() => setBucketFilter(bucket === bucketFilter ? "" : bucket)}
                className={cn(
                  "h-8 px-3 rounded-md text-xs border transition-colors flex items-center gap-1.5",
                  bucketFilter === bucket
                    ? "bg-foreground text-background border-foreground"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/40",
                )}
              >
                {bucket}
                <span className={cn(
                  "rounded px-1 py-0 text-[10px]",
                  bucketFilter === bucket ? "bg-background/20" : "bg-muted",
                )}>
                  {bucketCounts[bucket] ?? 0}
                </span>
              </button>
            ))}
          </div>

          {/* Campaign filter */}
          <div className="relative">
            <select
              value={campaignFilter}
              onChange={(e) => setCampaignFilter(e.target.value)}
              className="h-8 rounded-md border border-border bg-background pl-2 pr-7 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring appearance-none"
            >
              <option value="">All campaigns</option>
              {(campaigns ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          </div>

          {hasAnyFilter && (
            <button
              onClick={clearFilters}
              className="h-8 px-3 rounded-md text-xs text-muted-foreground hover:text-foreground border border-border transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {/* Count + bulk actions */}
        <div className="flex items-center justify-between mb-3">
          {!isLoading && !error && (
            <p className="text-xs text-muted-foreground">
              {filtered.length} candidate{filtered.length !== 1 ? "s" : ""}
              {candidates && filtered.length !== candidates.length ? ` of ${candidates.length}` : ""}
            </p>
          )}
          {selected.size > 0 && (
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-muted-foreground">{selected.size} selected</span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1.5 text-xs"
                onClick={() => setPipelineOpen(true)}
              >
                <FolderPlus className="h-3.5 w-3.5" />
                Add to Pipeline
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1.5 text-xs"
                onClick={() => setOutreachOpen(true)}
              >
                <Send className="h-3.5 w-3.5" />
                Queue for Outreach
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1.5 text-xs text-destructive hover:text-destructive"
                onClick={() => {
                  if (confirm(`Archive ${selectedList.length} candidate(s)? They will be hidden from this view.`)) {
                    archiveMutation.mutate(selectedList);
                  }
                }}
                disabled={archiveMutation.isPending}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Archive
              </Button>
            </div>
          )}
        </div>

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
                  <th className="px-3 py-2.5 w-8">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      className="h-3.5 w-3.5 rounded accent-primary cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Name</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Role</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Company</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Score</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Tier</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Campaign</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">LinkedIn</th>
                  <th className="px-3 py-2.5 w-8" />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-sm text-muted-foreground">
                      No candidates found.
                    </td>
                  </tr>
                )}
                {filtered.map((c, i) => {
                  const tier = c.fit_tier as FitTier | null;
                  const isSelected = selected.has(c.id);
                  return (
                    <tr
                      key={c.id}
                      onClick={() => toggleOne(c.id)}
                      className={cn(
                        "border-b border-border last:border-0 cursor-pointer transition-colors",
                        isSelected
                          ? "bg-primary/5"
                          : i % 2 === 0 ? "bg-background hover:bg-muted/20" : "bg-muted/20 hover:bg-muted/30",
                      )}
                    >
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleOne(c.id)}
                          className="h-3.5 w-3.5 rounded accent-primary cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-2.5 font-medium text-xs">{c.full_name ?? "—"}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-[180px] truncate">{c.current_title ?? "—"}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{c.current_company ?? "—"}</td>
                      <td className="px-4 py-2.5 text-xs font-mono">
                        {c.fit_score != null ? (
                          <span className={cn(
                            "font-semibold tabular-nums",
                            c.fit_score >= 75 ? "text-ok" : c.fit_score >= 50 ? "text-blue-400" : "text-muted-foreground",
                          )}>
                            {c.fit_score}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        {tier && TIER_META[tier] ? (
                          <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium border", TIER_META[tier].badge)}>
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
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          title="Archive candidate"
                          onClick={() => {
                            if (confirm(`Archive ${c.full_name}? They will be hidden from this view.`)) {
                              archiveMutation.mutate([c.id]);
                            }
                          }}
                          disabled={archiveMutation.isPending}
                          className="text-muted-foreground/40 hover:text-destructive transition-colors disabled:opacity-30"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AddToPipelineDialog
        open={pipelineOpen}
        onClose={() => { setPipelineOpen(false); setSelected(new Set()); }}
        candidateIds={selectedList}
      />
      <OutreachQueueDialog
        open={outreachOpen}
        onClose={() => setOutreachOpen(false)}
        candidateIds={selectedList}
      />
    </div>
  );
}
