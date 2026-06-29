import { RotateCcw } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { MultiSelect } from "./MultiSelect";
import {
  UNIVERSITIES,
  DEGREES,
  BRANCHES,
  SOURCES,
  type CandidateSource,
} from "@/data/talent";
import { ROLE_FIT_STYLE, type RoleFitLabel } from "@/lib/utils/rolefit";
import { CULTURE_TIER_META, type CultureTier } from "@/lib/utils/culturefit";
import { useSearchContext } from "@/context/SearchContext";
import { cn } from "@/lib/utils";

const ROLE_FIT_OPTIONS: RoleFitLabel[] = [
  "Agentic AI Engineer",
  "Software Engineer",
  "Product Manager",
  "Product Marketing",
  "Founder's Office",
  "BDR / Sales",
  "Marketing",
];

const CULTURE_TIER_OPTIONS: { value: CultureTier; label: string }[] = [
  { value: "strong", label: "Strong Fit" },
  { value: "good",   label: "Good Fit" },
  { value: "partial", label: "Partial Fit" },
];

const CURRENT_YEAR = new Date().getFullYear();

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </div>
  );
}

function CountBadge({ n }: { n: number }) {
  if (n === 0) return null;
  return (
    <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
      {n}
    </span>
  );
}

export function FilterPanel() {
  const { filters, updateFilter, updateFilters, clearAllFilters } =
    useSearchContext();

  const name = filters.name ?? "";
  const universities = filters.universities ?? [];
  const gradYear: [number, number] = [
    filters.grad_year_min ?? CURRENT_YEAR - 2,
    filters.grad_year_max ?? CURRENT_YEAR + 1,
  ];
  const degrees = filters.degrees ?? [];
  const branches = filters.branches ?? [];

  const sources = (filters.sources ?? []) as CandidateSource[];
  const hasEmail = Boolean(filters.has_email);
  const roleFitLabels = (filters.role_fit_labels ?? []) as RoleFitLabel[];
  const cultureFitTiers = (filters.culture_fit_tiers ?? []) as CultureTier[];

  const toggle = (list: string[], v: string) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  const standardCount =
    (name ? 1 : 0) + universities.length + degrees.length + branches.length + sources.length + (hasEmail ? 1 : 0);

  return (
    <aside className="sticky top-14 flex h-[calc(100vh-3.5rem)] w-80 shrink-0 flex-col border-r border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Filters</h2>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs text-muted-foreground"
          onClick={clearAllFilters}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Clear All
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="space-y-2 border-b border-border px-4 py-3">
          <div className="flex items-center justify-between">
            <SectionLabel>Role Fit</SectionLabel>
            {roleFitLabels.length > 0 && (
              <button
                className="text-[10px] text-muted-foreground hover:text-foreground"
                onClick={() => updateFilter("role_fit_labels", [])}
              >
                Clear
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ROLE_FIT_OPTIONS.map((label) => {
              const active = roleFitLabels.includes(label);
              return (
                <button
                  key={label}
                  onClick={() =>
                    updateFilter(
                      "role_fit_labels",
                      (active
                        ? roleFitLabels.filter((l) => l !== label)
                        : [...roleFitLabels, label]) as RoleFitLabel[],
                    )
                  }
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                    active
                      ? ROLE_FIT_STYLE[label]
                      : "border-border bg-background text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2 border-b border-border px-4 py-3">
          <div className="flex items-center justify-between">
            <SectionLabel>Culture Fit</SectionLabel>
            {cultureFitTiers.length > 0 && (
              <button
                className="text-[10px] text-muted-foreground hover:text-foreground"
                onClick={() => updateFilter("culture_fit_tiers", [])}
              >
                Clear
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {CULTURE_TIER_OPTIONS.map(({ value, label }) => {
              const active = cultureFitTiers.includes(value);
              const meta = CULTURE_TIER_META[value];
              return (
                <button
                  key={value}
                  onClick={() =>
                    updateFilter(
                      "culture_fit_tiers",
                      (active
                        ? cultureFitTiers.filter((t) => t !== value)
                        : [...cultureFitTiers, value]) as CultureTier[],
                    )
                  }
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                    active
                      ? meta.className
                      : "border-border bg-background text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2 border-b border-border px-4 py-3">
          <div className="flex items-center justify-between">
            <SectionLabel>Source</SectionLabel>
            {sources.length > 0 && (
              <button
                className="text-[10px] text-muted-foreground hover:text-foreground"
                onClick={() => updateFilter("sources", [])}
              >
                Clear
              </button>
            )}
          </div>
          <ToggleGroup
            type="multiple"
            value={sources}
            onValueChange={(v) =>
              updateFilter("sources", v as CandidateSource[])
            }
            className="flex flex-wrap gap-1.5"
          >
            {SOURCES.map((s) => (
              <ToggleGroupItem
                key={s.value}
                value={s.value}
                className="h-7 border border-border px-2.5 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                {s.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          {sources.length === 0 && (
            <p className="text-[10px] text-muted-foreground">
              All sources shown. Select to filter.
            </p>
          )}

          <label className="flex items-center justify-between gap-2 rounded-md bg-muted px-2.5 py-2">
            <span className="text-xs font-medium leading-tight">
              Has email
            </span>
            <Switch
              checked={hasEmail}
              onCheckedChange={(v) => updateFilter("has_email", v)}
            />
          </label>
        </div>

        <Accordion
          type="multiple"
          defaultValue={["standard"]}
          className="px-2"
        >
          <AccordionItem value="standard" className="border-b border-border">
            <AccordionTrigger className="px-2 py-3 text-sm font-medium hover:no-underline">
              <span className="flex items-center">
                Standard Filters
                <CountBadge n={standardCount} />
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 px-2 pb-4">
              <div className="space-y-1.5">
                <SectionLabel>Name</SectionLabel>
                <Input
                  value={name}
                  onChange={(e) => updateFilter("name", e.target.value)}
                  placeholder="Search by name…"
                  className="h-8"
                />
              </div>

              <div className="space-y-1.5">
                <SectionLabel>University</SectionLabel>
                <MultiSelect
                  options={UNIVERSITIES}
                  selected={universities}
                  onChange={(v) => updateFilter("universities", v)}
                  placeholder="Any university"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <SectionLabel>Graduation Year</SectionLabel>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {gradYear[0]} – {gradYear[1]}
                  </span>
                </div>
                <Slider
                  min={2018}
                  max={CURRENT_YEAR + 2}
                  step={1}
                  value={gradYear}
                  onValueChange={(v) =>
                    updateFilters({
                      grad_year_min: v[0],
                      grad_year_max: v[1],
                    })
                  }
                />
              </div>

              <div className="space-y-1.5">
                <SectionLabel>Degree Type</SectionLabel>
                <div className="grid grid-cols-2 gap-1.5">
                  {DEGREES.map((d) => (
                    <label key={d} className="flex items-center gap-2 text-xs">
                      <Checkbox
                        checked={degrees.includes(d)}
                        onCheckedChange={() =>
                          updateFilter("degrees", toggle(degrees, d))
                        }
                      />
                      {d}
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <SectionLabel>Branch / Domain</SectionLabel>
                <MultiSelect
                  options={BRANCHES}
                  selected={branches}
                  onChange={(v) => updateFilter("branches", v)}
                  placeholder="Any branch"
                  searchable={false}
                />
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </aside>
  );
}
