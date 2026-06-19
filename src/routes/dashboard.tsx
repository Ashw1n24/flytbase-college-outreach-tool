import { createFileRoute } from "@tanstack/react-router";
import { TopNav } from "@/components/talent/TopNav";
import { FilterPanel } from "@/components/talent/FilterPanel";
import { ResultsPanel } from "@/components/talent/ResultsPanel";
import { SearchProvider } from "@/context/SearchContext";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Student Candidates · Talent Radar · FlytBase" },
      {
        name: "description",
        content:
          "Internal sourcing engine for discovering high-agency students and graduates from Tier 1 institutions by proof of work.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  return (
    <SearchProvider>
      <div className="min-h-screen bg-background text-foreground">
        <TopNav health="fail" />
        <div className="flex">
          <FilterPanel />
          <ResultsPanel />
        </div>
      </div>
    </SearchProvider>
  );
}
