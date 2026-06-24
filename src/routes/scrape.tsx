import { useState, useCallback } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Loader2,
  Search,
  Trophy,
  Sparkles,
  ChevronDown,
  X,
  CheckCircle2,
  AlertCircle,
  History,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CandidateCard } from "@/components/talent/CandidateCard";
import { TalentProvider } from "@/context/TalentContext";
import { TopNav } from "@/components/talent/TopNav";

import {
  scrapeStudentLinkedinFn,
  COLLEGE_GROUPS,
  KEYWORD_PROFILES,
  type CollegeGroup,
  type KeywordProfile,
} from "@/lib/api/students.functions";
import { scrapeCompetitionsFn } from "@/lib/api/scrape.functions";
import { enrichStudentCandidatesFn } from "@/lib/api/enrich.functions";
import { getCandidatesAfterFn } from "@/lib/api/candidates.functions";
import type { Candidate } from "@/data/talent";

export const Route = createFileRoute("/scrape")({
  head: () => ({
    meta: [{ title: "Scrape · Talent Radar · FlytBase" }],
  }),
  component: ScrapePage,
});

// ── Scrape history (localStorage) ────────────────────────────────────────────

const HISTORY_KEY = "talentRadar_scrapeHistory_v1";

export interface ScrapeRunRecord {
  id: string;
  startedAt: string;
  endedAt: string;
  collegeGroup: CollegeGroup;
  collegeGroupLabel: string;
  kwProfile: KeywordProfile;
  kwProfileLabel: string;
  inserted: number;
  skipped: number;
  jinaHits: number;
}

function loadHistory(): ScrapeRunRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as ScrapeRunRecord[]) : [];
  } catch {
    return [];
  }
}

