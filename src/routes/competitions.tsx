import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Trophy,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Flag,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { TopNav } from "@/components/talent/TopNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Competition, FlaggedCompetition } from "@/lib/db/competitions.server";
import {
  getActiveCompetitionsFn,
  getPendingFlaggedFn,
  deactivateCompetitionFn,
  dismissFlaggedFn,
  approveFlaggedFn,
} from "@/lib/api/competitions.functions";

export const Route = createFileRoute("/competitions")({
  head: () => ({
    meta: [{ title: "Competitions · High-Agency Talent Engine" }],
  }),
  component: CompetitionsPage,
});

// ── Level metadata ────────────────────────────────────────────────────────────

type Level = "international" | "national" | "regional" | "institute";

const LEVEL_META: Record<Level, { label: string; bg: string; text: string }> = {
  international: { label: "International", bg: "bg-[#2E75B6]",  text: "text-white" },
  national:      { label: "National",      bg: "bg-[#217346]",  text: "text-white" },
  regional:      { label: "Regional",      bg: "bg-[#BF8F00]",  text: "text-white" },
  institute:     { label: "Institute",     bg: "bg-[#666666]",  text: "text-white" },
};

const LEVELS: Level[] = ["international", "national", "regional", "institute"];

// ── Type grouping ─────────────────────────────────────────────────────────────

const TYPE_GROUPS: { label: string; types: string[] }[] = [
  { label: "Drone / Robotics", types: ["drone", "robotics"] },
  { label: "Software / AI / Hackathons", types: ["hackathon", "open_source"] },
  { label: "Product / Design", types: ["case_comp", "design"] },
  { label: "Business / GTM", types: ["business", "quiz"] },
];

const TYPE_LABEL: Record<string, string> = {
  hackathon: "Hackathon",
  case_comp: "Case Comp",
  robotics: "Robotics",
  drone: "Drone",
  design: "Design",
  business: "Business",
  open_source: "Open Source",
  quiz: "Quiz",
};

