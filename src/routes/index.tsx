import { createFileRoute } from "@tanstack/react-router";
import { TopNav } from "@/components/talent/TopNav";
import { FilterPanel } from "@/components/talent/FilterPanel";
import { ResultsPanel } from "@/components/talent/ResultsPanel";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "High-Agency Talent Engine · FlytBase" },
      {
        name: "description",
        content:
          "Internal sourcing engine for discovering high-agency students and graduates from Tier 1 institutions by proof of work.",
      },
      { property: "og:title", content: "High-Agency Talent Engine · FlytBase" },
      {
        property: "og:description",
        content:
          "Source high-agency candidates by competitions won and positions of responsibility held.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopNav health="fail" />
      <div className="flex">
        <FilterPanel />
        <ResultsPanel />
      </div>
    </div>
  );
}
