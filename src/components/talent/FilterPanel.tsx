import { useState } from "react";
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
  COMPETITION_CATEGORIES,
  COMPETITIONS_BY_CATEGORY,
  RESULT_TIERS,
  POR_CATEGORIES,
  ORGANISATIONS,
  type CompetitionCategory,
} from "@/data/talent";
import { cn } from "@/lib/utils";

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
  // Standard
  const [name, setName] = useState("");
  const [universities, setUniversities] = useState<string[]>([]);
  const [gradYear, setGradYear] = useState<[number, number]>([
    CURRENT_YEAR - 2,
    CURRENT_YEAR + 1,
  ]);
  const [degrees, setDegrees] = useState<string[]>([]);
  const [branches, setBranches] = useState<string[]>([]);

  // Builder
  const [builderOn, setBuilderOn] = useState(false);
  const [categories, setCategories] = useState<CompetitionCategory[]>([]);
  const [competitions, setCompetitions] = useState<string[]>([]);
  const [tiers, setTiers] = useState<string[]>([]);
  const [compYears, setCompYears] = useState<[number, number]>([2020, CURRENT_YEAR]);

  // Agency
  const [agencyOn, setAgencyOn] = useState(false);
  const [porCats, setPorCats] = useState<string[]>([]);
  const [orgs, setOrgs] = useState<string[]>([]);
  const [leadOnly, setLeadOnly] = useState(false);
  const [porYears, setPorYears] = useState<[number, number]>([2019, CURRENT_YEAR]);

  const toggle = (list: string[], v: string) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  const standardCount =
    (name ? 1 : 0) + universities.length + degrees.length + branches.length;
  const builderCount =
    (builderOn ? 1 : 0) + categories.length + competitions.length + tiers.length;
  const agencyCount =
    (agencyOn ? 1 : 0) + porCats.length + orgs.length + (leadOnly ? 1 : 0);

  const allCompetitions = (
    categories.length ? categories : (Object.keys(COMPETITIONS_BY_CATEGORY) as CompetitionCategory[])
  ).flatMap((c) => COMPETITIONS_BY_CATEGORY[c]);

  const clearAll = () => {
    setName("");
    setUniversities([]);
    setGradYear([CURRENT_YEAR - 2, CURRENT_YEAR + 1]);
    setDegrees([]);
    setBranches([]);
    setBuilderOn(false);
    setCategories([]);
    setCompetitions([]);
    setTiers([]);
    setCompYears([2020, CURRENT_YEAR]);
    setAgencyOn(false);
    setPorCats([]);
    setOrgs([]);
    setLeadOnly(false);
    setPorYears([2019, CURRENT_YEAR]);
  };

  return (
    <aside className="sticky top-14 flex h-[calc(100vh-3.5rem)] w-80 shrink-0 flex-col border-r border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Filters</h2>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs text-muted-foreground"
          onClick={clearAll}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Clear All
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <Accordion
          type="multiple"
          defaultValue={["standard", "builder", "agency"]}
          className="px-2"
        >
          {/* STANDARD */}
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
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Search by name…"
                  className="h-8"
                />
              </div>

              <div className="space-y-1.5">
                <SectionLabel>University</SectionLabel>
                <MultiSelect
                  options={UNIVERSITIES}
                  selected={universities}
                  onChange={setUniversities}
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
                  onValueChange={(v) => setGradYear(v as [number, number])}
                />
              </div>

              <div className="space-y-1.5">
                <SectionLabel>Degree Type</SectionLabel>
                <div className="grid grid-cols-2 gap-1.5">
                  {DEGREES.map((d) => (
                    <label
                      key={d}
                      className="flex items-center gap-2 text-xs"
                    >
                      <Checkbox
                        checked={degrees.includes(d)}
                        onCheckedChange={() => setDegrees(toggle(degrees, d))}
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
                  onChange={setBranches}
                  placeholder="Any branch"
                  searchable={false}
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* BUILDER */}
          <AccordionItem value="builder" className="border-b border-border">
            <AccordionTrigger className="px-2 py-3 text-sm font-medium hover:no-underline">
              <span className="flex items-center">
                Builder Filters
                <CountBadge n={builderCount} />
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 px-2 pb-4">
              <label className="flex items-center justify-between gap-2 rounded-md bg-muted px-2.5 py-2">
                <span className="text-xs font-medium leading-tight">
                  Has competed in a tracked competition
                </span>
                <Switch checked={builderOn} onCheckedChange={setBuilderOn} />
              </label>

              <div
                className={cn(
                  "space-y-4 transition-opacity",
                  !builderOn && "pointer-events-none opacity-50",
                )}
              >
                <div className="space-y-1.5">
                  <SectionLabel>Category</SectionLabel>
                  <ToggleGroup
                    type="multiple"
                    value={categories}
                    onValueChange={(v) => setCategories(v as CompetitionCategory[])}
                    className="grid grid-cols-2 gap-1.5"
                  >
                    {COMPETITION_CATEGORIES.map((c) => (
                      <ToggleGroupItem
                        key={c.value}
                        value={c.value}
                        className="h-7 border border-border text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                      >
                        {c.label}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </div>

                <div className="space-y-1.5">
                  <SectionLabel>Specific Competition</SectionLabel>
                  <MultiSelect
                    options={allCompetitions}
                    selected={competitions}
                    onChange={setCompetitions}
                    placeholder="Any competition"
                  />
                </div>

                <div className="space-y-1.5">
                  <SectionLabel>Result Tier</SectionLabel>
                  <div className="space-y-1">
                    {RESULT_TIERS.map((t) => (
                      <label key={t.value} className="flex items-center gap-2 text-xs">
                        <Checkbox
                          checked={tiers.includes(t.value)}
                          onCheckedChange={() => setTiers(toggle(tiers, t.value))}
                        />
                        {t.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <SectionLabel>Year Range</SectionLabel>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {compYears[0]} – {compYears[1]}
                    </span>
                  </div>
                  <Slider
                    min={2015}
                    max={CURRENT_YEAR}
                    step={1}
                    value={compYears}
                    onValueChange={(v) => setCompYears(v as [number, number])}
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* AGENCY */}
          <AccordionItem value="agency" className="border-b-0">
            <AccordionTrigger className="px-2 py-3 text-sm font-medium hover:no-underline">
              <span className="flex items-center">
                Agency Filters
                <CountBadge n={agencyCount} />
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 px-2 pb-4">
              <label className="flex items-center justify-between gap-2 rounded-md bg-muted px-2.5 py-2">
                <span className="text-xs font-medium leading-tight">
                  Has held at least one tracked PoR
                </span>
                <Switch checked={agencyOn} onCheckedChange={setAgencyOn} />
              </label>

              <div
                className={cn(
                  "space-y-4 transition-opacity",
                  !agencyOn && "pointer-events-none opacity-50",
                )}
              >
                <div className="space-y-1.5">
                  <SectionLabel>PoR Category</SectionLabel>
                  <div className="space-y-1">
                    {POR_CATEGORIES.map((p) => (
                      <label key={p.value} className="flex items-center gap-2 text-xs">
                        <Checkbox
                          checked={porCats.includes(p.value)}
                          onCheckedChange={() => setPorCats(toggle(porCats, p.value))}
                        />
                        {p.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <SectionLabel>Organisation</SectionLabel>
                  <MultiSelect
                    options={ORGANISATIONS}
                    selected={orgs}
                    onChange={setOrgs}
                    placeholder="Any organisation"
                  />
                </div>

                <div className="space-y-1.5">
                  <SectionLabel>Leadership Level</SectionLabel>
                  <ToggleGroup
                    type="single"
                    value={leadOnly ? "lead" : "any"}
                    onValueChange={(v) => setLeadOnly(v === "lead")}
                    className="grid grid-cols-2 gap-1.5"
                  >
                    <ToggleGroupItem
                      value="any"
                      className="h-7 border border-border text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                    >
                      Any Role
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="lead"
                      className="h-7 border border-border text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                    >
                      Core / Lead only
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <SectionLabel>Year Active</SectionLabel>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {porYears[0]} – {porYears[1]}
                    </span>
                  </div>
                  <Slider
                    min={2015}
                    max={CURRENT_YEAR}
                    step={1}
                    value={porYears}
                    onValueChange={(v) => setPorYears(v as [number, number])}
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </aside>
  );
}