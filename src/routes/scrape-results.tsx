import { useState, useEffect, useCallback } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Loader2,
  SearchX,
  History,
  Zap,
  ChevronRight,
} from "lucide-react";
import { z } from "zod";

import { TopNav } from "@/components/talent/TopNav";
import { CandidateCard } from "@/components/talent/CandidateCard";
import { TalentProvider } from "@/context/TalentContext";
import { getCandidatesAfterFn } from "@/lib/api/candidates.functions";
import type { ScrapeRunRecord } from "@/routes/scrape";

const HISTORY_KEY = "talentRadar_scrapeHistory_v1";

function loadHistory(): ScrapeRunRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as ScrapeRunRecord[]) : [];
  } catch {
    return [];
  }
}

// ── Route ─────────────────────────────────────────────────────────────────────

const searchSchema = z.object({
  after: z.string().optional().catch(undefined),
  before: z.string().optional().catch(undefined),
  label: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/scrape-results")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [{ title: "Scrape History · Talent Radar · FlytBase" }],
  }),
  component: ScrapeResultsPage,
});

// ── Run detail view ───────────────────────────────────────────────────────────

function RunDetailView({
  after,
  before,
  label,
}: {
  after: string;
  before?: string;
  label?: string;
}) {
  const { data: candidates = [], isLoading, error } = useQuery({
    queryKey: ["scrape-results", after, before],
    queryFn: () => getCandidatesAfterFn({ data: { after, before } }),
  });

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const afterDate = new Date(after);

  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      <div className="mb-6 flex items-center gap-4">
        <Link
          to="/scrape-results"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          All Runs
        </Link>
        <div className="h-4 w-px bg-border" />
        <div>
          <h1 className="text-base font-semibold tracking-tight">
            {label ?? "Scrape Run"}
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {afterDate.toLocaleString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
        {!isLoading && (
          <span className="ml-auto rounded-full bg-primary/10 px-3 py-0.5 text-xs font-medium text-primary">
            {candidates.length} candidate{candidates.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading results…
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Failed to load results. Check your Supabase connection and try again.
        </div>
      ) : candidates.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-sm text-muted-foreground">
          <SearchX className="h-10 w-10 opacity-30" />
          <p>No new candidates were added in this scrape run.</p>
          <p className="text-xs opacity-70">
            All found profiles may already exist in the database.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {candidates.map((c) => (
            <CandidateCard
              key={c.id}
              candidate={c}
              selected={selectedIds.has(c.id)}
              onToggleSelect={toggleSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── History list view ─────────────────────────────────────────────────────────

function HistoryListView() {
  const [runs, setRuns] = useState<ScrapeRunRecord[]>([]);

  useEffect(() => {
    setRuns(loadHistory());
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      <div className="mb-6 flex items-center gap-4">
        <Link
          to="/scrape"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Scrape
        </Link>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <h1 className="text-base font-semibold tracking-tight">Scrape History</h1>
        </div>
        <span className="ml-auto text-xs text-muted-foreground">
          {runs.length} run{runs.length !== 1 ? "s" : ""} recorded
        </span>
      </div>

      {runs.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-20 text-center text-sm text-muted-foreground">
          <History className="h-10 w-10 opacity-20" />
          <p className="font-medium">No scrape runs yet</p>
          <p className="text-xs opacity-70">
            Run a LinkedIn profile scrape from the{" "}
            <Link to="/scrape" className="underline hover:text-foreground">
              Scrape page
            </Link>{" "}
            to see it here.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {runs.map((run) => {
            const date = new Date(run.startedAt);
            const durationMs =
              new Date(run.endedAt).getTime() - new Date(run.startedAt).getTime();
            const durationMin = Math.round(durationMs / 60_000);

            return (
              <Link
                key={run.id}
                to="/scrape-results"
                search={{
                  after: run.startedAt,
                  before: run.endedAt,
                  label: `${run.collegeGroupLabel} × ${run.kwProfileLabel}`,
                }}
                className="group flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4 transition-colors hover:bg-muted/40"
              >
                {/* Icon */}
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Zap className="h-4 w-4 text-primary" />
                </div>

                {/* Main info */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {run.collegeGroupLabel}
                    <span className="mx-1.5 text-muted-foreground">×</span>
                    {run.kwProfileLabel}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {date.toLocaleString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {durationMin > 0 && (
                      <span className="ml-2 opacity-60">· {durationMin} min</span>
                    )}
                  </p>
                </div>

                {/* Stats */}
                <div className="flex shrink-0 items-center gap-4 text-xs text-muted-foreground">
                  <div className="text-right">
                    <p className="font-semibold text-foreground">{run.inserted}</p>
                    <p>added</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-foreground">{run.jinaHits}</p>
                    <p>Jina hits</p>
                  </div>
                  <ChevronRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-60" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

function ScrapeResultsPage() {
  const { after, before, label } = Route.useSearch();

  return (
    <TalentProvider>
      <div className="min-h-screen bg-background text-foreground">
        <TopNav health="fail" />
        {after ? (
          <RunDetailView after={after} before={before} label={label} />
        ) : (
          <HistoryListView />
        )}
      </div>
    </TalentProvider>
  );
}
