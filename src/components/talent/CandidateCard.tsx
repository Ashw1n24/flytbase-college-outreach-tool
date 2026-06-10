import { Linkedin, Mail, Github, Award, UserCheck } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  type Candidate,
  CATEGORY_CLASS,
  TIER_META,
  EMAIL_CONFIDENCE_LABEL,
} from "@/data/talent";
import { useTalent } from "@/context/TalentContext";
import { AddToPipelineMenu } from "./AddToPipelineMenu";
import { cn } from "@/lib/utils";

interface Props {
  candidate: Candidate;
  selected: boolean;
  onToggleSelect: (id: string) => void;
}

export function CandidateCard({ candidate, selected, onToggleSelect }: Props) {
  const c = candidate;
  const { openDrawer } = useTalent();
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => openDrawer(c.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter") openDrawer(c.id);
      }}
      className={cn(
        "group cursor-pointer rounded-lg border bg-card p-4 shadow-sm transition-all hover:border-border hover:shadow-md",
        selected
          ? "border-primary/40 bg-accent/40 ring-1 ring-primary/30"
          : "border-border",
        c.in_pipeline && "border-l-4 border-l-ok",
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggleSelect(c.id)}
          onClick={(e) => e.stopPropagation()}
          className="mt-1"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold">{c.full_name}</h3>
            {c.in_pipeline && (
              <span className="rounded bg-por px-1.5 py-0.5 text-[10px] font-medium text-por-fg">
                In pipeline
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {c.university} · {c.degree} {c.branch} · Class of {c.graduation_year}
          </p>
        </div>
        <AddToPipelineMenu candidateId={c.id} />
      </div>

      {/* Competitions */}
      {c.competitions.length > 0 && (
        <div className="mt-3 flex items-start gap-2">
          <Award className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <div className="flex flex-wrap gap-1.5">
            {c.competitions.map((comp, i) => {
              const tier = TIER_META[comp.result_tier];
              return (
                <span
                  key={i}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium",
                    CATEGORY_CLASS[comp.competition_category],
                  )}
                >
                  {tier.icon && <span>{tier.icon}</span>}
                  {comp.competition_name} · {tier.label} {comp.year}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* PoRs */}
      {c.positions.length > 0 && (
        <div className="mt-2 flex items-start gap-2">
          <UserCheck className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <div className="flex flex-wrap gap-1.5">
            {c.positions.map((p, i) => (
              <span
                key={i}
                className="inline-flex items-center rounded-md bg-por px-2 py-0.5 text-[11px] font-medium text-por-fg"
              >
                {p.role_title}, {p.organisation_name} {p.year_start}–
                {p.year_end ?? "present"}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Contact */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border pt-3 text-xs">
        {c.linkedin_url && (
          <a
            href={`https://${c.linkedin_url}`}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-primary"
          >
            <Linkedin className="h-3.5 w-3.5" />
            {c.linkedin_url}
          </a>
        )}
        {c.email ? (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Mail className="h-3.5 w-3.5" />
            {c.email}
            {c.email_confidence && (
              <span className="rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">
                {EMAIL_CONFIDENCE_LABEL[c.email_confidence]}
              </span>
            )}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground/60">
            <Mail className="h-3.5 w-3.5" />
            No email — enrich on add
          </span>
        )}
        {c.github_url && (
          <a
            href={`https://${c.github_url}`}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-primary"
          >
            <Github className="h-3.5 w-3.5" />
            github
          </a>
        )}
      </div>
    </div>
  );
}