import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Users, Trash2, FolderKanban, Download, ExternalLink, Send } from "lucide-react";
import { TopNav } from "@/components/talent/TopNav";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { useTalent } from "@/context/TalentContext";
import { getCandidatesByIdsFn } from "@/lib/api/candidates.functions";
import { getExpCandidatesByIdsFn } from "@/lib/api/experienced.functions";
import { addToOutreachQueueFn, getOutreachTemplatesFn } from "@/lib/api/outreach.functions";
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

const EXP_TIER_META: Record<string, { label: string; badge: string }> = {
  strong:  { label: "Strong",  badge: "bg-ok/15 text-ok border border-ok/30" },
  good:    { label: "Good",    badge: "bg-blue-500/15 text-blue-400 border border-blue-500/30" },
  partial: { label: "Partial", badge: "bg-warn/15 text-warn border border-warn/30" },
};

// ---------------------------------------------------------------------------
// Outreach queue dialog for pipeline
// ---------------------------------------------------------------------------

function PipelineOutreachDialog({
  open,
  onClose,
  candidateIds,
  candidateType = "experienced",
}: {
  open: boolean;
  onClose: () => void;
  candidateIds: string[];
  candidateType?: "student" | "experienced";
}) {
  const [channel, setChannel]       = useState<"email" | "linkedin">("email");
  const [templateId, setTemplateId] = useState("");

  const { data: templates } = useQuery({
    queryKey: ["outreach-templates"],
    queryFn:  () => getOutreachTemplatesFn(),
    enabled:  open,
  });

  const filteredTemplates = (templates ?? []).filter(
    (t) =>
      (t.pipeline === candidateType || t.pipeline === "both") &&
      t.message_type === "initial" &&
      t.channel === channel,
  );

  useEffect(() => {
    if (filteredTemplates.length > 0 && !filteredTemplates.find((t) => t.id === templateId)) {
      setTemplateId(filteredTemplates[0].id);
    }
  }, [channel, filteredTemplates.length]);

  const queueMutation = useMutation({
    mutationFn: () =>
      addToOutreachQueueFn({ data: { candidateIds, candidateType, channel, templateId } }),
    onSuccess: (result) => {
      alert(`Queued ${result.queued} candidate(s) as drafts. ${result.skipped} skipped (already queued or missing contact info).`);
      onClose();
    },
  });

  const selectedTemplate = filteredTemplates.find((t) => t.id === templateId);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Queue Pipeline for Outreach</DialogTitle>
          <DialogDescription>
            {candidateIds.length} {candidateType} candidate{candidateIds.length !== 1 ? "s" : ""} → outreach drafts
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Channel */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Channel</p>
            <div className="flex gap-2">
              {(["email", "linkedin"] as const).map((ch) => (
                <button
                  key={ch}
                  onClick={() => setChannel(ch)}
                  className={cn(
                    "flex-1 rounded-md border px-3 py-2 text-xs capitalize transition-colors",
                    channel === ch
                      ? "border-primary bg-primary/10 font-medium"
                      : "border-border text-muted-foreground hover:border-primary/40",
                  )}
                >
                  {ch}
                </button>
              ))}
            </div>
          </div>

          {/* Template */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Template</p>
            {filteredTemplates.length === 0 ? (
              <p className="text-xs text-muted-foreground">No templates for this channel.</p>
            ) : (
              <div className="space-y-1.5">
                {filteredTemplates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTemplateId(t.id)}
                    className={cn(
                      "w-full text-left rounded-md border px-3 py-2 text-xs transition-colors",
                      templateId === t.id
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/40",
                    )}
                  >
                    <span className="font-medium">{t.name}</span>
                    {t.subject_template && (
                      <span className="block text-muted-foreground mt-0.5 truncate">{t.subject_template}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Template preview */}
          {selectedTemplate?.body_template && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Preview</p>
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2.5 text-[11px] text-muted-foreground whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto">
                {selectedTemplate.body_template}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Variables like <span className="font-mono">{"{{candidate_name}}"}</span> are filled per candidate at send time.
              </p>
            </div>
          )}

          {queueMutation.error && (
            <p className="text-xs text-destructive">
              {queueMutation.error instanceof Error ? queueMutation.error.message : "Failed"}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={queueMutation.isPending}>Cancel</Button>
          <Button
            size="sm"
            onClick={() => queueMutation.mutate()}
            disabled={!templateId || candidateIds.length === 0 || queueMutation.isPending}
          >
            {queueMutation.isPending ? "Queuing…" : "Queue"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------

function PipelinesPage() {
  const { pipeline: pipelineParam } = Route.useSearch();
  const {
    pipelines,
    pipelineMemberIds,
    pipelineMemberCount,
    expMemberIds,
    removeFromPipeline,
    removeFromExpPipeline,
    openDrawer,
  } = useTalent();
  const [active, setActive] = useState(
    pipelineParam ?? pipelines[0]?.id ?? "",
  );
  const [outreachOpen, setOutreachOpen] = useState(false);
  const [studentOutreachOpen, setStudentOutreachOpen] = useState(false);

  const current = pipelines.find((p) => p.id === active) ?? pipelines[0];
  const studentIds = current ? pipelineMemberIds(current.id) : [];
  const experiencedIds = current ? expMemberIds(current.id) : [];

  const { data: studentRows = [], isLoading: studentsLoading } = useQuery({
    queryKey: ["pipeline-students", studentIds],
    queryFn: () => getCandidatesByIdsFn({ data: { ids: studentIds } }),
    enabled: studentIds.length > 0,
  });

  const { data: expRows = [], isLoading: expLoading } = useQuery({
    queryKey: ["pipeline-experienced", experiencedIds],
    queryFn: () => getExpCandidatesByIdsFn({ data: { ids: experiencedIds } }),
    enabled: experiencedIds.length > 0,
  });

  const orderedStudents = useMemo(() => {
    const byId = new Map(studentRows.map((c) => [c.id, c]));
    return studentIds.map((id) => byId.get(id)).filter(Boolean) as typeof studentRows;
  }, [studentIds, studentRows]);

  const orderedExp = useMemo(() => {
    const byId = new Map(expRows.map((c) => [c.id, c]));
    return experiencedIds.map((id) => byId.get(id)).filter(Boolean) as typeof expRows;
  }, [experiencedIds, expRows]);

  const totalCount = studentIds.length + experiencedIds.length;

  const handleExportCsv = () => {
    const escape = (v: unknown) => {
      const t = String(v ?? "");
      return /[,"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
    };
    const header = ["type", "name", "role_or_university", "email", "linkedin", "fit_tier", "fit_score"];
    const expCsvRows = orderedExp.map((c) => [
      "experienced",
      escape(c.full_name),
      escape([c.current_title, c.current_company].filter(Boolean).join(" @ ")),
      escape(c.email ?? ""),
      escape(c.linkedin_url ?? ""),
      escape(c.fit_tier ?? ""),
      escape(c.fit_score ?? ""),
    ].join(","));
    const studentCsvRows = orderedStudents.map((c) => [
      "student",
      escape(c.full_name),
      escape(`${c.degree ?? ""} ${c.branch ?? ""} · ${c.university}`),
      escape(c.email ?? ""),
      escape(c.linkedin_url ?? ""),
      escape("—"),
      escape("—"),
    ].join(","));
    const csv = [header.join(","), ...expCsvRows, ...studentCsvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${current?.name ?? "pipeline"}-candidates.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderKanban className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold tracking-tight">Pipelines</h1>
          </div>
          {totalCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={handleExportCsv}
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-b border-border pb-3">
          {pipelines.map((p) => {
            const count = pipelineMemberCount(p.id);
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

        {/* Experienced candidates section */}
        {(expLoading || experiencedIds.length > 0) && (
          <div className="mt-5">
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-400">
                Experienced
              </span>
              <span className="text-xs text-muted-foreground">
                {experiencedIds.length} candidate{experiencedIds.length !== 1 ? "s" : ""}
              </span>
              {experiencedIds.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto h-7 gap-1.5 text-xs"
                  onClick={() => setOutreachOpen(true)}
                >
                  <Send className="h-3.5 w-3.5" />
                  Queue for Outreach
                </Button>
              )}
            </div>
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Candidate</th>
                    <th className="px-4 py-2.5 font-medium">Current Role</th>
                    <th className="px-4 py-2.5 font-medium">Fit</th>
                    <th className="px-4 py-2.5 font-medium">Email</th>
                    <th className="px-4 py-2.5 font-medium">LinkedIn</th>
                    <th className="px-4 py-2.5 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {expLoading && experiencedIds.length > 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                        Loading…
                      </td>
                    </tr>
                  )}
                  {!expLoading && orderedExp.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                        <Users className="mx-auto mb-2 h-5 w-5 opacity-40" />
                        No experienced candidates in this pipeline.
                      </td>
                    </tr>
                  )}
                  {orderedExp.map((c) => {
                    const tier = c.fit_tier ? EXP_TIER_META[c.fit_tier] : null;
                    return (
                      <tr key={c.id} className="hover:bg-accent/30">
                        <td className="px-4 py-3 font-medium">{c.full_name}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {[c.current_title, c.current_company].filter(Boolean).join(" @ ") || "—"}
                        </td>
                        <td className="px-4 py-3">
                          {tier ? (
                            <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", tier.badge)}>
                              {tier.label} · {c.fit_score}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {c.email ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          {c.linkedin_url ? (
                            <a
                              href={c.linkedin_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 text-xs text-muted-foreground hover:text-fail"
                            onClick={() => removeFromExpPipeline(c.id)}
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
        )}

        {/* Student candidates section */}
        <div className="mt-5">
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded border border-ok/30 bg-ok/10 px-2 py-0.5 text-[11px] font-medium text-ok">
              Student
            </span>
            <span className="text-xs text-muted-foreground">
              {studentIds.length} candidate{studentIds.length !== 1 ? "s" : ""}
            </span>
            {studentIds.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="ml-auto h-7 gap-1.5 text-xs"
                onClick={() => setStudentOutreachOpen(true)}
              >
                <Send className="h-3.5 w-3.5" />
                Queue for Outreach
              </Button>
            )}
          </div>
          <div className="overflow-hidden rounded-lg border border-border">
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
                {studentsLoading && studentIds.length > 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                      Loading pipeline candidates…
                    </td>
                  </tr>
                )}
                {!studentsLoading && orderedStudents.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                      <Users className="mx-auto mb-2 h-6 w-6 opacity-50" />
                      No student candidates in this pipeline yet.
                    </td>
                  </tr>
                )}
                {orderedStudents.map((c) => {
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

      <PipelineOutreachDialog
        open={outreachOpen}
        onClose={() => setOutreachOpen(false)}
        candidateIds={experiencedIds}
        candidateType="experienced"
      />
      <PipelineOutreachDialog
        open={studentOutreachOpen}
        onClose={() => setStudentOutreachOpen(false)}
        candidateIds={studentIds}
        candidateType="student"
      />
    </div>
  );
}
