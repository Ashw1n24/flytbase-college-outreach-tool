import { createFileRoute, Link, Outlet, useNavigate, useMatchRoute } from "@tanstack/react-router";
import { useState, useRef, KeyboardEvent, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  parseJdFn,
  getCampaignsFn,
  parseCompanyCampaignFn,
  getTargetCompaniesFn,
} from "@/lib/api/experienced.functions";
import { ALL_TAGS } from "@/data/target-companies";
import { TopNav } from "@/components/talent/TopNav";
import { ArrowLeft, Plus, Upload, X, Check, ChevronsUpDown, ChevronDown, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/experienced")({
  head: () => ({
    meta: [{ title: "Experienced Candidates · Talent Radar · FlytBase" }],
  }),
  component: Experienced,
});

// ---------------------------------------------------------------------------
// Filter option constants
// ---------------------------------------------------------------------------

const INDUSTRY_OPTIONS = [
  "Technology & Software",
  "SaaS / Cloud",
  "Cybersecurity",
  "Hardware & Electronics",
  "Robotics & Automation",
  "Aerospace & Defence",
  "Manufacturing & Industrial",
  "Logistics & Supply Chain",
  "Energy & Utilities",
  "Infrastructure & Construction",
  "Healthcare & Medtech",
  "Finance & Fintech",
  "Consulting & Professional Services",
  "E-commerce & Retail",
  "Media & Marketing",
  "Education & Edtech",
  "Any Industry",
];

const COMPANY_SIZE_OPTIONS = [
  "Startup (1–50)",
  "Scale-up (51–200)",
  "Growth (201–1000)",
  "Mid-market (1001–5000)",
  "Enterprise (5000+)",
];

const DOMAIN_SUGGESTIONS = [
  "Enterprise B2B Sales",
  "SaaS Sales",
  "Channel Partnerships",
  "Product Management",
  "Full Stack Engineering",
  "Backend Engineering",
  "Frontend Engineering",
  "AI / ML Engineering",
  "Robotics & Embedded Systems",
  "DevOps & Cloud",
  "Growth Marketing",
  "Performance Marketing",
  "Brand & Content",
  "Business Development",
  "Strategy & Operations",
  "Product Marketing",
  "UX & Design",
  "Data & Analytics",
  "Finance & Accounting",
  "HR & Talent",
];

const PAST_ROLE_SUGGESTIONS = [
  "Account Executive",
  "Sales Manager",
  "Business Development Representative",
  "Software Engineer",
  "Senior Engineer",
  "Engineering Manager",
  "Product Manager",
  "Product Lead",
  "Growth Manager",
  "Marketing Manager",
  "Solutions Engineer",
  "Customer Success Manager",
  "Founder",
  "Co-founder",
];

const LOCATION_OPTIONS = [
  "All India",
  "Bangalore",
  "Mumbai",
  "Delhi NCR",
  "Hyderabad",
  "Pune",
  "Chennai",
  "Kolkata",
  "Ahmedabad",
  "Jaipur",
  "International (outside India)",
];

const ALL_INDIA_CITIES = [
  "Bangalore",
  "Mumbai",
  "Delhi NCR",
  "Hyderabad",
  "Pune",
  "Chennai",
  "Kolkata",
  "Ahmedabad",
  "Jaipur",
];

