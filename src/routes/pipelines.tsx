import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Users, Trash2, FolderKanban } from "lucide-react";
import { TopNav } from "@/components/talent/TopNav";
import { Button } from "@/components/ui/button";
import { useTalent } from "@/context/TalentContext";
import { EMAIL_CONFIDENCE_LABEL, TIER_META } from "@/data/talent";
import { cn } from "@/lib/utils";

type PipelineSearch = { pipeline?: string };

export const Route = createFileRoute("/pipelines")({
  validateSearch: (search: Record<string, unknown>): PipelineSearch => ({
    pipeline: typeof search.pipeline === "string" ? search.pipeline : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Pipelines · High-Agency Talent Engine" },
      {
        name: "description",
        content: "Manage saved candidate pipelines for FlytBase hiring.",
      },
    ],
  }),
  component: PipelinesPage,
});

function PipelinesPage() {
  const { pipeline: pipelineParam } = Route.useSearch();
  const { pipelines, candidatesInPipeline, removeFromPipeline, openDrawer } =
    useTalent();
  const [active, setActive] = useState(
    pipelineParam ?? pipelines[0]?.id ?? "",
  );

  const current = pipelines.find((p) => p.id === active) ?? pipelines[0];
  const rows = current ? candidatesInPipeline(current.id) : [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopNav health="fail" />
      <div className="mx-auto max-w-6xl px-6 py-6">
        <Link
          to="/"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to search
        </Link>

        <div className="flex items-center gap-2">
          <FolderKanban className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold tracking-tight">Pipelines</h1>
        </div>

        {/* Pipeline tabs */}
        <div className="mt-4 flex flex-wrap gap-2 border-b border-border pb-3">
          {pipelines.map((p) => {
            const count = candidatesInPipeline(p.id).length;
            return (
              <button
                key={p.id}
                onClick={() => setActive(p.id)}
                className={cn(
                  "flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors",
                  current?.id === p.id
                    ? "border-primary bg-accent text-accent-foreground"
                    : "border-border text-muted-foreground hover:bg-accent/50",
                )}
              >
                {p.name}
                <span className="rounded bg-muted px-1.5 text-xs">{count}</span>
              </button>
            );
          })}
        </div>

        {current && (
          <p className="mt-3 text-sm text-muted-foreground">
            {current.description}
          </p>
        )}

        {/* Table */}
        <div className="mt-4 overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Candidate</th>
                <th className="px-4 py-2.5 font-medium">University</th>
                <th className="px-4 py-2.5 font-medium">Top Result</th>
                <th className="px-4 py-2.5 font-medium">Email</th>
                <th className="px-4 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    <Users className="mx-auto mb-2 h-6 w-6 opacity-50" />
                    No candidates in this pipeline yet. Add candidates from the
                    search view.
                  </td>
                </tr>
              )}
              {rows.map((c) => {
                const top = c.competitions[0];
                return (
                  <tr
                    key={c.id}
                    className="cursor-pointer hover:bg-accent/40"
                    onClick={() => openDrawer(c.id)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">{c.full_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {c.degree} {c.branch} · {c.graduation_year}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.university}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {top
                        ? `${TIER_META[top.result_tier].icon} ${top.competition_name}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.email ? (
                        <span className="inline-flex items-center gap-1.5">
                          {c.email}
                          {c.email_confidence && (
                            <span className="rounded bg-muted px-1 py-0.5 text-[10px]">
                              {EMAIL_CONFIDENCE_LABEL[c.email_confidence]}
                            </span>
                          )}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 text-xs text-muted-foreground hover:text-fail"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFromPipeline(c.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}