import { ChevronDown, ChevronLeft, ChevronRight, Download, Loader2, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CandidateCard } from "./CandidateCard";
import { BulkActionBar } from "./BulkActionBar";
import { useSearchContext } from "@/context/SearchContext";
import { useTalent } from "@/context/TalentContext";

const SORT_OPTIONS = [
  {
    label: "Grad Year (newest)",
    sort_by: "graduation_year" as const,
    sort_dir: "desc" as const,
  },
  {
    label: "Grad Year (oldest)",
    sort_by: "graduation_year" as const,
    sort_dir: "asc" as const,
  },
  {
    label: "Most Wins",
    sort_by: "competition_count" as const,
    sort_dir: "desc" as const,
  },
  {
    label: "Name (A–Z)",
    sort_by: "name" as const,
    sort_dir: "asc" as const,
  },
];

function sortLabel(
  sortBy: string | undefined,
  sortDir: string | undefined,
): string {
  const match = SORT_OPTIONS.find(
    (o) => o.sort_by === sortBy && o.sort_dir === sortDir,
  );
  return match?.label ?? "Grad Year (newest)";
}

export function ResultsPanel() {
  const {
    results,
    totalCount,
    page,
    limit,
    isLoading,
    isFetching,
    error,
    filters,
    setSort,
    setPage,
    selectedIds,
    toggleSelect,
    clearSelection,
  } = useSearchContext();
  const { addToPipeline } = useTalent();

  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  const currentSort = sortLabel(filters.sort_by, filters.sort_dir);
  const rangeStart = totalCount === 0 ? 0 : page * limit + 1;
  const rangeEnd = Math.min(totalCount, (page + 1) * limit);

  return (
    <main className="flex min-w-0 flex-1 flex-col bg-background">
      <div className="sticky top-14 z-20 flex items-center gap-3 border-b border-border bg-background/95 px-6 py-3 backdrop-blur">
        <p className="text-sm">
          {isLoading ? (
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Searching…
            </span>
          ) : (
            <>
              Showing{" "}
              <span className="font-semibold">
                {rangeStart === rangeEnd
                  ? rangeStart
                  : `${rangeStart}–${rangeEnd}`}
              </span>{" "}
              of <span className="font-semibold">{totalCount}</span> candidates
            </>
          )}
        </p>
        <div className="ml-auto flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Sort: {currentSort}
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {SORT_OPTIONS.map((o) => (
                <DropdownMenuItem
                  key={o.label}
                  onClick={() => setSort(o.sort_by, o.sort_dir)}
                >
                  {o.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" className="h-8 gap-1.5">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="relative flex-1 space-y-3 p-6">
        {isFetching && !isLoading && (
          <div className="pointer-events-none absolute inset-x-6 top-0 z-10 h-0.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-1/3 animate-pulse bg-primary" />
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Failed to load candidates. Check your Supabase connection and try
            again.
          </div>
        )}

        {!isLoading && !error && results.length === 0 && (
          <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
            No candidates match your filters. Try widening your search or clear
            filters.
          </div>
        )}

        {results.map((c) => (
          <CandidateCard
            key={c.id}
            candidate={c}
            selected={selectedIds.has(c.id)}
            onToggleSelect={toggleSelect}
          />
        ))}
      </div>

      {totalCount > limit && (
        <div className="flex items-center justify-between border-t border-border px-6 py-3">
          <p className="text-xs text-muted-foreground">
            Page {page + 1} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              disabled={page === 0 || isFetching}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              disabled={page >= totalPages - 1 || isFetching}
              onClick={() => setPage(page + 1)}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <BulkActionBar
        count={selectedIds.size}
        onClear={clearSelection}
        onAddToPipeline={(pipelineId) => {
          for (const id of selectedIds) {
            addToPipeline(id, pipelineId);
          }
          clearSelection();
        }}
      />
    </main>
  );
}