const EMPLOYMENT_STATUS_OPTIONS = [
  "Currently Employed",
  "Open to Work",
  "Recently Changed Jobs (< 6 months)",
  "Freelance / Consulting",
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CampaignFilters {
  industries: string[];
  company_sizes: string[];
  exp_min: number;
  exp_max: string; // empty string = no ceiling
  domains: string[];
  previous_companies: string[];
  past_roles: string[];
  locations: string[];
  employment_statuses: string[];
}

const DEFAULT_FILTERS: CampaignFilters = {
  industries: [],
  company_sizes: [],
  exp_min: 3,
  exp_max: "",
  domains: [],
  previous_companies: [],
  past_roles: [],
  locations: [],
  employment_statuses: [],
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Standard multi-select backed by a predefined list. */
function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Any",
}: {
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);

  const toggle = (val: string) =>
    onChange(
      selected.includes(val) ? selected.filter((v) => v !== val) : [...selected, val],
    );

  return (
    <div className="space-y-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            className="h-8 w-full justify-between font-normal text-xs"
          >
            <span className={cn(selected.length === 0 && "text-muted-foreground")}>
              {selected.length === 0 ? placeholder : `${selected.length} selected`}
            </span>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search…" className="h-8" />
            <CommandList>
              <CommandEmpty>No results.</CommandEmpty>
              <CommandGroup>
                {options.map((opt) => (
                  <CommandItem key={opt} value={opt} onSelect={() => toggle(opt)}>
                    <Check
                      className={cn(
                        "h-3.5 w-3.5 mr-2 shrink-0",
                        selected.includes(opt) ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="text-xs">{opt}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selected.length > 0 && <ChipList items={selected} onRemove={(s) => toggle(s)} />}
    </div>
  );
}

/** Multi-select with suggestions + free-text entry (Enter or comma to add). */
function CreatableMultiSelect({
  suggestions,
  selected,
  onChange,
  placeholder = "Type or pick…",
}: {
  suggestions: string[];
  selected: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const toggle = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) return;
    onChange(
      selected.includes(trimmed)
        ? selected.filter((v) => v !== trimmed)
        : [...selected, trimmed],
    );
  };

  const addCustom = () => {
    const trimmed = inputValue.trim();
    if (!trimmed || selected.includes(trimmed)) {
      setInputValue("");
      return;
    }
    onChange([...selected, trimmed]);
    setInputValue("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addCustom();
    }
  };

  const filtered = suggestions.filter(
    (s) =>
      !selected.includes(s) &&
      s.toLowerCase().includes(inputValue.toLowerCase()),
  );

  return (
    <div className="space-y-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            className="h-8 w-full justify-between font-normal text-xs"
          >
            <span className={cn(selected.length === 0 && "text-muted-foreground")}>
              {selected.length === 0 ? placeholder : `${selected.length} selected`}
            </span>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command shouldFilter={false}>
            <div className="flex items-center border-b border-border px-2">
              <CommandInput
                placeholder="Search or type to add…"
                className="h-8 flex-1 border-0 focus:ring-0"
                value={inputValue}
                onValueChange={setInputValue}
                onKeyDown={handleKeyDown}
              />
              {inputValue.trim() && !suggestions.includes(inputValue.trim()) && (
                <button
                  onClick={addCustom}
                  className="ml-1 shrink-0 rounded p-1 hover:bg-accent"
                  title="Add custom value"
                >
                  <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
            <CommandList>
              {filtered.length === 0 && inputValue.trim() ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  Press Enter to add &quot;{inputValue.trim()}&quot;
                </div>
              ) : (
                <CommandGroup>
                  {filtered.map((opt) => (
                    <CommandItem key={opt} value={opt} onSelect={() => toggle(opt)}>
                      <Check
                        className={cn(
                          "h-3.5 w-3.5 mr-2 shrink-0",
                          selected.includes(opt) ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className="text-xs">{opt}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selected.length > 0 && <ChipList items={selected} onRemove={(s) => toggle(s)} />}
    </div>
  );
}

/** Free-text only — no suggestions. */
function FreeTextMultiSelect({
  selected,
  onChange,
  placeholder = "Type and press Enter…",
}: {
  selected: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [value, setValue] = useState("");

  const add = () => {
    const trimmed = value.trim();
    if (!trimmed || selected.includes(trimmed)) {
      setValue("");
      return;
    }
    onChange([...selected, trimmed]);
    setValue("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add();
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1.5">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="h-8 text-xs"
        />
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2 shrink-0"
          onClick={add}
          disabled={!value.trim()}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      {selected.length > 0 && (
        <ChipList items={selected} onRemove={(s) => onChange(selected.filter((v) => v !== s))} />
      )}
    </div>
  );
}

function ChipList({ items, onRemove }: { items: string[]; onRemove: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item) => (
        <span
          key={item}
          className="inline-flex items-center gap-1 rounded bg-accent px-1.5 py-0.5 text-[11px] text-accent-foreground"
        >
          {item}
          <button onClick={() => onRemove(item)} className="hover:text-foreground">
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
    </div>
  );
}

function FilterLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1.5">
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Campaign creation modal
// ---------------------------------------------------------------------------

function CampaignModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [campaignName, setCampaignName] = useState("");
  const [jdText, setJdText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [scrapeLoading, setScrapeLoading] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [filters, setFilters] = useState<CampaignFilters>(DEFAULT_FILTERS);
  const fileRef = useRef<HTMLInputElement>(null);

  const { mutate: submitCampaign, isPending: submitting, error: submitError } = useMutation({
    mutationFn: () =>
      parseJdFn({
        data: {
          name: campaignName,
          jdText,
          filters,
        },
      }),
    onSuccess: (data) => {
      console.log('campaign result:', data);
      window.location.href = `/experienced/${data.campaignId}`;
    },
  });

  const setFilter = <K extends keyof CampaignFilters>(
    key: K,
    value: CampaignFilters[K],
  ) => setFilters((prev) => ({ ...prev, [key]: value }));

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    // In a real implementation: parse PDF server-side; for now store name as placeholder.
    setJdText(`[PDF uploaded: ${file.name}]`);
  };

  const handleIndustryChange = (next: string[]) => {
    if (next.includes("Any Industry")) {
      // "Any Industry" clears all other selections
      setFilter("industries", ["Any Industry"]);
    } else {
      setFilter("industries", next.filter((v) => v !== "Any Industry"));
    }
  };

  const handleScrapeUrl = async () => {
    const raw = (document.getElementById("jd-scrape-url") as HTMLInputElement | null)?.value?.trim();
    const url = raw || "";
    if (!url) {
      setScrapeError("Enter a URL to scrape.");
      setJdText("");
      return;
    }
    setScrapeLoading(true);
    setScrapeError(null);
    try {
      const res = await fetch("/api/firecrawl/+server", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok || data?.success === false) {
        const message = data?.error || `Scrape failed (${res.status})`;
        throw new Error(message);
      }
      setJdText(data?.markdown || "");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Scrape failed";
      setScrapeError(message);
      setJdText("");
    } finally {
      setScrapeLoading(false);
    }
  };

  const handleLocationChange = (next: string[]) => {
    // "All India" selects every Indian city
    if (next.includes("All India") && !filters.locations.includes("All India")) {
      const intl = filters.locations.includes("International (outside India)")
        ? ["International (outside India)"]
        : [];
      setFilter("locations", ["All India", ...ALL_INDIA_CITIES, ...intl]);
      return;
    }
    // Deselecting "All India" clears city selections too
    if (!next.includes("All India") && filters.locations.includes("All India")) {
      setFilter(
        "locations",
        next.filter((v) => !ALL_INDIA_CITIES.includes(v) && v !== "All India"),
      );
      return;
    }
    setFilter("locations", next);
  };

  const canSubmit = campaignName.trim().length > 0 && jdText.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl w-full p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border">
          <DialogTitle className="text-base font-semibold">
            New Campaign
          </DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0" style={{ maxHeight: "calc(90vh - 130px)" }}>
          {/* ── Left column: name + JD ── */}
          <div className="flex flex-col gap-4 w-[45%] shrink-0 border-r border-border px-6 py-4 overflow-y-auto">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Campaign Name</Label>
              <Input
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="e.g. SaaS AEs — Q3 2025"
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1.5 flex-1 flex flex-col">
              <Label className="text-xs font-medium">
                Job Description
                <span className="ml-1 font-normal text-muted-foreground">
                  (paste text or upload PDF)
                </span>
              </Label>

              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <Label className="text-[11px] font-medium text-muted-foreground">JD URL</Label>
                  <Input
                    id="jd-scrape-url"
                    placeholder="https://company.com/careers/..."
                    className="h-8 text-xs"
                    onKeyDown={(e) => e.key === "Enter" && handleScrapeUrl()}
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-8 px-3 gap-1.5 text-xs"
                  onClick={handleScrapeUrl}
                  disabled={scrapeLoading}
                >
                  {scrapeLoading ? "Scraping…" : "Scrape"}
                </Button>
              </div>
              {scrapeError && (
                <p className="text-xs text-destructive line-clamp-2">{scrapeError}</p>
              )}

              <Textarea
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
                placeholder="Paste the full JD here…"
                className="flex-1 min-h-[280px] resize-none text-xs"
              />
              <div className="flex items-center gap-2 pt-1">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5" />
                  Upload PDF
                </Button>
                {fileName && (
                  <span className="text-[11px] text-muted-foreground truncate">
                    {fileName}
                    <button
                      className="ml-1 hover:text-foreground"
                      onClick={() => {
                        setFileName(null);
                        setJdText("");
                        if (fileRef.current) fileRef.current.value = "";
                      }}
                    >
                      <X className="inline h-3 w-3" />
                    </button>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ── Right column: filters ── */}
          <ScrollArea className="flex-1 px-6 py-4">
            <div className="space-y-5 pr-1">
              <p className="text-[11px] text-muted-foreground -mb-2">
                All filters are optional — leave empty for no restriction.
              </p>

              {/* Industry */}
              <div>
                <FilterLabel>Industry</FilterLabel>
                <MultiSelect
                  options={INDUSTRY_OPTIONS}
                  selected={filters.industries}
                  onChange={handleIndustryChange}
                  placeholder="Any industry"
                />
              </div>

              {/* Company Size */}
              <div>
                <FilterLabel>Company Size</FilterLabel>
                <MultiSelect
                  options={COMPANY_SIZE_OPTIONS}
                  selected={filters.company_sizes}
                  onChange={(v) => setFilter("company_sizes", v)}
                  placeholder="Any size"
                />
              </div>

              {/* Years of Experience */}
              <div>
                <FilterLabel>Years of Experience</FilterLabel>
                <div className="flex items-center gap-2">
                  <div className="flex-1 space-y-1">
                    <div className="text-[10px] text-muted-foreground">Min</div>
                    <Input
                      type="number"
                      min={0}
                      value={filters.exp_min}
                      onChange={(e) =>
                        setFilter("exp_min", parseInt(e.target.value) || 0)
                      }
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="pt-5 text-muted-foreground text-xs">–</div>
                  <div className="flex-1 space-y-1">
                    <div className="text-[10px] text-muted-foreground">Max (optional)</div>
                    <Input
                      type="number"
                      min={0}
                      value={filters.exp_max}
                      onChange={(e) => setFilter("exp_max", e.target.value)}
                      placeholder="No limit"
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Domain */}
              <div>
                <FilterLabel>Domain</FilterLabel>
                <CreatableMultiSelect
                  suggestions={DOMAIN_SUGGESTIONS}
                  selected={filters.domains}
                  onChange={(v) => setFilter("domains", v)}
                  placeholder="Any domain"
                />
              </div>

              {/* Previous Companies */}
              <div>
                <FilterLabel>Previous Companies</FilterLabel>
                <FreeTextMultiSelect
                  selected={filters.previous_companies}
                  onChange={(v) => setFilter("previous_companies", v)}
                  placeholder="Type company name, press Enter…"
                />
              </div>

              {/* Past Roles */}
              <div>
                <FilterLabel>Past Roles</FilterLabel>
                <CreatableMultiSelect
                  suggestions={PAST_ROLE_SUGGESTIONS}
                  selected={filters.past_roles}
                  onChange={(v) => setFilter("past_roles", v)}
                  placeholder="Any role"
                />
              </div>

              {/* Location */}
              <div>
                <FilterLabel>Location</FilterLabel>
                <MultiSelect
                  options={LOCATION_OPTIONS}
                  selected={filters.locations}
                  onChange={handleLocationChange}
                  placeholder="Any location"
                />
              </div>

              {/* Employment Status */}
              <div>
                <FilterLabel>Employment Status</FilterLabel>
                <MultiSelect
                  options={EMPLOYMENT_STATUS_OPTIONS}
                  selected={filters.employment_statuses}
                  onChange={(v) => setFilter("employment_statuses", v)}
                  placeholder="Any status"
                />
              </div>
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="px-6 py-3 border-t border-border flex-col items-end gap-2">
          {submitError && (
            <p className="text-xs text-destructive w-full">
              {submitError instanceof Error ? submitError.message : "Something went wrong."}
            </p>
          )}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => submitCampaign()}
              disabled={!canSubmit || submitting}
            >
              {submitting ? "Parsing…" : "Parse & Search"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Company campaign modal
// ---------------------------------------------------------------------------

function CompanyCampaignModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [campaignName, setCampaignName] = useState("");
  const [inputMode, setInputMode] = useState<"jd" | "roles">("jd");
  const [jdText, setJdText] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  const [scrapeLoading, setScrapeLoading] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
  const [filters, setFilters] = useState<CampaignFilters>(DEFAULT_FILTERS);
  const [rightTab, setRightTab] = useState<"companies" | "filters">("companies");
  const jdUrlRef = useRef<HTMLInputElement>(null);

  const { data: allCompanies = [], isLoading: companiesLoading } = useQuery({
    queryKey: ["target_companies"],
    queryFn: () => getTargetCompaniesFn(),
    enabled: open,
    staleTime: 60_000,
  });

  const activeCompanies = allCompanies.filter((c) => c.is_active);
  const visibleCompanies =
    selectedTags.length > 0
      ? activeCompanies.filter((c) => selectedTags.some((t) => c.tags.includes(t)))
      : activeCompanies;

  // Auto-select visible companies when tags are first applied
  useEffect(() => {
    if (selectedTags.length > 0) {
      const visibleIds = visibleCompanies.map((c) => c.id);
      setSelectedCompanyIds((prev) => {
        const next = new Set([...prev, ...visibleIds]);
        return [...next];
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTags.join(",")]);

  const toggleTag = (tag: string) =>
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );

  const toggleCompany = (id: string) =>
    setSelectedCompanyIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );

  const selectAll = () =>
    setSelectedCompanyIds((prev) => {
      const next = new Set([...prev, ...visibleCompanies.map((c) => c.id)]);
      return [...next];
    });

  const deselectAll = () =>
    setSelectedCompanyIds((prev) =>
      prev.filter((id) => !visibleCompanies.find((c) => c.id === id)),
    );

  const handleScrapeUrl = async () => {
    const url = jdUrlRef.current?.value?.trim() ?? "";
    if (!url) { setScrapeError("Enter a URL to scrape."); return; }
    setScrapeLoading(true);
    setScrapeError(null);
    try {
      const res = await fetch("/api/firecrawl/+server", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok || data?.success === false) throw new Error(data?.error || `Scrape failed (${res.status})`);
      setJdText(data?.markdown || "");
    } catch (err) {
      setScrapeError(err instanceof Error ? err.message : "Scrape failed");
      setJdText("");
    } finally {
      setScrapeLoading(false);
    }
  };

  const setFilter = <K extends keyof CampaignFilters>(key: K, value: CampaignFilters[K]) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const handleLocationChange = (next: string[]) => {
    if (next.includes("All India") && !filters.locations.includes("All India")) {
      const intl = filters.locations.includes("International (outside India)")
        ? ["International (outside India)"]
        : [];
      setFilter("locations", ["All India", ...ALL_INDIA_CITIES, ...intl]);
      return;
    }
    if (!next.includes("All India") && filters.locations.includes("All India")) {
      setFilter("locations", next.filter((v) => !ALL_INDIA_CITIES.includes(v) && v !== "All India"));
      return;
    }
    setFilter("locations", next);
  };

  const { mutate: submitCampaign, isPending: submitting, error: submitError } = useMutation({
    mutationFn: () =>
      parseCompanyCampaignFn({
        data: {
          name: campaignName,
          jdText: inputMode === "jd" ? jdText : "",
          roles: inputMode === "roles" ? roles : [],
          target_company_ids: selectedCompanyIds,
          target_tags: selectedTags,
          filters,
        },
      }),
    onSuccess: (data) => {
      window.location.href = `/experienced/${data.campaignId}`;
    },
  });

  const hasInput = inputMode === "jd" ? jdText.trim().length > 0 : roles.length > 0;
  const canSubmit =
    campaignName.trim().length > 0 && hasInput && selectedCompanyIds.length > 0;

  const selectedVisibleCount = visibleCompanies.filter((c) =>
    selectedCompanyIds.includes(c.id),
  ).length;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl w-full p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border">
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            New Campaign
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-300">
              <Building2 className="h-3 w-3" />
              From Companies
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0" style={{ maxHeight: "calc(90vh - 130px)" }}>
          {/* ── Left column: name + JD/roles ── */}
          <div className="flex flex-col gap-4 w-[40%] shrink-0 border-r border-border px-5 py-4 overflow-y-auto">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Campaign Name</Label>
              <Input
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="e.g. Drone Engineers — Q3 2025"
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium">Role Input</Label>
              <div className="flex gap-1.5">
                {(["jd", "roles"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setInputMode(mode)}
                    className={cn(
                      "flex-1 rounded border px-2 py-1.5 text-xs transition-colors",
                      inputMode === mode
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border text-muted-foreground hover:bg-accent",
                    )}
                  >
                    {mode === "jd" ? "Paste JD" : "Enter Roles"}
                  </button>
                ))}
              </div>

              {inputMode === "jd" ? (
                <div className="space-y-2">
                  <div className="flex gap-1.5">
                    <Input
                      ref={jdUrlRef}
                      placeholder="https://company.com/careers/..."
                      className="h-8 text-xs flex-1"
                      onKeyDown={(e) => e.key === "Enter" && handleScrapeUrl()}
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-8 text-xs shrink-0"
                      onClick={handleScrapeUrl}
                      disabled={scrapeLoading}
                    >
                      {scrapeLoading ? "Scraping…" : "Scrape"}
                    </Button>
                  </div>
                  {scrapeError && (
                    <p className="text-xs text-destructive">{scrapeError}</p>
                  )}
                  <Textarea
                    value={jdText}
                    onChange={(e) => setJdText(e.target.value)}
                    placeholder="Paste the full JD here…"
                    className="min-h-[200px] text-xs resize-none"
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <p className="text-[11px] text-muted-foreground">
                    Enter role titles — Haiku will use these as search keywords and score candidates against them.
                  </p>
                  <FreeTextMultiSelect
                    selected={roles}
                    onChange={setRoles}
                    placeholder="e.g. UAV Engineer, press Enter…"
                  />
                </div>
              )}
            </div>
          </div>

          {/* ── Right column: tabs ── */}
          <div className="flex-1 flex flex-col min-h-0">
            {/* Tab headers */}
            <div className="flex border-b border-border shrink-0">
              <button
                onClick={() => setRightTab("companies")}
                className={cn(
                  "px-4 py-2.5 text-xs font-medium border-b-2 transition-colors",
                  rightTab === "companies"
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                Companies
                {selectedCompanyIds.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                    {selectedCompanyIds.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setRightTab("filters")}
                className={cn(
                  "px-4 py-2.5 text-xs font-medium border-b-2 transition-colors",
                  rightTab === "filters"
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                Scoring Filters
              </button>
            </div>

            {/* Companies tab */}
            {rightTab === "companies" && (
              <div className="flex flex-col min-h-0 flex-1 px-5 py-3 gap-3">
                {/* Tag filter */}
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1.5">
                    Filter by tag
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {ALL_TAGS.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => toggleTag(tag)}
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[11px] transition-colors",
                          selectedTags.includes(tag)
                            ? "border-primary/40 bg-primary/10 text-foreground"
                            : "border-border text-muted-foreground hover:bg-accent",
                        )}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Controls row */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                  {companiesLoading ? (
                    <span>Loading companies…</span>
                  ) : (
                    <>
                      <span>
                        {selectedVisibleCount}/{visibleCompanies.length} shown selected
                      </span>
                      <span>·</span>
                      <button onClick={selectAll} className="text-primary hover:underline">
                        Select all
                      </button>
                      <button onClick={deselectAll} className="text-muted-foreground hover:underline">
                        Deselect all
                      </button>
                    </>
                  )}
                </div>

                {/* Company list */}
                <ScrollArea className="flex-1">
                  <div className="space-y-0.5 pr-1">
                    {visibleCompanies.map((company) => (
                      <label
                        key={company.id}
                        className="flex items-start gap-2.5 rounded px-1.5 py-1.5 hover:bg-accent/50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedCompanyIds.includes(company.id)}
                          onChange={() => toggleCompany(company.id)}
                          className="mt-0.5 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-xs font-medium">{company.name}</span>
                            {company.industry && (
                              <span className="text-[11px] text-muted-foreground truncate">
                                {company.industry}
                              </span>
                            )}
                          </div>
                          {company.tags.length > 0 && (
                            <div className="flex flex-wrap gap-0.5 mt-0.5">
                              {company.tags.slice(0, 4).map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded bg-accent px-1 py-0 text-[10px] text-muted-foreground"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </label>
                    ))}
                    {!companiesLoading && visibleCompanies.length === 0 && (
                      <p className="py-6 text-center text-xs text-muted-foreground">
                        No active companies match the selected tags.
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Filters tab */}
            {rightTab === "filters" && (
              <ScrollArea className="flex-1 px-5 py-4">
                <div className="space-y-5 pr-1">
                  <p className="text-[11px] text-muted-foreground -mb-2">
                    Filters are used when scoring candidates — leave empty for no restriction.
                  </p>

                  <div>
                    <FilterLabel>Years of Experience</FilterLabel>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 space-y-1">
                        <div className="text-[10px] text-muted-foreground">Min</div>
                        <Input
                          type="number"
                          min={0}
                          value={filters.exp_min}
                          onChange={(e) => setFilter("exp_min", parseInt(e.target.value) || 0)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="pt-5 text-muted-foreground text-xs">–</div>
                      <div className="flex-1 space-y-1">
                        <div className="text-[10px] text-muted-foreground">Max (optional)</div>
                        <Input
                          type="number"
                          min={0}
                          value={filters.exp_max}
                          onChange={(e) => setFilter("exp_max", e.target.value)}
                          placeholder="No limit"
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <FilterLabel>Domain</FilterLabel>
                    <CreatableMultiSelect
                      suggestions={DOMAIN_SUGGESTIONS}
                      selected={filters.domains}
                      onChange={(v) => setFilter("domains", v)}
                      placeholder="Any domain"
                    />
                  </div>

                  <div>
                    <FilterLabel>Location</FilterLabel>
                    <MultiSelect
                      options={LOCATION_OPTIONS}
                      selected={filters.locations}
                      onChange={handleLocationChange}
                      placeholder="Any location"
                    />
                  </div>

                  <div>
                    <FilterLabel>Employment Status</FilterLabel>
                    <MultiSelect
                      options={EMPLOYMENT_STATUS_OPTIONS}
                      selected={filters.employment_statuses}
                      onChange={(v) => setFilter("employment_statuses", v)}
                      placeholder="Any status"
                    />
                  </div>

                  <div>
                    <FilterLabel>Industry</FilterLabel>
                    <MultiSelect
                      options={INDUSTRY_OPTIONS}
                      selected={filters.industries}
                      onChange={(v) => setFilter("industries", v)}
                      placeholder="Any industry"
                    />
                  </div>
                </div>
              </ScrollArea>
            )}
          </div>
        </div>

        <DialogFooter className="px-6 py-3 border-t border-border flex-col items-end gap-2">
          {submitError && (
            <p className="text-xs text-destructive w-full">
              {submitError instanceof Error ? submitError.message : "Something went wrong."}
            </p>
          )}
          {selectedCompanyIds.length === 0 && (
            <p className="text-xs text-muted-foreground w-full">
              Select at least one company to continue.
            </p>
          )}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => submitCampaign()}
              disabled={!canSubmit || submitting}
            >
              {submitting
                ? "Creating…"
                : selectedCompanyIds.length > 0
                ? `Search ${selectedCompanyIds.length} Compan${selectedCompanyIds.length === 1 ? "y" : "ies"}`
                : "Create Campaign"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<string, string> = {
  done:      "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  searching: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  error:     "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  pending:   "bg-muted text-muted-foreground",
};

const STATUS_LABELS: Record<string, string> = {
  done:      "Done",
  searching: "Searching",
  error:     "Error",
  pending:   "Pending",
};

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.pending;
  const label = STATUS_LABELS[status] ?? status;
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium", style)}>
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function Experienced() {
  const [modalOpen, setModalOpen] = useState(false);
  const [companyModalOpen, setCompanyModalOpen] = useState(false);
  const [campaignTab, setCampaignTab] = useState<"standard" | "company_targeted">("standard");
  const navigate = useNavigate();
  const matchRoute = useMatchRoute();
  const isChildActive = matchRoute({ to: "/experienced/$campaignId" });

  const { data: campaigns, isLoading, error: fetchError } = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => getCampaignsFn(),
    enabled: !isChildActive,
  });

  if (isChildActive) {
    return <Outlet />;
  }

  const filteredCampaigns = (campaigns ?? []).filter((c) =>
    campaignTab === "standard"
      ? !c.type || c.type === "standard"
      : c.type === "company_targeted",
  );

  const standardCount = (campaigns ?? []).filter(
    (c) => !c.type || c.type === "standard",
  ).length;
  const companyCount = (campaigns ?? []).filter(
    (c) => c.type === "company_targeted",
  ).length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopNav health="fail" hideCompetitions />

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Experienced Candidates</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Search professionals by JD and filters.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/experienced/candidates">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                Master Database
              </Button>
            </Link>
            <Link to="/experienced/companies">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                Target Companies
              </Button>
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  New Campaign
                  <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={() => setModalOpen(true)}>
                  <div>
                    <p className="text-sm font-medium">General Search</p>
                    <p className="text-xs text-muted-foreground">Search by JD + keyword filters</p>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCompanyModalOpen(true)}>
                  <div>
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-amber-600" />
                      From Companies
                    </p>
                    <p className="text-xs text-muted-foreground">Find employees at target companies</p>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Campaign type tabs */}
        {!isLoading && campaigns && campaigns.length > 0 && (
          <div className="flex gap-0 border-b border-border mb-4">
            <button
              onClick={() => setCampaignTab("standard")}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                campaignTab === "standard"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              General
              {standardCount > 0 && (
                <span className="ml-1.5 text-[11px] text-muted-foreground">({standardCount})</span>
              )}
            </button>
            <button
              onClick={() => setCampaignTab("company_targeted")}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5",
                campaignTab === "company_targeted"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Building2 className="h-3.5 w-3.5" />
              From Companies
              {companyCount > 0 && (
                <span className="text-[11px] text-muted-foreground">({companyCount})</span>
              )}
            </button>
          </div>
        )}

        {/* Campaign list */}
        {isLoading && (
          <p className="text-sm text-muted-foreground">Loading campaigns…</p>
        )}
        {fetchError && (
          <p className="text-sm text-destructive">
            {fetchError instanceof Error ? fetchError.message : "Failed to load campaigns."}
          </p>
        )}
        {!isLoading && !fetchError && filteredCampaigns.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <p className="text-sm text-muted-foreground">
              {campaignTab === "standard"
                ? "No general campaigns yet."
                : "No company campaigns yet."}
            </p>
            <Button
              onClick={() =>
                campaignTab === "standard" ? setModalOpen(true) : setCompanyModalOpen(true)
              }
              variant="outline"
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              {campaignTab === "standard" ? "Create your first campaign" : "Create company campaign"}
            </Button>
          </div>
        )}
        {!isLoading && filteredCampaigns.length > 0 && (
          <div className="grid gap-3">
            {filteredCampaigns.map((c) => (
              <button
                key={c.id}
                onClick={() => navigate({ to: "/experienced/$campaignId", params: { campaignId: c.id } })}
                className="w-full text-left rounded-lg border border-border bg-card px-5 py-4 hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex items-center gap-2">
                    {c.type === "company_targeted" && (
                      <Building2 className="h-4 w-4 shrink-0 text-amber-600" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(c.created_at).toLocaleDateString("en-IN", {
                          day: "numeric", month: "short", year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={c.status ?? "pending"} />
                </div>
                <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                  <span>{c.candidate_count ?? 0} candidates</span>
                  <span>{c.company_count ?? 0} companies</span>
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="mt-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Talent Radar
          </Link>
        </div>
      </div>

      <CampaignModal open={modalOpen} onClose={() => setModalOpen(false)} />
      <CompanyCampaignModal open={companyModalOpen} onClose={() => setCompanyModalOpen(false)} />
    </div>
  );
}
