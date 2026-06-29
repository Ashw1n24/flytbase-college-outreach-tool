import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Users, Trash2, FolderKanban, Download, ExternalLink, Send, Pencil, Check, X } from "lucide-react";
import { TopNav } from "@/components/talent/TopNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { useTalent } from "@/context/TalentContext";
import { getCandidatesByIdsFn } from "@/lib/api/candidates.functions";
import { getExpCandidatesByIdsFn } from "@/lib/api/experienced.functions";
import { addToOutreachQueueFn, getOutreachTemplatesFn, upsertOutreachTemplateFn } from "@/lib/api/outreach.functions";
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

type DialogMode = "template" | "custom";
type StepKey = "initial" | "followup_1" | "followup_2";
interface StepForm { enabled: boolean; subject_template: string; body_template: string; }
const EMPTY_STEP: StepForm = { enabled: false, subject_template: "", body_template: "" };
const DIALOG_STEPS: { key: StepKey; label: string; shortLabel: string }[] = [
  { key: "initial",    label: "Initial",     shortLabel: "1" },
  { key: "followup_1", label: "Follow-up 1", shortLabel: "2" },
  { key: "followup_2", label: "Follow-up 2", shortLabel: "3" },
];

function PipelineOutreachDialog({
  open,
  onClose,
  candidateIds,
  candidateType = "experienced",
  pipelineName = "Pipeline",
}: {
  open: boolean;
  onClose: () => void;
  candidateIds: string[];
  candidateType?: "student" | "experienced";
  pipelineName?: string;
}) {
  const queryClient = useQueryClient();
  const [mode, setMode]             = useState<DialogMode>("template");
  const [channel, setChannel]       = useState<"email" | "linkedin">("email");
  const [templateId, setTemplateId] = useState("");

  // Custom-mode state
  const [steps, setSteps]           = useState<Record<StepKey, StepForm>>({
    initial:    { ...EMPTY_STEP, enabled: true },
    followup_1: { ...EMPTY_STEP },
    followup_2: { ...EMPTY_STEP },
  });
  const [activeStep, setActiveStep] = useState<StepKey>("initial");

  const setStep = (key: StepKey, patch: Partial<StepForm>) =>
    setSteps((s) => ({ ...s, [key]: { ...s[key], ...patch } }));

  // Reset on open
  useEffect(() => {
    if (open) {
      setMode("template");
      setChannel("email");
      setTemplateId("");
      setSteps({ initial: { ...EMPTY_STEP, enabled: true }, followup_1: { ...EMPTY_STEP }, followup_2: { ...EMPTY_STEP } });
      setActiveStep("initial");
    }
  }, [open]);

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
    if (mode === "template" && filteredTemplates.length > 0 && !filteredTemplates.find((t) => t.id === templateId)) {
      setTemplateId(filteredTemplates[0].id);
    }
  }, [channel, mode, filteredTemplates.length]);

  // Template-mode queue
  const templateQueueMutation = useMutation({
    mutationFn: () =>
      addToOutreachQueueFn({ data: { candidateIds, candidateType, channel, templateId } }),
    onSuccess: (result) => {
      alert(`Queued ${result.queued} candidate(s) as drafts. ${result.skipped} skipped.`);
      onClose();
    },
  });

  // Custom-mode queue: save templates first, then queue
  const customQueueMutation = useMutation({
    mutationFn: async () => {
      const pipeline = candidateType === "student" ? "student" as const : "experienced" as const;
      // 1. Save initial (required) and capture its ID
      const initResult = await upsertOutreachTemplateFn({
        data: {
          name:             pipelineName,
          pipeline,
          message_type:     "initial",
          channel,
          subject_template: channel === "email" && steps.initial.subject_template ? steps.initial.subject_template : null,
          body_template:    steps.initial.body_template,
        },
      });
      const initialTemplateId = initResult.id!;
      // 2. Save follow-ups if enabled
      if (steps.followup_1.enabled && steps.followup_1.body_template.trim()) {
        await upsertOutreachTemplateFn({
          data: {
            name:             `${pipelineName} — Follow-up 1`,
            pipeline,
            message_type:     "followup_1",
            channel,
            subject_template: channel === "email" && steps.followup_1.subject_template ? steps.followup_1.subject_template : null,
            body_template:    steps.followup_1.body_template,
          },
        });
      }
      if (steps.followup_2.enabled && steps.followup_2.body_template.trim()) {
        await upsertOutreachTemplateFn({
          data: {
            name:             `${pipelineName} — Follow-up 2`,
            pipeline,
            message_type:     "followup_2",
            channel,
            subject_template: channel === "email" && steps.followup_2.subject_template ? steps.followup_2.subject_template : null,
            body_template:    steps.followup_2.body_template,
          },
        });
      }
      // 3. Queue with the initial template
      return addToOutreachQueueFn({ data: { candidateIds, candidateType, channel, templateId: initialTemplateId } });
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["outreach-templates"] });
      const savedCount = [steps.followup_1, steps.followup_2].filter((s) => s.enabled && s.body_template.trim()).length + 1;
      alert(`Queued ${result.queued} candidate(s) as drafts. ${result.skipped} skipped.\nTemplate saved as "${pipelineName}" (${savedCount} message${savedCount !== 1 ? "s" : ""}).`);
      onClose();
    },
  });

  const isPending = templateQueueMutation.isPending || customQueueMutation.isPending;
  const queueError = templateQueueMutation.error ?? customQueueMutation.error;

  const enabledSteps = DIALOG_STEPS.filter((s) => steps[s.key].enabled);
  const customCanQueue =
    steps.initial.body_template.trim().length > 0 && candidateIds.length > 0;

  const selectedTemplate = filteredTemplates.find((t) => t.id === templateId);

  const VARS_HINT = "{{name}}, {{role}}, {{company}}, {{college}}, {{branch}}, {{sender_name}}";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl">
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

          {/* Mode toggle */}
          <div className="flex rounded-md border border-border overflow-hidden text-xs">
            {(["template", "custom"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  "flex-1 py-2 transition-colors font-medium",
                  mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
                )}
              >
                {m === "template" ? "Use Existing Template" : "Write Custom Message"}
              </button>
            ))}
          </div>

          {/* ── Template mode ── */}
          {mode === "template" && (
            <>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Select template</p>
                {filteredTemplates.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No templates for this channel. Switch to "Write Custom Message" to create one.</p>
                ) : (
                  <div className="space-y-1.5">
                    {filteredTemplates.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setTemplateId(t.id)}
                        className={cn(
                          "w-full text-left rounded-md border px-3 py-2 text-xs transition-colors",
                          templateId === t.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/40",
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
            </>
          )}

          {/* ── Custom mode ── */}
          {mode === "custom" && (
            <div className="space-y-3">
              <p className="text-[11px] text-muted-foreground">
                Will be saved as template <span className="font-medium text-foreground">"{pipelineName}"</span>. Variables: <code className="font-mono">{VARS_HINT}</code>
              </p>

              {/* Step tabs */}
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="flex border-b border-border bg-muted/40">
                  {DIALOG_STEPS.map((s) => {
                    const step = steps[s.key];
                    const isActive = activeStep === s.key;
                    return (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => setActiveStep(s.key)}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors border-r border-border last:border-r-0",
                          isActive ? "bg-background text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                        )}
                      >
                        <span className={cn(
                          "flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold",
                          step.enabled ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                        )}>
                          {s.shortLabel}
                        </span>
                        {s.label}
                        {s.key !== "initial" && step.enabled && step.body_template.trim() && (
                          <Check className="h-3 w-3 text-green-500" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {DIALOG_STEPS.map((s) => {
                  if (s.key !== activeStep) return null;
                  const step = steps[s.key];
                  return (
                    <div key={s.key} className="p-3 space-y-2.5">
                      {s.key !== "initial" && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setStep(s.key, { enabled: !step.enabled })}
                            className={cn(
                              "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                              step.enabled ? "bg-primary" : "bg-muted",
                            )}
                          >
                            <span className={cn(
                              "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform",
                              step.enabled ? "translate-x-4" : "translate-x-0",
                            )} />
                          </button>
                          <Label
                            className="text-xs text-muted-foreground cursor-pointer"
                            onClick={() => setStep(s.key, { enabled: !step.enabled })}
                          >
                            {step.enabled ? `Include ${s.label}` : `Skip ${s.label}`}
                          </Label>
                        </div>
                      )}

                      {step.enabled && (
                        <>
                          {channel === "email" && (
                            <div className="space-y-1">
                              <Label className="text-xs font-medium text-muted-foreground">
                                Subject{s.key !== "initial" && <span className="ml-1 text-muted-foreground/60">(blank = reply in thread)</span>}
                              </Label>
                              <Input
                                value={step.subject_template}
                                onChange={(e) => setStep(s.key, { subject_template: e.target.value })}
                                placeholder={s.key === "initial" ? "e.g. Opportunity at FlytBase — {{role}}" : "Leave blank to continue thread"}
                                className="h-8 text-xs"
                              />
                            </div>
                          )}
                          <div className="space-y-1">
                            <Label className="text-xs font-medium text-muted-foreground">Message body</Label>
                            <Textarea
                              value={step.body_template}
                              onChange={(e) => setStep(s.key, { body_template: e.target.value })}
                              placeholder={
                                s.key === "initial"
                                  ? "Hi {{name}},\n\nI came across your profile and..."
                                  : "Hi {{name}},\n\nJust following up on my previous message..."
                              }
                              className="min-h-[120px] text-xs resize-y font-mono"
                            />
                          </div>
                        </>
                      )}
                      {!step.enabled && s.key !== "initial" && (
                        <p className="text-xs text-muted-foreground py-3 text-center">
                          Toggle on to add a {s.label.toLowerCase()} message.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              <p className="text-[11px] text-muted-foreground">
                Saves {enabledSteps.length} template{enabledSteps.length !== 1 ? "s" : ""}: {enabledSteps.map((s) => s.label).join(", ")}
              </p>
            </div>
          )}

          {queueError && (
            <p className="text-xs text-destructive">
              {queueError instanceof Error ? queueError.message : "Failed"}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isPending}>Cancel</Button>
          {mode === "template" ? (
            <Button
              size="sm"
              onClick={() => templateQueueMutation.mutate()}
              disabled={!templateId || candidateIds.length === 0 || isPending}
            >
              {isPending ? "Queuing…" : "Queue"}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => customQueueMutation.mutate()}
              disabled={!customCanQueue || isPending}
            >
              {isPending ? "Saving & Queuing…" : "Save & Queue"}
            </Button>
          )}
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
    deletePipeline,
    renamePipeline,
    openDrawer,
  } = useTalent();
  const [active, setActive] = useState(
    pipelineParam ?? pipelines[0]?.id ?? "",
  );
  const [outreachOpen, setOutreachOpen] = useState(false);
  const [studentOutreachOpen, setStudentOutreachOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const startRename = (p: { id: string; name: string }) => {
    setRenamingId(p.id);
    setRenameValue(p.name);
  };
  const commitRename = () => {
    if (renamingId && renameValue.trim()) renamePipeline(renamingId, renameValue.trim());
    setRenamingId(null);
  };
  const handleDelete = (id: string) => {
    const count = pipelineMemberCount(id);
    const msg = count > 0
      ? `Delete this pipeline and remove its ${count} candidate${count !== 1 ? "s" : ""}?`
      : "Delete this pipeline?";
    if (!confirm(msg)) return;
    deletePipeline(id);
    setActive(pipelines.find((p) => p.id !== id)?.id ?? "");
  };

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
            const isActive = current?.id === p.id;
            const isRenaming = renamingId === p.id;
            return (
              <div
                key={p.id}
                className={cn(
                  "group flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors",
                  isActive
                    ? "border-primary bg-accent text-accent-foreground"
                    : "border-border text-muted-foreground hover:bg-accent/50",
                )}
              >
                {isRenaming ? (
                  <>
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenamingId(null); }}
                      className="w-32 bg-transparent outline-none text-sm"
                    />
                    <button onClick={commitRename} className="text-ok hover:text-ok/80"><Check className="h-3.5 w-3.5" /></button>
                    <button onClick={() => setRenamingId(null)} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
                  </>
                ) : (
                  <>
                    <button onClick={() => setActive(p.id)} className="flex items-center gap-2">
                      {p.name}
                      <span className="rounded bg-muted px-1.5 text-xs">{count}</span>
                    </button>
                    {isActive && (
                      <span className="flex items-center gap-0.5 ml-1">
                        <button
                          onClick={() => startRename(p)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          title="Rename"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                          title="Delete pipeline"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </span>
                    )}
                  </>
                )}
              </div>
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
        pipelineName={current?.name ?? "Pipeline"}
      />
      <PipelineOutreachDialog
        open={studentOutreachOpen}
        onClose={() => setStudentOutreachOpen(false)}
        candidateIds={studentIds}
        candidateType="student"
        pipelineName={current?.name ?? "Pipeline"}
      />
    </div>
  );
}
