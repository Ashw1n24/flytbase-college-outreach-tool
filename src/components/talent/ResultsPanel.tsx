import { useState } from "react";
import { ChevronDown, Download, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CandidateCard } from "./CandidateCard";
import { BulkActionBar } from "./BulkActionBar";
import { useTalent } from "@/context/TalentContext";

export function ResultsPanel() {
  const { candidates, addToPipeline } = useTalent();
  const [selected, setSelected] = useState<string[]>([]);
  const [sort, setSort] = useState("Relevance");

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <main className="flex min-w-0 flex-1 flex-col bg-background">
      <div className="sticky top-14 z-20 flex items-center gap-3 border-b border-border bg-background/95 px-6 py-3 backdrop-blur">
        <p className="text-sm">
          Showing{" "}
          <span className="font-semibold">{candidates.length}</span>{" "}
          candidates
        </p>
        <div className="ml-auto flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Sort: {sort}
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {["Relevance", "Grad Year (newest)", "Most Wins", "Name (A–Z)"].map(
                (o) => (
                  <DropdownMenuItem key={o} onClick={() => setSort(o)}>
                    {o}
                  </DropdownMenuItem>
                ),
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" className="h-8 gap-1.5">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="flex-1 space-y-3 p-6">
        {candidates.map((c) => (
          <CandidateCard
            key={c.id}
            candidate={c}
            selected={selected.includes(c.id)}
            onToggleSelect={toggle}
          />
        ))}
      </div>

      <BulkActionBar
        count={selected.length}
        onClear={() => setSelected([])}
        onAddToPipeline={(pipelineId) => {
          selected.forEach((id) => addToPipeline(id, pipelineId));
          setSelected([]);
        }}
      />
    </main>
  );
}