const ROLE_CLUSTER_COLOURS: Record<string, string> = {
  software:    "bg-blue-500/15 text-blue-400 border-blue-500/30",
  product:     "bg-purple-500/15 text-purple-400 border-purple-500/30",
  business:    "bg-amber-500/15 text-amber-400 border-amber-500/30",
  generalist:  "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeDate(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function toKebab(str: string) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

// ── Keywords cell — collapsed by default, expand on hover ────────────────────

function KeywordsCell({ keywords }: { keywords: string[] | null }) {
  const [open, setOpen] = useState(false);
  if (!keywords || keywords.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <button
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={() => setOpen(o => !o)}
      className="text-left"
    >
      {open ? (
        <div className="flex flex-wrap gap-1">
          {keywords.map(kw => (
            <span key={kw} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
              {kw}
            </span>
          ))}
        </div>
      ) : (
        <span className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          {keywords.length} keyword{keywords.length !== 1 ? "s" : ""}
          <ChevronDown className="h-3 w-3" />
        </span>
      )}
    </button>
  );
}

// ── Active competitions table ─────────────────────────────────────────────────

function ActiveCompetitionsSection({ competitions, onDeactivate }: {
  competitions: Competition[];
  onDeactivate: (id: string) => void;
}) {
  const [levelFilter, setLevelFilter] = useState<Level | "all">("all");

  const visible = levelFilter === "all"
    ? competitions
    : competitions.filter(c => c.level === levelFilter);

  const grouped = TYPE_GROUPS.map(group => ({
    ...group,
    rows: visible.filter(c => group.types.includes(c.type ?? "")),
  })).filter(g => g.rows.length > 0);

  const coveredTypes = new Set(TYPE_GROUPS.flatMap(g => g.types));
  const ungrouped = visible.filter(c => !coveredTypes.has(c.type ?? ""));
  if (ungrouped.length > 0) {
    grouped.push({ label: "Other", types: [], rows: ungrouped });
  }

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h2 className="text-sm font-semibold text-foreground">
          Active Competitions
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            ({visible.length} of {competitions.length})
          </span>
        </h2>

        {/* Level filter */}
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Level:</span>
          <button
            onClick={() => setLevelFilter("all")}
            className={cn(
              "rounded px-2 py-0.5 text-xs font-medium transition-colors",
              levelFilter === "all"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            All
          </button>
          {LEVELS.map(l => {
            const meta = LEVEL_META[l];
            const active = levelFilter === l;
            return (
              <button
                key={l}
                onClick={() => setLevelFilter(active ? "all" : l)}
                className={cn(
                  "rounded px-2 py-0.5 text-xs font-medium transition-opacity",
                  meta.bg, meta.text,
                  active ? "opacity-100 ring-2 ring-offset-1 ring-offset-background ring-foreground/30" : "opacity-60 hover:opacity-90",
                )}
              >
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        {grouped.map(group => (
          <div key={group.label}>
            <h3 className="mb-1.5 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {group.label}
            </h3>
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Name</th>
                    <th className="px-4 py-2.5 font-medium">Level</th>
                    <th className="px-4 py-2.5 font-medium">Type</th>
                    <th className="px-4 py-2.5 font-medium">Role Clusters</th>
                    <th className="px-4 py-2.5 font-medium">Keywords</th>
                    <th className="px-4 py-2.5 font-medium">Frequency</th>
                    <th className="px-4 py-2.5 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {group.rows.map(comp => (
                    <tr key={comp.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <div className="font-medium">{comp.name}</div>
                        {comp.short_name && (
                          <div className="text-xs text-muted-foreground">{comp.short_name}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {comp.level && LEVEL_META[comp.level as Level] ? (
                          <span className={cn(
                            "rounded px-1.5 py-0.5 text-[11px] font-medium",
                            LEVEL_META[comp.level as Level].bg,
                            LEVEL_META[comp.level as Level].text,
                          )}>
                            {LEVEL_META[comp.level as Level].label}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
                          {TYPE_LABEL[comp.type ?? ""] ?? comp.type ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(comp.role_clusters ?? []).map(rc => (
                            <span
                              key={rc}
                              className={cn(
                                "rounded border px-1.5 py-0.5 text-[11px] font-medium",
                                ROLE_CLUSTER_COLOURS[rc] ?? "bg-muted text-muted-foreground",
                              )}
                            >
                              {rc}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <KeywordsCell keywords={comp.twitter_keywords} />
                      </td>
                      <td className="px-4 py-3 capitalize text-muted-foreground">
                        {comp.frequency ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-muted-foreground hover:text-destructive"
                          onClick={() => onDeactivate(comp.id)}
                        >
                          Deactivate
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {competitions.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No active competitions. Run <code className="font-mono">node index.js</code> to sync.
          </p>
        )}
      </div>
    </section>
  );
}

// ── Approve inline form ───────────────────────────────────────────────────────

const COMP_TYPES = ["hackathon", "case_comp", "robotics", "drone", "design", "business", "open_source", "quiz"];
const ROLE_CLUSTERS_ALL = ["software", "product", "business", "generalist"];

function ApproveForm({
  flagged,
  onCancel,
  onApprove,
}: {
  flagged: FlaggedCompetition;
  onCancel: () => void;
  onApprove: (data: { id: string; name: string; short_name: string; type: string; role_clusters: string[] }) => void;
}) {
  const [name, setName]       = useState(flagged.name);
  const [shortName, setShortName] = useState("");
  const [type, setType]       = useState("hackathon");
  const [clusters, setClusters] = useState<string[]>(["software"]);

  const toggleCluster = (rc: string) =>
    setClusters(prev => prev.includes(rc) ? prev.filter(x => x !== rc) : [...prev, rc]);

  return (
    <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3 text-sm">
      <p className="mb-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Add to Scraper
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label className="text-xs">Name</Label>
          <Input value={name} onChange={e => setName(e.target.value)} className="mt-1 h-8 text-xs" />
        </div>
        <div>
          <Label className="text-xs">Short Name</Label>
          <Input value={shortName} onChange={e => setShortName(e.target.value)} className="mt-1 h-8 text-xs" placeholder="e.g. SIH" />
        </div>
        <div>
          <Label className="text-xs">Type</Label>
          <select
            value={type}
            onChange={e => setType(e.target.value)}
            className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
          >
            {COMP_TYPES.map(t => (
              <option key={t} value={t}>{TYPE_LABEL[t] ?? t}</option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <Label className="text-xs">Role Clusters</Label>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {ROLE_CLUSTERS_ALL.map(rc => (
              <button
                key={rc}
                type="button"
                onClick={() => toggleCluster(rc)}
                className={cn(
                  "rounded border px-2 py-0.5 text-[11px] font-medium transition-colors",
                  clusters.includes(rc)
                    ? ROLE_CLUSTER_COLOURS[rc] ?? "bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:border-foreground",
                )}
              >
                {rc}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          className="h-7 text-xs"
          disabled={!name.trim() || clusters.length === 0}
          onClick={() => onApprove({
            id: toKebab(name),
            name: name.trim(),
            short_name: shortName.trim(),
            type,
            role_clusters: clusters,
          })}
        >
          <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
          Save to Competitions
        </Button>
      </div>
    </div>
  );
}

// ── Flagged competition card ──────────────────────────────────────────────────

function FlaggedCard({
  flagged,
  onDismiss,
  onApprove,
}: {
  flagged: FlaggedCompetition;
  onDismiss: () => void;
  onApprove: (data: { id: string; name: string; short_name: string; type: string; role_clusters: string[] }) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [approving, setApproving] = useState(false);

  const text = flagged.source_tweet_text ?? "";
  const truncated = text.length > 120 ? text.slice(0, 120) + "…" : text;

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-medium text-sm">{flagged.name}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              keyword: <code className="font-mono">{flagged.raw_keyword}</code>
              {" · "}
              {relativeDate(flagged.detected_at)}
            </p>
          </div>
          <Flag className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        {/* Tweet text */}
        {text && (
          <div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {expanded ? text : truncated}
            </p>
            {text.length > 120 && (
              <button
                onClick={() => setExpanded(e => !e)}
                className="mt-1 flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground"
              >
                {expanded ? (
                  <><ChevronUp className="h-3 w-3" /> Show less</>
                ) : (
                  <><ChevronDown className="h-3 w-3" /> Show more</>
                )}
              </button>
            )}
          </div>
        )}

        {/* Source link */}
        {flagged.source_tweet_url && (
          <a
            href={flagged.source_tweet_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            View source tweet
          </a>
        )}

        {/* Approve form */}
        {approving && (
          <ApproveForm
            flagged={flagged}
            onCancel={() => setApproving(false)}
            onApprove={(data) => {
              setApproving(false);
              onApprove(data);
            }}
          />
        )}

        {/* Action buttons */}
        {!approving && (
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() => setApproving(true)}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Add to Scraper
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-destructive"
              onClick={onDismiss}
            >
              <XCircle className="h-3.5 w-3.5" />
              Dismiss
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

function CompetitionsPage() {
  const qc = useQueryClient();

  const { data: competitions = [], isLoading: loadingComps } = useQuery({
    queryKey: ["competitions", "active"],
    queryFn: () => getActiveCompetitionsFn(),
  });

  const { data: flagged = [], isLoading: loadingFlagged } = useQuery({
    queryKey: ["flagged_competitions", "pending"],
    queryFn: () => getPendingFlaggedFn(),
  });

  const deactivateMut = useMutation({
    mutationFn: (id: string) => deactivateCompetitionFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["competitions"] });
      toast.success("Competition deactivated.");
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  const dismissMut = useMutation({
    mutationFn: (id: string) => dismissFlaggedFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["flagged_competitions"] });
      toast.success("Dismissed.");
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  const approveMut = useMutation({
    mutationFn: ({ flaggedId, competition }: {
      flaggedId: string;
      competition: { id: string; name: string; short_name: string; type: string; role_clusters: string[] };
    }) => approveFlaggedFn({ data: { flaggedId, competition } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["competitions"] });
      qc.invalidateQueries({ queryKey: ["flagged_competitions"] });
      toast.success("Added to competitions.");
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  const isLoading = loadingComps || loadingFlagged;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopNav health="fail" />
      <div className="mx-auto max-w-6xl px-6 py-6">
        <div className="flex items-center gap-2 mb-6">
          <Trophy className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold tracking-tight">Competitions</h1>
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        <div className="space-y-10">
          {/* Section 1 — Active Competitions */}
          <ActiveCompetitionsSection
            competitions={competitions}
            onDeactivate={(id) => deactivateMut.mutate(id)}
          />

          {/* Section 2 — Flagged for review */}
          <section>
            <h2 className="mb-3 text-sm font-semibold text-foreground flex items-center gap-2">
              Flagged for Review
              {flagged.length > 0 && (
                <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-400">
                  {flagged.length} pending
                </span>
              )}
            </h2>

            {flagged.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground rounded-lg border border-border">
                No competitions pending review. Unknown mentions from tweets will appear here.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {flagged.map(f => (
                  <FlaggedCard
                    key={f.id}
                    flagged={f}
                    onDismiss={() => dismissMut.mutate(f.id)}
                    onApprove={(data) => approveMut.mutate({ flaggedId: f.id, competition: data })}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