function saveRunToHistory(run: ScrapeRunRecord): void {
  const history = loadHistory();
  history.unshift(run); // newest first
  if (history.length > 50) history.length = 50;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

// ── Shared types ──────────────────────────────────────────────────────────────

type AsyncState<T> =
  | { status: "idle" }
  | { status: "running"; message: string }
  | { status: "done"; data: T }
  | { status: "error"; message: string };

// ── Section card wrapper ──────────────────────────────────────────────────────

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="border-b border-border px-6 py-4">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

// ── Status banner ─────────────────────────────────────────────────────────────

function StatusBanner({
  state,
  onDismiss,
}: {
  state: AsyncState<unknown>;
  onDismiss: () => void;
}) {
  if (state.status === "idle") return null;

  if (state.status === "running") {
    return (
      <div className="mt-4 flex items-center gap-3 rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
        {state.message}
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="mt-4 flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <span className="flex-1">{state.message}</span>
        <button onClick={onDismiss} className="shrink-0 opacity-60 hover:opacity-100">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return null;
}

// ── Profiles section ──────────────────────────────────────────────────────────

function ProfilesSection() {
  const [collegeGroup, setCollegeGroup] = useState<CollegeGroup>("tier1a");
  const [kwProfile, setKwProfile] = useState<KeywordProfile>("technical");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [state, setState] = useState<
    AsyncState<{ inserted: number; jinaHits: number; candidates: Candidate[]; runId: string; startedAt: string; endedAt: string }>
  >({ status: "idle" });

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleScrape = useCallback(async () => {
    setState({ status: "running", message: "Searching Google for LinkedIn profiles…" });
    const startedAt = new Date().toISOString();
    try {
      const result = await scrapeStudentLinkedinFn({
        data: { group: collegeGroup, keywordProfile: kwProfile, maxResults: 50 },
      });
      const endedAt = new Date().toISOString();
      const candidates = await getCandidatesAfterFn({ data: { after: startedAt, before: endedAt } });

      // Save run record to localStorage history
      const runId = crypto.randomUUID();
      saveRunToHistory({
        id: runId,
        startedAt,
        endedAt,
        collegeGroup,
        collegeGroupLabel: COLLEGE_GROUPS[collegeGroup].label,
        kwProfile,
        kwProfileLabel: KEYWORD_PROFILES[kwProfile].label,
        inserted: result.inserted,
        skipped: result.skipped,
        jinaHits: result.jinaHits,
      });

      setState({ status: "done", data: { ...result, candidates, runId, startedAt, endedAt } });
    } catch (err: unknown) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, [collegeGroup, kwProfile]);

  const isDone = state.status === "done";
  const isRunning = state.status === "running";

  return (
    <SectionCard
      title="LinkedIn Profiles"
      description="Search Google for student LinkedIn profiles and parse them with Claude Haiku."
    >
      <div className="flex flex-wrap items-center gap-2">
        {/* College group */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1.5" disabled={isRunning}>
              {COLLEGE_GROUPS[collegeGroup].label}
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {(
              Object.entries(COLLEGE_GROUPS) as [
                CollegeGroup,
                (typeof COLLEGE_GROUPS)[CollegeGroup],
              ][]
            ).map(([key, def]) => (
              <DropdownMenuItem
                key={key}
                onClick={() => setCollegeGroup(key)}
                className="flex flex-col items-start gap-0.5"
              >
                <span className="font-medium">{def.label}</span>
                <span className="text-xs text-muted-foreground">
                  {def.universities.join(", ")}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Keyword profile */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1.5" disabled={isRunning}>
              {KEYWORD_PROFILES[kwProfile].label}
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {(
              Object.entries(KEYWORD_PROFILES) as [
                KeywordProfile,
                (typeof KEYWORD_PROFILES)[KeywordProfile],
              ][]
            ).map(([key, def]) => (
              <DropdownMenuItem key={key} onClick={() => setKwProfile(key)}>
                {def.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          size="sm"
          className="h-8 gap-1.5"
          onClick={handleScrape}
          disabled={isRunning}
        >
          {isRunning ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          {isRunning ? "Scraping…" : "Scrape"}
        </Button>

        {isDone && state.status === "done" && (
          <span className="ml-1 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {state.data.inserted} added · {state.data.jinaHits} LinkedIn pages fetched
          </span>
        )}
        {isDone && state.status === "done" && (
          <Link
            to="/scrape-results"
            search={{ after: state.data.startedAt, before: state.data.endedAt, label: `${COLLEGE_GROUPS[collegeGroup].label} × ${KEYWORD_PROFILES[kwProfile].label}` }}
            className="ml-auto text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            View in history →
          </Link>
        )}
      </div>

      <StatusBanner
        state={state as AsyncState<unknown>}
        onDismiss={() => setState({ status: "idle" })}
      />

      {isDone && state.status === "done" && state.data.candidates.length > 0 && (
        <div className="mt-5 space-y-3">
          <p className="text-xs font-medium text-muted-foreground">
            {state.data.candidates.length} candidate
            {state.data.candidates.length !== 1 ? "s" : ""} from this run
          </p>
          {state.data.candidates.map((c) => (
            <CandidateCard
              key={c.id}
              candidate={c}
              selected={selectedIds.has(c.id)}
              onToggleSelect={toggleSelect}
            />
          ))}
        </div>
      )}

      {isDone && state.status === "done" && state.data.candidates.length === 0 && (
        <p className="mt-4 text-xs text-muted-foreground">
          No new candidates — all found profiles already exist in the database.
        </p>
      )}
    </SectionCard>
  );
}

// ── Competitions section ──────────────────────────────────────────────────────

function CompetitionsSection() {
  const [state, setState] = useState<
    AsyncState<{
      newCandidates: number;
      newCompetitions: number;
      failures: number;
      timedOut: boolean;
      twitterSkipped: boolean;
      linkedinSkipped: boolean;
    }>
  >({ status: "idle" });

  const handleScrape = useCallback(async () => {
    setState({
      status: "running",
      message: "Scraping Twitter and LinkedIn for competition posts…",
    });
    try {
      const result = await scrapeCompetitionsFn();
      setState({ status: "done", data: result });
    } catch (err: unknown) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, []);

  const isRunning = state.status === "running";
  const isDone = state.status === "done";

  return (
    <SectionCard
      title="Competitions"
      description="Scrape Twitter and LinkedIn for hackathon and competition posts using Puppeteer. Requires TWITTER_COOKIE and/or LINKEDIN_COOKIE in .env."
    >
      <div className="flex items-center gap-3">
        <Button
          size="sm"
          className="h-8 gap-1.5"
          onClick={handleScrape}
          disabled={isRunning}
        >
          {isRunning ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trophy className="h-4 w-4" />
          )}
          {isRunning ? "Scraping…" : "Scrape Competitions"}
        </Button>

        {isDone && state.status === "done" && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {state.data.newCandidates} new candidates · {state.data.newCompetitions} competitions
            {state.data.failures > 0 && (
              <span className="ml-1 text-amber-500">· {state.data.failures} errors</span>
            )}
          </span>
        )}
      </div>

      <StatusBanner
        state={state as AsyncState<unknown>}
        onDismiss={() => setState({ status: "idle" })}
      />

      {isDone && state.status === "done" && (
        <div className="mt-3 space-y-1">
          {state.data.timedOut && (
            <p className="text-xs text-amber-500">
              Timed out after 8 minutes — check Supabase for partial results.
            </p>
          )}
          {state.data.twitterSkipped && (
            <p className="text-xs text-muted-foreground">Twitter skipped (no cookie configured).</p>
          )}
          {state.data.linkedinSkipped && (
            <p className="text-xs text-muted-foreground">LinkedIn skipped (no cookie configured).</p>
          )}
        </div>
      )}
    </SectionCard>
  );
}

// ── Enrich section ────────────────────────────────────────────────────────────

function EnrichSection() {
  const [state, setState] = useState<
    AsyncState<{
      processed: number;
      emailEnriched: number;
      githubFound: number;
      skipped: number;
      errors: number;
      githubRateLimited: boolean;
    }>
  >({ status: "idle" });

  const handleEnrich = useCallback(async () => {
    setState({ status: "running", message: "Enriching candidates with emails and GitHub profiles…" });
    try {
      const result = await enrichStudentCandidatesFn({ data: { limit: 100 } });
      setState({ status: "done", data: result });
    } catch (err: unknown) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, []);

  const isRunning = state.status === "running";
  const isDone = state.status === "done";

  return (
    <SectionCard
      title="Enrich"
      description="Look up emails from college patterns and search GitHub for matching profiles. Processes up to 100 candidates per run."
    >
      <div className="flex items-center gap-3">
        <Button
          size="sm"
          className="h-8 gap-1.5"
          onClick={handleEnrich}
          disabled={isRunning}
        >
          {isRunning ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {isRunning ? "Enriching…" : "Enrich Candidates"}
        </Button>

        {isDone && state.status === "done" && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {state.data.processed} processed · {state.data.emailEnriched} emails ·{" "}
            {state.data.githubFound} GitHub
            {state.data.githubRateLimited && (
              <span className="ml-1 text-amber-500">· GitHub rate limited</span>
            )}
          </span>
        )}
      </div>

      <StatusBanner
        state={state as AsyncState<unknown>}
        onDismiss={() => setState({ status: "idle" })}
      />
    </SectionCard>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

function ScrapePage() {
  return (
    <TalentProvider>
      <div className="min-h-screen bg-background text-foreground">
        <TopNav health="fail" />
        <div className="mx-auto max-w-3xl px-6 py-6">
          <div className="mb-6 flex items-center gap-4">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Link>
            <div className="h-4 w-px bg-border" />
            <h1 className="text-base font-semibold tracking-tight">Scrape</h1>
            <Link
              to="/scrape-results"
              className="ml-auto inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <History className="h-4 w-4" />
              History
            </Link>
          </div>

          <div className="space-y-4">
            <ProfilesSection />
            <CompetitionsSection />
            <EnrichSection />
          </div>
        </div>
      </div>
    </TalentProvider>
  );
}
