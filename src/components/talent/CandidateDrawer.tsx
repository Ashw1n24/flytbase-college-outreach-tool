import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Award,
  UserCheck,
  ExternalLink,
  Linkedin,
  Github,
  Mail,
  GraduationCap,
  StickyNote,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useTalent } from "@/context/TalentContext";
import { getCandidateByIdFn } from "@/lib/api/candidates.functions";
import {
  CATEGORY_CLASS,
  TIER_META,
  EMAIL_CONFIDENCE_LABEL,
  sourceUrlFor,
} from "@/data/talent";
import { AddToPipelineMenu } from "./AddToPipelineMenu";
import { cn } from "@/lib/utils";

function SourceLink({ name, url }: { name: string; url?: string | null }) {
  return (
    <a
      href={sourceUrlFor(name, url)}
      target="_blank"
      rel="noreferrer"
      title="View source"
      className="inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-primary"
    >
      <ExternalLink className="h-3.5 w-3.5" />
      Source
    </a>
  );
}

export function CandidateDrawer() {
  const { openCandidateId, closeDrawer, notes, setNote, pipelineOf } =
    useTalent();
  const open = Boolean(openCandidateId);

  const { data: c, isLoading } = useQuery({
    queryKey: ["candidate", openCandidateId],
    queryFn: () =>
      getCandidateByIdFn({ data: { id: openCandidateId! } }),
    enabled: Boolean(openCandidateId),
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDrawer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeDrawer]);

  const pipeline = c ? pipelineOf(c.id) : null;

  return (
    <>
      <div
        onClick={closeDrawer}
        className={cn(
          "fixed inset-0 z-50 bg-foreground/30 transition-opacity duration-300",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <aside
        className={cn(
          "fixed right-0 top-0 z-50 flex h-screen w-[480px] max-w-[92vw] flex-col border-l border-border bg-card shadow-2xl transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "translate-x-full",
        )}
        aria-hidden={!open}
      >
        {open && isLoading && (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading profile…
          </div>
        )}

        {c && (
          <>
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5"
                onClick={closeDrawer}
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <div className="ml-auto">
                <AddToPipelineMenu candidateId={c.id} />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="border-b border-border px-5 py-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold tracking-tight">
                    {c.full_name}
                  </h2>
                  {pipeline && (
                    <span className="rounded bg-por px-1.5 py-0.5 text-[10px] font-medium text-por-fg">
                      {pipeline.name}
                    </span>
                  )}
                </div>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <GraduationCap className="h-3.5 w-3.5" />
                  {c.university} · {c.degree} {c.branch} · Class of{" "}
                  {c.graduation_year}
                </p>
              </div>

              <section className="border-b border-border px-5 py-4">
                <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Award className="h-4 w-4" />
                  Competition History
                  <span className="ml-auto font-normal">
                    {c.competitions.length}
                  </span>
                </h3>
                <ul className="mt-3 space-y-2">
                  {c.competitions.map((comp, i) => {
                    const tier = TIER_META[comp.result_tier];
                    return (
                      <li
                        key={i}
                        className="flex items-start gap-2 rounded-md border border-border p-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium",
                                CATEGORY_CLASS[comp.competition_category],
                              )}
                            >
                              {tier.icon && <span>{tier.icon}</span>}
                              {tier.label}
                            </span>
                            <span className="text-sm font-medium">
                              {comp.competition_name}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {comp.year}
                            {comp.team_name ? ` · Team ${comp.team_name}` : ""}
                          </p>
                        </div>
                        <SourceLink
                          name={comp.competition_name}
                          url={comp.source_url}
                        />
                      </li>
                    );
                  })}
                </ul>
              </section>

              <section className="border-b border-border px-5 py-4">
                <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <UserCheck className="h-4 w-4" />
                  Positions of Responsibility
                  <span className="ml-auto font-normal">
                    {c.positions.length}
                  </span>
                </h3>
                <ul className="mt-3 space-y-2">
                  {c.positions.map((p, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 rounded-md border border-border p-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{p.role_title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {p.organisation_name} · {p.year_start}–
                          {p.year_end ?? "present"}
                        </p>
                      </div>
                      <SourceLink name={p.organisation_name} url={p.source_url} />
                    </li>
                  ))}
                </ul>
              </section>

              <section className="border-b border-border px-5 py-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Contact
                </h3>
                <div className="mt-3 space-y-2 text-sm">
                  {c.linkedin_url ? (
                    <a
                      href={`https://${c.linkedin_url}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 text-muted-foreground hover:text-primary"
                    >
                      <Linkedin className="h-4 w-4 shrink-0" />
                      <span className="truncate">{c.linkedin_url}</span>
                    </a>
                  ) : (
                    <p className="flex items-center gap-2 text-muted-foreground/60">
                      <Linkedin className="h-4 w-4 shrink-0" />
                      No LinkedIn found
                    </p>
                  )}

                  {c.github_url ? (
                    <a
                      href={`https://${c.github_url}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 text-muted-foreground hover:text-primary"
                    >
                      <Github className="h-4 w-4 shrink-0" />
                      <span className="truncate">{c.github_url}</span>
                    </a>
                  ) : (
                    <p className="flex items-center gap-2 text-muted-foreground/60">
                      <Github className="h-4 w-4 shrink-0" />
                      No GitHub found
                    </p>
                  )}

                  {c.email ? (
                    <a
                      href={`mailto:${c.email}`}
                      className="flex items-center gap-2 text-muted-foreground hover:text-primary"
                    >
                      <Mail className="h-4 w-4 shrink-0" />
                      <span className="truncate">{c.email}</span>
                      {c.email_confidence && (
                        <span className="shrink-0 rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">
                          [{EMAIL_CONFIDENCE_LABEL[c.email_confidence]}]
                        </span>
                      )}
                    </a>
                  ) : (
                    <p className="flex items-center gap-2 text-muted-foreground/60">
                      <Mail className="h-4 w-4 shrink-0" />
                      No email — enrich on add
                    </p>
                  )}
                </div>
              </section>

              <section className="px-5 py-4">
                <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <StickyNote className="h-4 w-4" />
                  Notes
                </h3>
                <Textarea
                  value={notes[c.id] ?? ""}
                  onChange={(e) => setNote(c.id, e.target.value)}
                  placeholder="Add recruiter notes — outreach status, screening feedback, etc. Saved locally."
                  className="mt-3 min-h-28 resize-none text-sm"
                />
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Saved to local state for this session.
                </p>
              </section>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
