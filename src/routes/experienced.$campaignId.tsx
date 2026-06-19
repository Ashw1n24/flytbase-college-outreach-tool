import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Building2,
  Users,
  Linkedin,
  Mail,
  UserSearch,
} from "lucide-react";
import { TopNav } from "@/components/talent/TopNav";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import {
  getCampaignFn,
  getCampaignCompaniesFn,
  getCampaignCandidatesFn,
  searchExperiencedCandidatesFn,
} from "@/lib/api/experienced.functions";

export const Route = createFileRoute("/experienced/$campaignId")({
  head: () => ({
    meta: [{ title: "Campaign · Talent Radar · FlytBase" }],
  }),
  component: CampaignDetail,
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface JdParsed {
  required_skills: string[];
  nice_to_have: string[];
  titles: string[];
  industries: string[];
  seniority: string[];
  min_experience: number;
}

interface CampaignFilters {
  industries: string[];
  company_sizes: string[];
  exp_min: number;
  exp_max: string;
  domains: string[];
  previous_companies: string[];
  past_roles: string[];
  locations: string[];
  employment_statuses: string[];
}

interface TierCounts {
  strong: number;
  good: number;
  partial: number;
}

interface EnrichedCompany {
  id: string;
  campaign_id: string;
  apollo_org_id: string;
  name: string;
  industry: string | null;
  employee_count: number | null;
  linkedin_url: string | null;
  website: string | null;
  candidate_count: number;
  created_at: string;
  tier_counts: TierCounts;
  candidate_titles: string[];
}

interface Candidate {
  id: string;
  campaign_id: string;
  apollo_id: string;
  full_name: string;
  title: string | null;
  headline: string | null;
  linkedin_url: string | null;
  email: string | null;
  company_name: string | null;
  company_id: string | null;
  location: string | null;
  years_experience: number | null;
  skills: string[];
  fit_score: number;
  fit_tier: "strong" | "good" | "partial";
  required_match: boolean;
  apollo_raw: unknown;
  created_at: string;
}

type FitTier = "strong" | "good" | "partial";

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

const TIER_META: Record<FitTier, { label: string; dot: string; badge: string }> = {
  strong:  { label: "Strong",  dot: "bg-ok",       badge: "bg-ok/15 text-ok border-ok/30" },
  good:    { label: "Good",    dot: "bg-blue-500",  badge: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  partial: { label: "Partial", dot: "bg-warn",      badge: "bg-warn/15 text-warn border-warn/30" },
};

const EMPLOYMENT_STATUS_OPTIONS = [
  "Currently Employed",
  "Open to Work",
  "Recently Changed Jobs (< 6 months)",
  "Freelance / Consulting",
];

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function safeUrl(url: string | null): string | null {
  if (!url) return null;
  const fixed = url.replace(/^(https?)(\/\/)/, "$1:$2");
  return /^https?:\/\//i.test(fixed) ? fixed : `https://${fixed}`;
}

function buildFilterChips(filters: CampaignFilters, jdParsed: JdParsed): string[] {
  const chips: string[] = [];
  const expMin = filters.exp_min ?? jdParsed.min_experience ?? 3;
  const expMax = filters.exp_max ? parseInt(filters.exp_max) : null;
  chips.push(expMax ? `${expMin}–${expMax} yrs` : `${expMin}+ yrs`);
  if (filters.locations?.length) {
    const locs = filters.locations.filter((l) => l !== "All India").slice(0, 3);
    if (locs.length) chips.push(...locs);
    else if (filters.locations.includes("All India")) chips.push("All India");
  }
  const industries = filters.industries?.filter((i) => i !== "Any Industry") ?? [];
  if (industries.length) chips.push(...industries.slice(0, 2));
  if (filters.company_sizes?.length) chips.push(...filters.company_sizes.slice(0, 2));
  if (filters.domains?.length) chips.push(...filters.domains.slice(0, 2));
  return chips;
}

function formatEmployeeCount(n: number | null): string {
  if (!n) return "";
  if (n >= 5000) return "5000+ employees";
  if (n >= 1000) return `${Math.round(n / 100) * 100}+ employees`;
  return `${n} employees`;
}

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function CompanyCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3 animate-pulse">
      <div className="space-y-1.5">
        <div className="h-4 w-40 rounded bg-muted" />
        <div className="h-3 w-28 rounded bg-muted" />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {[60, 80, 50].map((w) => (
          <div key={w} className="h-5 rounded-full bg-muted" style={{ width: w }} />
        ))}
      </div>
      <div className="h-3 w-36 rounded bg-muted" />
      <div className="h-7 w-28 rounded bg-muted" />
    </div>
  );
}

function CandidateCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="space-y-1.5">
          <div className="h-4 w-36 rounded bg-muted" />
          <div className="h-3 w-48 rounded bg-muted" />
        </div>
        <div className="h-5 w-16 rounded-full bg-muted" />
      </div>
      <div className="h-3 w-64 rounded bg-muted" />
      <div className="flex gap-1.5">
        {[50, 70, 45, 60].map((w) => (
          <div key={w} className="h-5 rounded-full bg-muted" style={{ width: w }} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Multi-select dropdown (lightweight, no Command search for small lists)
// ---------------------------------------------------------------------------

function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const toggle = (v: string) =>
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-8 gap-1.5 text-xs font-normal",
            selected.length > 0 && "border-primary/50 bg-primary/5 text-foreground",
          )}
        >
          {selected.length > 0 ? `${label}: ${selected.length}` : label}
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search…" className="h-8" />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem key={opt} value={opt} onSelect={() => toggle(opt)}>
                  <span
                    className={cn(
                      "mr-2 flex h-3.5 w-3.5 items-center justify-center rounded border border-border",
                      selected.includes(opt) && "bg-primary border-primary",
                    )}
                  >
                    {selected.includes(opt) && (
                      <span className="h-2 w-2 rounded-sm bg-primary-foreground" />
                    )}
                  </span>
                  <span className="text-xs">{opt}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Company card
// ---------------------------------------------------------------------------

function CompanyCard({
  company,
  onViewCandidates,
}: {
  company: EnrichedCompany;
  onViewCandidates: (companyId: string) => void;
}) {
  const { strong, good, partial } = company.tier_counts;
  const hasStrong = strong > 0;

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-5 space-y-3 transition-shadow hover:shadow-md",
        hasStrong ? "border-l-4 border-l-ok border-ok/30" : "border-border",
      )}
    >
      <div>
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold leading-tight">{company.name}</h3>
          {company.linkedin_url && (
            <a
              href={safeUrl(company.linkedin_url)!}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 text-[10px] text-muted-foreground hover:text-primary"
            >
              LinkedIn ↗
            </a>
          )}
        </div>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {[company.industry, formatEmployeeCount(company.employee_count)]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

      {company.candidate_titles.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {company.candidate_titles.map((title) => (
            <span
              key={title}
              className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground"
            >
              {title}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3 text-[11px]">
        {strong > 0 && (
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-ok" />
            <span className="font-medium">{strong}</span>
            <span className="text-muted-foreground">Strong</span>
          </span>
        )}
        {good > 0 && (
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            <span className="font-medium">{good}</span>
            <span className="text-muted-foreground">Good</span>
          </span>
        )}
        {partial > 0 && (
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-warn" />
            <span className="font-medium">{partial}</span>
            <span className="text-muted-foreground">Partial</span>
          </span>
        )}
      </div>

      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1.5 text-xs"
        onClick={() => onViewCandidates(company.apollo_org_id)}
      >
        <Users className="h-3.5 w-3.5" />
        View {company.candidate_count} Candidate{company.candidate_count !== 1 ? "s" : ""}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Candidate card
// ---------------------------------------------------------------------------

function CandidateCard({
  candidate,
  requiredSkills,
  niceToHave,
}: {
  candidate: Candidate;
  requiredSkills: string[];
  niceToHave: string[];
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const tier = TIER_META[candidate.fit_tier];

  // Categorise each skill
  const requiredSet = new Set(requiredSkills.map((s) => s.toLowerCase()));
  const niceSet = new Set(niceToHave.map((s) => s.toLowerCase()));

  const skills = candidate.skills ?? [];
  const requiredMatched = skills.filter((s) => requiredSet.has(s.toLowerCase()));
  const niceMatched = skills.filter(
    (s) => niceSet.has(s.toLowerCase()) && !requiredSet.has(s.toLowerCase()),
  );
  const otherSkills = skills
    .filter((s) => !requiredSet.has(s.toLowerCase()) && !niceSet.has(s.toLowerCase()))
    .slice(0, 6);

  // Previous companies from apollo_raw
  const raw = candidate.apollo_raw as Record<string, unknown> | null;
  const employment: Array<{ org: string; title: string; duration: string }> =
    (() => {
      const history =
        (raw?.employment_history as Array<Record<string, unknown>>) ?? [];
      return history
        .filter((e) => e.organization_name)
        .slice(0, 8)
        .map((e) => ({
          org: String(e.organization_name ?? ""),
          title: String(e.title ?? ""),
          duration: [e.start_date, e.end_date]
            .filter(Boolean)
            .map((d) => String(d).slice(0, 7))
            .join(" – ") || "",
        }));
    })();

  const metaParts = [
    candidate.location,
    candidate.years_experience != null
      ? `${candidate.years_experience} yrs exp`
      : null,
  ].filter(Boolean);

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3 hover:shadow-sm transition-shadow">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold truncate">{candidate.full_name}</h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground truncate">
            {[candidate.title, candidate.company_name].filter(Boolean).join(" · ")}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            tier.badge,
          )}
        >
          {tier.label}
        </span>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? "Less" : "More"}
        </button>
      </div>

      {/* Metadata row */}
      {metaParts.length > 0 && (
        <p className="text-[11px] text-muted-foreground">{metaParts.join(" · ")}</p>
      )}
      {/* Skills */}
      {skills.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {requiredMatched.map((s) => (
            <span
              key={s}
              className="rounded-full bg-ok/15 border border-ok/30 px-2 py-0.5 text-[10px] font-medium text-ok"
            >
              {s}
            </span>
          ))}
          {niceMatched.map((s) => (
            <span
              key={s}
              className="rounded-full bg-blue-500/15 border border-blue-500/30 px-2 py-0.5 text-[10px] font-medium text-blue-400"
            >
              {s}
            </span>
          ))}
          {otherSkills.map((s) => (
            <span
              key={s}
              className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground"
            >
              {s}
            </span>
          ))}
        </div>
      )}

      {/* Expand / collapse details */}
      {expanded && (
        <div className="space-y-3 pt-1 text-[11px] text-muted-foreground">
          <div>
            <span className="font-semibold text-foreground">Headline</span>
            <p className="mt-0.5 leading-relaxed">{candidate.headline ?? "—"}</p>
          </div>
          <div>
            <span className="font-semibold text-foreground">Email</span>
            <p className="mt-0.5">{candidate.email ?? "—"}</p>
          </div>
          <div>
            <span className="font-semibold text-foreground">Raw profile</span>
            <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-muted/60 p-2">
              {candidate.apollo_raw
                ? JSON.stringify(candidate.apollo_raw, null, 2)
                : "—"}
            </pre>
          </div>
        </div>
      )}

      {/* Employment history (collapsible) */}
      {employment.length > 0 && (
        <div>
          <button
            onClick={() => setHistoryOpen((v) => !v)}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {historyOpen ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
            {historyOpen ? "Hide" : "Show"} previous companies ({employment.length})
          </button>
          {historyOpen && (
            <ul className="mt-2 space-y-1.5 pl-1">
              {employment.map((e, i) => (
                <li key={i} className="text-[11px] leading-tight">
                  <span className="font-medium text-foreground">{e.org}</span>
                  {e.title && (
                    <span className="text-muted-foreground"> · {e.title}</span>
                  )}
                  {e.duration && (
                    <span className="text-muted-foreground/60"> · {e.duration}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Action row */}
      <div className="flex items-center gap-2 border-t border-border pt-3">
        {candidate.linkedin_url && (
          <a
            href={safeUrl(candidate.linkedin_url)!}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
              <Linkedin className="h-3.5 w-3.5" />
              LinkedIn
            </Button>
          </a>
        )}
        {candidate.email && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-[11px] text-muted-foreground">
            <Mail className="h-3 w-3" />
            {candidate.email}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Candidate view filter bar
// ---------------------------------------------------------------------------

interface CandidateViewFilters {
  companyId: string;          // "" = all
  tiers: FitTier[];
  expRange: [number, number]; // [min, max]
  locations: string[];
  employmentStatuses: string[];
}

const DEFAULT_CV_FILTERS: CandidateViewFilters = {
  companyId: "",
  tiers: [],
  expRange: [0, 20],
  locations: [],
  employmentStatuses: [],
};

function CandidateFilterBar({
  filters,
  onChange,
  companies,
}: {
  filters: CandidateViewFilters;
  onChange: (f: CandidateViewFilters) => void;
  companies: EnrichedCompany[];
}) {
  const set = <K extends keyof CandidateViewFilters>(
    k: K,
    v: CandidateViewFilters[K],
  ) => onChange({ ...filters, [k]: v });

  const tierOptions: FitTier[] = ["strong", "good", "partial"];

  const toggleTier = (t: FitTier) =>
    set(
      "tiers",
      filters.tiers.includes(t)
        ? filters.tiers.filter((x) => x !== t)
        : [...filters.tiers, t],
    );

  const locationOptions = [
    ...new Set(
      companies.flatMap((c) =>
        c.candidate_titles.length ? [] : [],
      ),
    ),
    "Bangalore",
    "Mumbai",
    "Delhi NCR",
    "Hyderabad",
    "Pune",
    "Chennai",
    "India",
    "International",
  ];

  const hasAnyFilter =
    filters.companyId ||
    filters.tiers.length > 0 ||
    filters.expRange[0] !== 0 ||
    filters.expRange[1] !== 20 ||
    filters.locations.length > 0 ||
    filters.employmentStatuses.length > 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Company dropdown */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-8 gap-1.5 text-xs font-normal max-w-[180px]",
              filters.companyId && "border-primary/50 bg-primary/5",
            )}
          >
            <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">
              {filters.companyId
                ? (companies.find((c) => c.apollo_org_id === filters.companyId)?.name ??
                  "Company")
                : "All Companies"}
            </span>
            <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-0" align="start">
          <Command>
            <CommandInput placeholder="Search companies…" className="h-8" />
            <CommandList>
              <CommandGroup>
                <CommandItem
                  value="__all__"
                  onSelect={() => set("companyId", "")}
                >
                  <span
                    className={cn(
                      "mr-2 h-3.5 w-3.5 rounded-full border border-border",
                      !filters.companyId && "bg-primary border-primary",
                    )}
                  />
                  <span className="text-xs">All Companies</span>
                </CommandItem>
                {companies.map((c) => (
                  <CommandItem
                    key={c.apollo_org_id}
                    value={c.name}
                    onSelect={() => set("companyId", c.apollo_org_id)}
                  >
                    <span
                      className={cn(
                        "mr-2 h-3.5 w-3.5 rounded-full border border-border",
                        filters.companyId === c.apollo_org_id &&
                          "bg-primary border-primary",
                      )}
                    />
                    <span className="text-xs truncate">{c.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Fit tier toggles */}
      <div className="flex items-center gap-1">
        {tierOptions.map((t) => {
          const meta = TIER_META[t];
          const active = filters.tiers.includes(t);
          return (
            <button
              key={t}
              onClick={() => toggleTier(t)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                active
                  ? meta.badge
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
              {meta.label}
            </button>
          );
        })}
      </div>

      {/* Experience range */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-8 gap-1.5 text-xs font-normal",
              (filters.expRange[0] !== 0 || filters.expRange[1] !== 20) &&
                "border-primary/50 bg-primary/5",
            )}
          >
            {filters.expRange[0] === 0 && filters.expRange[1] === 20
              ? "Experience"
              : `${filters.expRange[0]}–${filters.expRange[1]} yrs`}
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-4" align="start">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Years of Experience</span>
              <span className="font-medium tabular-nums">
                {filters.expRange[0]}–{filters.expRange[1]}
              </span>
            </div>
            <Slider
              min={0}
              max={20}
              step={1}
              value={filters.expRange}
              onValueChange={(v) =>
                set("expRange", v as [number, number])
              }
            />
          </div>
        </PopoverContent>
      </Popover>

      {/* Location */}
      <MultiSelectDropdown
        label="Location"
        options={locationOptions}
        selected={filters.locations}
        onChange={(v) => set("locations", v)}
      />

      {/* Employment status */}
      <MultiSelectDropdown
        label="Status"
        options={EMPLOYMENT_STATUS_OPTIONS}
        selected={filters.employmentStatuses}
        onChange={(v) => set("employmentStatuses", v)}
      />

      {/* Clear all */}
      {hasAnyFilter && (
        <button
          onClick={() => onChange(DEFAULT_CV_FILTERS)}
          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Candidate view
// ---------------------------------------------------------------------------

function CandidateView({
  campaignId,
  initialCompanyId,
  companies,
  jdParsed,
  onBack,
}: {
  campaignId: string;
  initialCompanyId: string | "all";
  companies: EnrichedCompany[];
  jdParsed: JdParsed;
  onBack: () => void;
}) {
  const [cvFilters, setCvFilters] = useState<CandidateViewFilters>({
    ...DEFAULT_CV_FILTERS,
    companyId: initialCompanyId === "all" ? "" : initialCompanyId,
  });

  const queryParams = {
    campaignId,
    companyId: cvFilters.companyId || undefined,
    tiers: cvFilters.tiers,
    expMin: cvFilters.expRange[0],
    expMax: cvFilters.expRange[1] < 20 ? cvFilters.expRange[1] : undefined,
    locations: cvFilters.locations,
    employmentStatuses: cvFilters.employmentStatuses,
  };

  const { data: candidates = [], isLoading } = useQuery({
    queryKey: ["campaign_candidates", campaignId, queryParams],
    queryFn: () => getCampaignCandidatesFn({ data: queryParams }),
    staleTime: 30_000,
  });

  const viewTitle =
    cvFilters.companyId
      ? `Candidates at ${companies.find((c) => c.apollo_org_id === cvFilters.companyId)?.name ?? "Company"}`
      : "All Candidates";

  return (
    <div className="space-y-5">
      {/* Back + title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Companies
        </button>
        <span className="text-muted-foreground/40">/</span>
        <h2 className="text-sm font-medium">{viewTitle}</h2>
      </div>

      {/* Filter bar */}
      <CandidateFilterBar
        filters={cvFilters}
        onChange={setCvFilters}
        companies={companies}
      />

      {/* Results */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <CandidateCardSkeleton key={i} />
          ))}
        </div>
      ) : candidates.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <UserSearch className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            No candidates match these filters.
          </p>
          <button
            onClick={() => setCvFilters(DEFAULT_CV_FILTERS)}
            className="text-xs text-primary hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {candidates.length} candidate{candidates.length !== 1 ? "s" : ""}
          </p>
          {candidates.map((c) => (
            <CandidateCard
              key={c.id}
              candidate={c as Candidate}
              requiredSkills={jdParsed.required_skills ?? []}
              niceToHave={jdParsed.nice_to_have ?? []}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

function CampaignDetail() {
  const { campaignId } = Route.useParams();
  const [jdExpanded, setJdExpanded] = useState(false);
  // null = company view; "all" or orgId string = candidate view
  const [candidateView, setCandidateView] = useState<string | "all" | null>(null);

  const {
    data: campaign,
    isLoading: campLoading,
    error: campError,
    refetch: refetchCampaign,
  } = useQuery({
    queryKey: ["campaign", campaignId],
    queryFn: () => getCampaignFn({ data: { id: campaignId } }),
    refetchInterval: (q) =>
      q.state.data?.status === "pending" || q.state.data?.status === "searching"
        ? 3000
        : false,
    staleTime: 5_000,
  });

  const searching =
    campaign?.status === "pending" || campaign?.status === "searching";
  const done = campaign?.status === "done";

  const { data: companies = [], isLoading: companiesLoading, refetch: refetchCompanies } =
    useQuery({
      queryKey: ["campaign_companies", campaignId],
      queryFn: () => getCampaignCompaniesFn({ data: { campaignId } }),
      enabled: done,
      staleTime: 30_000,
    });

  const { mutate: runSearch, isPending: triggeringSearch, error: searchError } = useMutation({
    mutationFn: () => searchExperiencedCandidatesFn({ data: { campaignId } }),
    onSuccess: () => {
      refetchCampaign();
      refetchCompanies();
    },
  });

  useEffect(() => {
    if (campaign?.status === "pending") runSearch();
  }, [campaign?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const jdParsed = campaign?.jd_parsed as unknown as JdParsed | undefined;
  const campaignFilters = campaign?.filters as unknown as CampaignFilters | undefined;
  const jdRaw: string =
    (campaign as unknown as Record<string, unknown>)?.jd_raw as string ?? "";
  const candidateCount =
    (campaign as unknown as Record<string, unknown>)?.candidate_count as number ?? 0;
  const companyCount =
    (campaign as unknown as Record<string, unknown>)?.company_count as number ?? 0;

  const filterChips =
    jdParsed && campaignFilters
      ? buildFilterChips(campaignFilters, jdParsed)
      : [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopNav health="fail" hideCompetitions />

      <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">

        {/* Back link to campaigns list */}
        <Link
          to="/experienced"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          All Campaigns
        </Link>

        {campLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading campaign…
          </div>
        )}
        {campError && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {campError instanceof Error ? campError.message : "Failed to load campaign."}
          </div>
        )}

        {campaign && (
          <>
            {/* ── Page header (always visible) ───────────────────────── */}
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-xl font-semibold tracking-tight">{campaign.name}</h1>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {new Date(campaign.created_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                    &nbsp;·&nbsp;
                    <span className="capitalize">{campaign.status}</span>
                  </p>
                </div>
                {(done || campaign.status === "error") && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs shrink-0"
                    onClick={() => { setCandidateView(null); runSearch(); }}
                    disabled={triggeringSearch}
                  >
                    <RefreshCw
                      className={cn("h-3.5 w-3.5", triggeringSearch && "animate-spin")}
                    />
                    Re-run Search
                  </Button>
                )}
              </div>

              {/* JD summary */}
              {jdRaw && (
                <div className="rounded-lg border border-border bg-card px-4 py-3 text-xs text-muted-foreground">
                  {jdExpanded || jdRaw.length <= 120
                    ? jdRaw
                    : `${jdRaw.slice(0, 120)}…`}
                  {jdRaw.length > 120 && (
                    <button
                      onClick={() => setJdExpanded((v) => !v)}
                      className="ml-2 inline-flex items-center gap-0.5 text-primary hover:underline"
                    >
                      {jdExpanded ? (
                        <>Less <ChevronUp className="h-3 w-3" /></>
                      ) : (
                        <>More <ChevronDown className="h-3 w-3" /></>
                      )}
                    </button>
                  )}
                </div>
              )}

              {/* Filter chips */}
              {filterChips.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide mr-1">
                    Filters
                  </span>
                  {filterChips.map((chip) => (
                    <span
                      key={chip}
                      className="rounded-full border border-border bg-card px-2.5 py-0.5 text-[11px] text-muted-foreground"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              )}

              {/* Counts + view toggle */}
              {done && candidateView === null && (
                <div className="flex items-center gap-4">
                  <div className="flex gap-6 text-sm">
                    <span>
                      <span className="text-xl font-bold">{candidateCount}</span>
                      <span className="ml-1.5 text-muted-foreground">candidates</span>
                    </span>
                    <span>
                      <span className="text-xl font-bold">{companyCount}</span>
                      <span className="ml-1.5 text-muted-foreground">companies</span>
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-auto h-8 gap-1.5 text-xs"
                    onClick={() => setCandidateView("all")}
                  >
                    View All Candidates
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}

              {searchError && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {searchError instanceof Error
                    ? searchError.message
                    : "Search failed. Click Re-run to try again."}
                </div>
              )}
            </div>

            {/* ── Candidate view ──────────────────────────────────────── */}
            {candidateView !== null && done && jdParsed && (
              <CandidateView
                campaignId={campaignId}
                initialCompanyId={candidateView}
                companies={companies as EnrichedCompany[]}
                jdParsed={jdParsed}
                onBack={() => setCandidateView(null)}
              />
            )}

            {/* ── Searching skeleton ──────────────────────────────────── */}
            {searching && candidateView === null && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching Apollo for matching candidates…
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <CompanyCardSkeleton key={i} />
                  ))}
                </div>
              </div>
            )}

            {/* ── Company grid ────────────────────────────────────────── */}
            {done && candidateView === null && (
              companiesLoading ? (
                <div className="grid grid-cols-2 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <CompanyCardSkeleton key={i} />
                  ))}
                </div>
              ) : companies.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
                  <Building2 className="h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">No matching companies found.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => runSearch()}
                    disabled={triggeringSearch}
                    className="gap-1.5"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Re-run Search
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {companies.map((company) => (
                    <CompanyCard
                      key={company.id}
                      company={company as EnrichedCompany}
                      onViewCandidates={(id) => setCandidateView(id)}
                    />
                  ))}
                </div>
              )
            )}
          </>
        )}
      </div>
    </div>
  );
}
