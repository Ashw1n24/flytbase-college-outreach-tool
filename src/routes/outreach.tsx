import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  Mail,
  Linkedin,
  CheckCircle2,
  Clock,
  Send,
  RefreshCw,
  Trash2,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Pencil,
  X,
  Check,
  RotateCcw,
  Upload,
  AlertCircle,
  Plus,
} from "lucide-react";
import { TopNav } from "@/components/talent/TopNav";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  getOutreachTemplatesFn,
  upsertOutreachTemplateFn,
  deleteOutreachTemplateFn,
  getOutreachMessagesFn,
  getOutreachStatsFn,
  updateMessageStatusFn,
  sendApprovedBatchFn,
  processFollowUpsFn,
  markRepliedFn,
  checkGmailRepliesFn,
  importCsvToOutreachFn,
} from "@/lib/api/outreach.functions";

export const Route = createFileRoute("/outreach")({
  head: () => ({
    meta: [{ title: "Outreach · Talent Radar · FlytBase" }],
  }),
  component: OutreachPage,
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TabKey = "queue" | "sent" | "templates";

interface OutreachMessage {
  id: string;
  candidate_id: string;
  candidate_type: string;
  channel: string;
  status: string;
  subject: string | null;
  body: string;
  to_email: string | null;
  to_linkedin_url: string | null;
  candidate_name: string | null;
  candidate_title: string | null;
  candidate_company: string | null;
  is_followup: boolean;
  follow_up_number: number;
  parent_message_id: string | null;
  follow_up_delay_days: number | null;
  next_follow_up_at: string | null;
  sent_at: string | null;
  replied_at: string | null;
  created_at: string;
  error_message: string | null;
}

interface OutreachTemplate {
  id: string;
  name: string;
  pipeline: string;
  message_type: string;
  channel: string;
  subject_template: string | null;
  body_template: string;
  created_at?: string;
}

// ---------------------------------------------------------------------------
// Tiny components
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    draft:    { label: "Draft",    cls: "bg-muted text-muted-foreground" },
    approved: { label: "Approved", cls: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" },
    sending:  { label: "Sending",  cls: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
    sent:     { label: "Sent",     cls: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" },
    failed:   { label: "Failed",   cls: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
    replied:  { label: "Replied",  cls: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300" },
  };
  const { label, cls } = map[status] ?? { label: status, cls: "bg-muted text-muted-foreground" };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium", cls)}>
      {label}
    </span>
  );
}

function ChannelIcon({ channel }: { channel: string }) {
  return channel === "linkedin"
    ? <Linkedin className="h-3.5 w-3.5 text-blue-400 shrink-0" />
    : <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
}

function StatCard({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={cn(
      "rounded-lg border border-border bg-card px-4 py-3 text-center",
      highlight && value > 0 && "border-primary/40 bg-primary/5",
    )}>
      <div className={cn("text-2xl font-bold tabular-nums", highlight && value > 0 && "text-primary")}>
        {value}
      </div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Message row
// ---------------------------------------------------------------------------

function MessageRow({
  msg,
  selected,
  onToggle,
  onMarkReplied,
  showSelect,
  hasFollowUps,
}: {
  msg: OutreachMessage;
  selected: boolean;
  onToggle: () => void;
  onMarkReplied?: () => void;
  showSelect: boolean;
  hasFollowUps?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card transition-colors",
        selected && "border-primary/60 bg-primary/5",
      )}
    >
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {showSelect && (
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            className="h-4 w-4 rounded accent-primary cursor-pointer shrink-0"
          />
        )}
        <ChannelIcon channel={msg.channel} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium truncate">
              {msg.candidate_name ?? "Unknown"}
            </span>
            {msg.candidate_title && (
              <span className="text-xs text-muted-foreground truncate hidden sm:inline">
                · {msg.candidate_title}
                {msg.candidate_company ? ` @ ${msg.candidate_company}` : ""}
              </span>
            )}
            {msg.is_followup && (
              <span className="text-[10px] rounded bg-accent px-1.5 py-0.5 text-accent-foreground shrink-0">
                Follow-up {msg.follow_up_number}
              </span>
            )}
            {hasFollowUps && (
              <span className="text-[10px] rounded bg-muted px-1.5 py-0.5 text-muted-foreground shrink-0">
                + follow-ups
              </span>
            )}
          </div>
          {msg.channel === "email" && msg.subject && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{msg.subject}</p>
          )}
          {msg.channel === "linkedin" && msg.to_linkedin_url && (
            <a
              href={msg.to_linkedin_url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-blue-400 hover:underline mt-0.5 block truncate"
              onClick={(e) => e.stopPropagation()}
            >
              {msg.to_linkedin_url}
            </a>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {msg.sent_at && (
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {new Date(msg.sent_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              {" · "}
              {new Date(msg.sent_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          {!msg.sent_at && msg.created_at && (
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {new Date(msg.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            </span>
          )}
          <StatusBadge status={msg.status} />
          {msg.status === "sent" && onMarkReplied && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px] text-purple-400 hover:text-purple-300"
              onClick={onMarkReplied}
            >
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Replied
            </Button>
          )}
          {msg.error_message && (
            <span className="text-[10px] text-destructive truncate max-w-[140px]" title={msg.error_message}>
              {msg.error_message.slice(0, 40)}…
            </span>
          )}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1 rounded hover:bg-accent text-muted-foreground"
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Body preview */}
      {expanded && (
        <div className="border-t border-border px-4 py-3">
          <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">
            {msg.body}
          </pre>
          {msg.sent_at && (
            <p className="text-[11px] text-muted-foreground mt-2">
              Sent {new Date(msg.sent_at).toLocaleString("en-IN")}
            </p>
          )}
          {msg.replied_at && (
            <p className="text-[11px] text-purple-400 mt-1">
              Replied {new Date(msg.replied_at).toLocaleString("en-IN")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CSV parser (handles quoted fields + flexible line endings)
// ---------------------------------------------------------------------------

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (lines.length < 2) return [];

  const parseRow = (line: string): string[] => {
    const fields: string[] = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuote = !inQuote;
      } else if (ch === "," && !inQuote) {
        fields.push(cur.trim()); cur = "";
      } else {
        cur += ch;
      }
    }
    fields.push(cur.trim());
    return fields;
  };

  const headers = parseRow(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  return lines
    .slice(1)
    .filter((l) => l.trim())
    .map((l) => {
      const vals = parseRow(l);
      return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ""]));
    });
}

// ---------------------------------------------------------------------------
// CSV Upload Dialog
// ---------------------------------------------------------------------------

const STUDENT_COLUMNS    = ["name", "email / mail", "linkedin / linkedin_url", "college", "branch", "role"];
const EXPERIENCED_COLUMNS = ["name", "email", "linkedin_url", "role", "company"];

function CsvUploadDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const fileRef     = useRef<HTMLInputElement>(null);

  const [pipeline,             setPipeline]             = useState<"student" | "experienced">("experienced");
  const [channel,              setChannel]              = useState<"email" | "linkedin">("email");
  const [templateId,           setTemplateId]           = useState("");
  const [followUp1TemplateId,  setFollowUp1TemplateId]  = useState<string | null>(null);
  const [followUp2TemplateId,  setFollowUp2TemplateId]  = useState<string | null>(null);
  const [followUp1DelayDays,   setFollowUp1DelayDays]   = useState(3);
  const [followUp2DelayDays,   setFollowUp2DelayDays]   = useState(5);
  const [saveToDatabase,       setSaveToDatabase]       = useState(false);
  const [rows,                 setRows]                 = useState<Record<string, string>[]>([]);
  const [fileName,             setFileName]             = useState<string | null>(null);
  const [parseError,           setParseError]           = useState<string | null>(null);

  const { data: templates } = useQuery({
    queryKey: ["outreach-templates"],
    queryFn:  () => getOutreachTemplatesFn(),
    enabled:  open,
  });

  const filteredTemplates = (templates ?? []).filter(
    (t) =>
      (t.pipeline === pipeline || t.pipeline === "both") &&
      t.message_type === "initial" &&
      t.channel === channel,
  );

  const followUp1Templates = (templates ?? []).filter(
    (t) =>
      (t.pipeline === pipeline || t.pipeline === "both") &&
      t.message_type === "followup_1" &&
      t.channel === channel,
  );

  const followUp2Templates = (templates ?? []).filter(
    (t) =>
      (t.pipeline === pipeline || t.pipeline === "both") &&
      t.message_type === "followup_2" &&
      t.channel === channel,
  );

  // Auto-select first matching template
  useEffect(() => {
    if (filteredTemplates.length > 0 && !filteredTemplates.find((t) => t.id === templateId)) {
      setTemplateId(filteredTemplates[0].id);
    }
  }, [pipeline, channel, filteredTemplates.length]);

  // Clear follow-up selections when pipeline/channel changes
  useEffect(() => {
    setFollowUp1TemplateId(null);
    setFollowUp2TemplateId(null);
  }, [pipeline, channel]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParseError(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text   = ev.target?.result as string;
        const parsed = parseCsv(text);
        if (parsed.length === 0) throw new Error("No data rows found");
        setRows(parsed);
      } catch (err) {
        setParseError(err instanceof Error ? err.message : "Parse failed");
        setRows([]);
      }
    };
    reader.readAsText(file);
  };

  const importMutation = useMutation({
    mutationFn: () =>
      importCsvToOutreachFn({
        data: {
          rows,
          candidateType:       pipeline,
          channel,
          templateId,
          followUp1TemplateId: followUp1TemplateId ?? null,
          followUp2TemplateId: followUp2TemplateId ?? null,
          followUp1DelayDays,
          followUp2DelayDays,
          saveToDatabase,
        },
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["outreach-queue"] });
      queryClient.invalidateQueries({ queryKey: ["outreach-stats"] });
      const fuCount = (followUp1TemplateId ? 1 : 0) + (followUp2TemplateId ? 1 : 0);
      alert(
        `Queued ${result.queued} initial draft${result.queued !== 1 ? "s" : ""}` +
        (fuCount > 0 ? ` + ${fuCount} follow-up sequence${fuCount !== 1 ? "s" : ""} per candidate` : "") + "." +
        (result.skipped > 0 ? ` ${result.skipped} skipped (missing contact info).` : "") +
        (result.dbSaved > 0 ? ` ${result.dbSaved} saved to candidate DB.` : ""),
      );
      // Reset
      setRows([]); setFileName(null); setParseError(null);
      setFollowUp1TemplateId(null); setFollowUp2TemplateId(null);
      if (fileRef.current) fileRef.current.value = "";
      onClose();
    },
  });

  const expectedCols = pipeline === "student" ? STUDENT_COLUMNS : EXPERIENCED_COLUMNS;
  const previewRows  = rows.slice(0, 4);
  const validCount   = rows.filter((r) => {
    const name = r.name ?? r.full_name ?? "";
    const email = r.email ?? r.mail ?? "";
    const linkedin = r.linkedin_url ?? r.linkedin ?? "";
    return name && (channel === "email" ? email : linkedin);
  }).length;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg flex flex-col max-h-[90vh]">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-base">Import CSV to Outreach Queue</DialogTitle>
          <DialogDescription>
            Rows become draft messages. Review and approve them before sending.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1 overflow-y-auto flex-1 pr-1">
          {/* Pipeline */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Pipeline</Label>
            <div className="flex gap-2">
              {(["student", "experienced"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPipeline(p)}
                  className={cn(
                    "flex-1 rounded-md border px-3 py-2 text-xs capitalize transition-colors",
                    pipeline === p
                      ? "border-primary bg-primary/10 font-medium"
                      : "border-border text-muted-foreground hover:border-primary/40",
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Expected columns hint */}
          <div className="rounded-md bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground">
            Expected columns:{" "}
            <span className="font-mono">{expectedCols.join(", ")}</span>
          </div>

          {/* File upload */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">CSV File</Label>
            <div className="flex items-center gap-2">
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5" />
                {fileName ?? "Choose file"}
              </Button>
              {fileName && (
                <button
                  onClick={() => { setRows([]); setFileName(null); if (fileRef.current) fileRef.current.value = ""; }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {parseError && (
              <p className="flex items-center gap-1 text-xs text-destructive">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {parseError}
              </p>
            )}
          </div>

          {/* Preview */}
          {rows.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] text-muted-foreground">
                {rows.length} rows detected · {validCount} have required contact info for <strong>{channel}</strong>
              </p>
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      {Object.keys(previewRows[0] ?? {}).map((h) => (
                        <th key={h} className="px-2 py-1.5 text-left font-medium text-muted-foreground truncate max-w-[100px]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => (
                      <tr key={i} className="border-b border-border last:border-0">
                        {Object.values(row).map((v, j) => (
                          <td key={j} className="px-2 py-1.5 truncate max-w-[100px]">{v}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 4 && (
                <p className="text-[11px] text-muted-foreground">+{rows.length - 4} more rows</p>
              )}
            </div>
          )}

          {/* Channel */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Channel</Label>
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

          {/* Template selectors */}
          <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-3 items-end">
            {/* Initial */}
            <div className="space-y-1 col-span-2">
              <Label className="text-xs font-medium text-muted-foreground">Initial template</Label>
              {filteredTemplates.length > 0 ? (
                <select
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                  className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {filteredTemplates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}{t.subject_template ? ` — ${t.subject_template}` : ""}</option>
                  ))}
                </select>
              ) : (
                <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  No {pipeline} {channel} initial template. Create one in the Templates tab first.
                </p>
              )}
            </div>

            {/* Follow-up 1 */}
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">Follow-up 1 (optional)</Label>
              {followUp1Templates.length > 0 ? (
                <select
                  value={followUp1TemplateId ?? ""}
                  onChange={(e) => setFollowUp1TemplateId(e.target.value || null)}
                  className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">None (skip)</option>
                  {followUp1Templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-muted-foreground h-8 flex items-center">No FU1 templates yet</p>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">Send after</Label>
              <select
                value={followUp1DelayDays}
                onChange={(e) => setFollowUp1DelayDays(Number(e.target.value))}
                disabled={!followUp1TemplateId}
                className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-40"
              >
                {[1,2,3,4,5,7,10,14,21,30].map((d) => (
                  <option key={d} value={d}>{d}d</option>
                ))}
              </select>
            </div>

            {/* Follow-up 2 */}
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">Follow-up 2 (optional)</Label>
              {followUp2Templates.length > 0 ? (
                <select
                  value={followUp2TemplateId ?? ""}
                  onChange={(e) => setFollowUp2TemplateId(e.target.value || null)}
                  className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">None (skip)</option>
                  {followUp2Templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-muted-foreground h-8 flex items-center">No FU2 templates yet</p>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">After FU1 +</Label>
              <select
                value={followUp2DelayDays}
                onChange={(e) => setFollowUp2DelayDays(Number(e.target.value))}
                disabled={!followUp2TemplateId}
                className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-40"
              >
                {[1,2,3,4,5,7,10,14,21,30].map((d) => (
                  <option key={d} value={d}>{d}d</option>
                ))}
              </select>
            </div>
          </div>

          {/* Save to DB option */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={saveToDatabase}
              onChange={(e) => setSaveToDatabase(e.target.checked)}
              className="h-4 w-4 rounded accent-primary"
            />
            <span className="text-xs text-muted-foreground">
              Also save to candidate database
              {pipeline === "experienced" && saveToDatabase && (
                <span className="ml-1 text-[10px]">(will create a "CSV Imports" campaign)</span>
              )}
            </span>
          </label>

          {importMutation.error && (
            <p className="text-xs text-destructive">
              {importMutation.error instanceof Error ? importMutation.error.message : "Import failed"}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 shrink-0 border-t border-border mt-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={importMutation.isPending}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => importMutation.mutate()}
            disabled={rows.length === 0 || !templateId || importMutation.isPending || validCount === 0}
          >
            {importMutation.isPending ? "Importing…" : `Queue ${validCount} drafts`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Queue tab
// ---------------------------------------------------------------------------

function QueueTab() {
  const queryClient = useQueryClient();
  const [selected, setSelected]     = useState<Set<string>>(new Set());
  const [channelFilter, setChannelFilter] = useState<"all" | "email" | "linkedin">("all");
  const [csvOpen, setCsvOpen]        = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["outreach-queue", channelFilter],
    queryFn: () =>
      getOutreachMessagesFn({
        data: {
          statuses:  ["draft", "approved"],
          ...(channelFilter !== "all" ? { channel: channelFilter as "email" | "linkedin" } : {}),
          limit:     200,
          offset:    0,
        },
      }),
    refetchInterval: 15_000,
  });

  const allMessages: OutreachMessage[] = (data?.messages ?? []) as OutreachMessage[];

  // Split into root messages and follow-ups; follow-ups are nested under their parent
  const rootMessages   = allMessages.filter((m) => !m.parent_message_id);
  const followUpsByParent = allMessages
    .filter((m) => m.parent_message_id)
    .reduce<Record<string, OutreachMessage[]>>((acc, m) => {
      const pid = m.parent_message_id!;
      (acc[pid] ??= []).push(m);
      return acc;
    }, {});

  // Selection and bulk actions only apply to root messages
  const approveMutation = useMutation({
    mutationFn: (ids: string[]) =>
      updateMessageStatusFn({ data: { ids, status: "approved" } }),
    onSuccess: () => {
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["outreach-queue"] });
      queryClient.invalidateQueries({ queryKey: ["outreach-stats"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (ids: string[]) =>
      updateMessageStatusFn({ data: { ids, status: "deleted" } }),
    onSuccess: () => {
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["outreach-queue"] });
      queryClient.invalidateQueries({ queryKey: ["outreach-stats"] });
    },
  });

  const sendMutation = useMutation({
    mutationFn: (ids: string[]) =>
      sendApprovedBatchFn({ data: { ids } }),
    onSuccess: () => {
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["outreach-queue"] });
      queryClient.invalidateQueries({ queryKey: ["outreach-stats"] });
    },
  });

  const toggleAll = () => {
    if (selected.size === rootMessages.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(rootMessages.map((m) => m.id)));
    }
  };

  const selectedList   = [...selected];
  const approvedIds    = rootMessages.filter((m) => m.status === "approved" && selected.has(m.id)).map((m) => m.id);
  const draftIds       = rootMessages.filter((m) => m.status === "draft"    && selected.has(m.id)).map((m) => m.id);
  const allApprovedIds = rootMessages.filter((m) => m.status === "approved").map((m) => m.id);
  const isSending      = sendMutation.isPending;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Channel filter */}
        <div className="flex rounded-md border border-border text-xs overflow-hidden">
          {(["all", "email", "linkedin"] as const).map((ch) => (
            <button
              key={ch}
              onClick={() => setChannelFilter(ch)}
              className={cn(
                "px-3 py-1.5 capitalize",
                channelFilter === ch
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent",
              )}
            >
              {ch}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {selected.size > 0 && (
            <>
              <span className="text-xs text-muted-foreground">{selected.size} selected</span>
              {draftIds.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => approveMutation.mutate(draftIds)}
                  disabled={approveMutation.isPending}
                >
                  <Check className="h-3.5 w-3.5" />
                  Approve
                </Button>
              )}
              {approvedIds.length > 0 && (
                <Button
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => sendMutation.mutate(approvedIds)}
                  disabled={isSending}
                >
                  <Send className="h-3.5 w-3.5" />
                  {isSending ? "Sending…" : `Send ${approvedIds.length}`}
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1.5 text-xs text-destructive hover:text-destructive"
                onClick={() => deleteMutation.mutate(selectedList)}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </Button>
            </>
          )}

          {/* Send all approved */}
          {allApprovedIds.length > 0 && selected.size === 0 && (
            <Button
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() => sendMutation.mutate(allApprovedIds)}
              disabled={isSending}
            >
              <Send className="h-3.5 w-3.5" />
              {isSending ? "Sending…" : `Send ${allApprovedIds.length} approved`}
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 text-xs"
            onClick={() => setCsvOpen(true)}
          >
            <Upload className="h-3.5 w-3.5" />
            Upload CSV
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={() => refetch()}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <CsvUploadDialog open={csvOpen} onClose={() => setCsvOpen(false)} />

      {/* Error feedback */}
      {sendMutation.error && (
        <p className="text-xs text-destructive">
          {sendMutation.error instanceof Error ? sendMutation.error.message : "Send failed"}
        </p>
      )}
      {sendMutation.data && (
        <p className="text-xs text-green-400">
          Sent {sendMutation.data.sent}, failed {sendMutation.data.failed}
        </p>
      )}

      {/* Select all */}
      {rootMessages.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={selected.size === rootMessages.length && rootMessages.length > 0}
            onChange={toggleAll}
            className="h-4 w-4 rounded accent-primary cursor-pointer"
          />
          <span>Select all ({rootMessages.length})</span>
        </div>
      )}

      {/* Messages */}
      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}
      {!isLoading && rootMessages.length === 0 && (
        <div className="py-16 text-center">
          <p className="text-sm text-muted-foreground">Queue is empty.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Select candidates from the student or experienced dashboards and queue them for outreach.
          </p>
        </div>
      )}
      <div className="space-y-2">
        {rootMessages.map((msg) => {
          const followUps = (followUpsByParent[msg.id] ?? [])
            .slice()
            .sort((a, b) => a.follow_up_number - b.follow_up_number);
          return (
            <div key={msg.id} className="space-y-0">
              <MessageRow
                msg={msg}
                selected={selected.has(msg.id)}
                onToggle={() => {
                  const next = new Set(selected);
                  next.has(msg.id) ? next.delete(msg.id) : next.add(msg.id);
                  setSelected(next);
                }}
                showSelect
                hasFollowUps={followUps.length > 0}
              />
              {followUps.length > 0 && (
                <div className="ml-8 border-l-2 border-border pl-3 space-y-1 pb-1">
                  {followUps.map((fu) => (
                    <div
                      key={fu.id}
                      className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs"
                    >
                      <span className="shrink-0 text-[10px] rounded bg-accent px-1.5 py-0.5 text-accent-foreground font-medium">
                        Follow-up {fu.follow_up_number}
                      </span>
                      <span className="font-medium text-foreground/80 truncate">
                        {fu.subject ?? fu.body.slice(0, 60)}
                      </span>
                      <span className="ml-auto shrink-0 flex items-center gap-2">
                        {fu.follow_up_delay_days && (
                          <span className="text-muted-foreground">
                            +{fu.follow_up_delay_days}d after {fu.follow_up_number === 1 ? "initial" : `FU${fu.follow_up_number - 1}`}
                          </span>
                        )}
                        <StatusBadge status={fu.status} />
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sent tab
// ---------------------------------------------------------------------------

function SentTab() {
  const queryClient = useQueryClient();
  const [filter, setFilter]               = useState<"all" | "awaiting" | "sent" | "replied" | "failed">("all");
  const [replyBanner, setReplyBanner]     = useState<{ detected: number; checked: number; error?: string | null } | null>(null);

  const statusMap: Record<string, ("sent" | "replied" | "failed")[]> = {
    all:      ["sent", "replied", "failed"],
    awaiting: ["sent"],
    sent:     ["sent"],
    replied:  ["replied"],
    failed:   ["failed"],
  };

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["outreach-sent", filter],
    queryFn: () =>
      getOutreachMessagesFn({
        data: {
          statuses: statusMap[filter],
          noReply:  filter === "awaiting" ? true : undefined,
          isFollowup: filter === "awaiting" ? false : undefined,
          limit: 200,
          offset: 0,
        },
      }),
    refetchInterval: 30_000,
  });

  const messages: OutreachMessage[] = (data?.messages ?? []) as OutreachMessage[];

  // For "awaiting" view: also fetch pending follow-up drafts for these sent messages
  const sentIds = messages.map((m) => m.id);
  const { data: pendingFollowUpsData } = useQuery({
    queryKey: ["outreach-pending-followups", sentIds],
    queryFn: () =>
      getOutreachMessagesFn({
        data: {
          statuses:   ["draft", "approved"],
          isFollowup: true,
          parentIds:  sentIds,
          limit:      500,
          offset:     0,
        },
      }),
    enabled: filter === "awaiting" && sentIds.length > 0,
  });

  const pendingFollowUps: OutreachMessage[] = (pendingFollowUpsData?.messages ?? []) as OutreachMessage[];

  const pendingByParent = pendingFollowUps.reduce<Record<string, OutreachMessage[]>>((acc, m) => {
    const pid = m.parent_message_id!;
    (acc[pid] ??= []).push(m);
    return acc;
  }, {});

  // In "awaiting" mode: only show sent messages that have pending follow-ups OR no reply
  const awaitingMessages = filter === "awaiting"
    ? messages // already filtered to sent+no-reply+not-followup by the query
    : messages;

  const markRepliedMutation = useMutation({
    mutationFn: (id: string) => markRepliedFn({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["outreach-sent"] });
      queryClient.invalidateQueries({ queryKey: ["outreach-stats"] });
    },
  });

  const processFollowupsMutation = useMutation({
    mutationFn: () => processFollowUpsFn({ data: {} }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["outreach-queue"] });
      queryClient.invalidateQueries({ queryKey: ["outreach-stats"] });
      if (result.created > 0) {
        alert(`Created ${result.created} follow-up draft(s) — check the Queue tab.`);
      } else {
        alert("No follow-ups due yet.");
      }
    },
  });

  const checkRepliesMutation = useMutation({
    mutationFn: () => checkGmailRepliesFn({ data: {} }),
    onSuccess: (result) => {
      if (result.detected > 0) {
        queryClient.invalidateQueries({ queryKey: ["outreach-sent"] });
        queryClient.invalidateQueries({ queryKey: ["outreach-stats"] });
      }
      setReplyBanner(result);
    },
    onError: () => {
      // Silently ignore on mount — Gmail creds may not be set up yet
    },
  });

  // Auto-check for Gmail replies when the Sent tab mounts
  useEffect(() => {
    checkRepliesMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex rounded-md border border-border text-xs overflow-hidden">
          {(["all", "awaiting", "sent", "replied", "failed"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1.5 capitalize",
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent",
              )}
            >
              {f === "awaiting" ? "Awaiting" : f}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 text-xs"
            onClick={() => { setReplyBanner(null); checkRepliesMutation.mutate(); }}
            disabled={checkRepliesMutation.isPending}
          >
            <Mail className="h-3.5 w-3.5" />
            {checkRepliesMutation.isPending ? "Checking…" : "Check Gmail Replies"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 text-xs"
            onClick={() => processFollowupsMutation.mutate()}
            disabled={processFollowupsMutation.isPending}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {processFollowupsMutation.isPending ? "Checking…" : "Process Follow-ups"}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Reply detection banner */}
      {replyBanner && (
        <div className={cn(
          "flex items-center gap-2 rounded-md px-3 py-2 text-xs",
          replyBanner.error
            ? "bg-destructive/10 text-destructive border border-destructive/20"
            : replyBanner.detected > 0
              ? "bg-green-500/10 text-green-400 border border-green-500/20"
              : "bg-muted/50 text-muted-foreground",
        )}>
          {replyBanner.error ? (
            <X className="h-3.5 w-3.5 shrink-0" />
          ) : replyBanner.detected > 0 ? (
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <Mail className="h-3.5 w-3.5 shrink-0" />
          )}
          <span>
            {replyBanner.error
              ? `Gmail error: ${replyBanner.error}`
              : `Checked ${replyBanner.checked} thread${replyBanner.checked !== 1 ? "s" : ""} — ${
                  replyBanner.detected > 0
                    ? `${replyBanner.detected} new repl${replyBanner.detected !== 1 ? "ies" : "y"} detected and marked.`
                    : "no new replies."
                }`}
          </span>
          <button
            className="ml-auto text-muted-foreground hover:text-foreground"
            onClick={() => setReplyBanner(null)}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!isLoading && awaitingMessages.length === 0 && (
        <div className="py-16 text-center">
          <p className="text-sm text-muted-foreground">
            {filter === "awaiting" ? "No sent messages awaiting follow-up or reply." : "No messages sent yet."}
          </p>
        </div>
      )}

      {filter === "awaiting" ? (
        <div className="space-y-2">
          {awaitingMessages.map((msg) => {
            const followUps = (pendingByParent[msg.id] ?? [])
              .slice()
              .sort((a, b) => a.follow_up_number - b.follow_up_number);
            return (
              <div key={msg.id}>
                <MessageRow
                  msg={msg}
                  selected={false}
                  onToggle={() => {}}
                  onMarkReplied={() => markRepliedMutation.mutate(msg.id)}
                  showSelect={false}
                  hasFollowUps={followUps.length > 0}
                />
                {followUps.length > 0 && (
                  <div className="mt-1 ml-4 space-y-1">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide px-1 mb-0.5">Queued follow-ups</p>
                    {followUps.map((fu) => (
                      <div
                        key={fu.id}
                        className="flex items-center gap-2 rounded-md border border-dashed border-border bg-muted/20 px-3 py-2 text-xs"
                      >
                        <span className="shrink-0 text-[10px] rounded bg-accent px-1.5 py-0.5 text-accent-foreground font-medium">
                          FU {fu.follow_up_number}
                        </span>
                        <span className="font-medium text-foreground/80 truncate">
                          {fu.subject ?? fu.body.slice(0, 60)}
                        </span>
                        <span className="ml-auto shrink-0 flex items-center gap-2">
                          {fu.next_follow_up_at && (
                            <span className={cn(
                              "text-muted-foreground",
                              new Date(fu.next_follow_up_at) <= new Date() && "text-orange-400 font-medium",
                            )}>
                              {new Date(fu.next_follow_up_at) <= new Date()
                                ? "due now"
                                : `due ${new Date(fu.next_follow_up_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`}
                            </span>
                          )}
                          {fu.follow_up_delay_days && !fu.next_follow_up_at && (
                            <span className="text-muted-foreground">+{fu.follow_up_delay_days}d after send</span>
                          )}
                          <StatusBadge status={fu.status} />
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {followUps.length === 0 && (
                  <p className="text-[11px] text-muted-foreground mt-1 ml-4 pb-1">No follow-ups queued for this thread</p>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {messages.map((msg) => (
            <MessageRow
              key={msg.id}
              msg={msg}
              selected={false}
              onToggle={() => {}}
              onMarkReplied={
                msg.status === "sent"
                  ? () => markRepliedMutation.mutate(msg.id)
                  : undefined
              }
              showSelect={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Templates tab
// ---------------------------------------------------------------------------

function TemplateCard({ tmpl }: { tmpl: OutreachTemplate }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState(tmpl.subject_template ?? "");
  const [body, setBody]       = useState(tmpl.body_template);

  const saveMutation = useMutation({
    mutationFn: () =>
      upsertOutreachTemplateFn({
        data: {
          id:               tmpl.id,
          name:             tmpl.name,
          pipeline:         tmpl.pipeline as "student" | "experienced" | "both",
          message_type:     tmpl.message_type as "initial" | "followup_1" | "followup_2",
          channel:          tmpl.channel as "email" | "linkedin",
          subject_template: subject || null,
          body_template:    body,
        },
      }),
    onSuccess: () => {
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["outreach-templates"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteOutreachTemplateFn({ data: { id: tmpl.id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["outreach-templates"] });
    },
  });

  const handleDelete = () => {
    if (!confirm(`Delete template "${tmpl.name}"?`)) return;
    deleteMutation.mutate();
  };

  const pipelineLabel =
    tmpl.pipeline === "both" ? "All" :
    tmpl.pipeline === "student" ? "Students" : "Experienced";

  const createdDate = tmpl.created_at
    ? new Date(tmpl.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : null;

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{tmpl.name}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-[10px] rounded bg-accent px-1.5 py-0.5 text-accent-foreground">{pipelineLabel}</span>
            <span className="text-[10px] rounded bg-accent px-1.5 py-0.5 text-accent-foreground capitalize">{tmpl.channel}</span>
            <span className="text-[10px] rounded bg-accent px-1.5 py-0.5 text-accent-foreground capitalize">
              {tmpl.message_type.replace(/_/g, " ")}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {createdDate && (
            <span className="text-[10px] text-muted-foreground">{createdDate}</span>
          )}
          {!editing && (
            <div className="flex gap-0.5">
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Variables reference */}
      <p className="text-[10px] text-muted-foreground">
        Variables: <code className="font-mono">{"{{candidate_name}}"}</code>
        {" "}<code className="font-mono">{"{{role}}"}</code>
        {" "}<code className="font-mono">{"{{company}}"}</code>
        {" "}<code className="font-mono">{"{{university}}"}</code>
        {" "}<code className="font-mono">{"{{sender_name}}"}</code>
      </p>

      {editing ? (
        <div className="space-y-3">
          {tmpl.channel === "email" && (
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">Subject</label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject line…"
                className="h-8 text-xs"
              />
            </div>
          )}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Body</label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="min-h-[180px] text-xs resize-y font-mono"
            />
          </div>
          {saveMutation.error && (
            <p className="text-xs text-destructive">
              {saveMutation.error instanceof Error ? saveMutation.error.message : "Save failed"}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              <Check className="h-3.5 w-3.5" />
              {saveMutation.isPending ? "Saving…" : "Save"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1.5 text-xs"
              onClick={() => {
                setSubject(tmpl.subject_template ?? "");
                setBody(tmpl.body_template);
                setEditing(false);
              }}
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed line-clamp-5">
          {tmpl.body_template}
        </pre>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// New Template dialog (multi-step: Initial + Follow-up 1 + Follow-up 2)
// ---------------------------------------------------------------------------

type StepKey = "initial" | "followup_1" | "followup_2";

interface StepForm {
  enabled:          boolean;
  subject_template: string;
  body_template:    string;
}

const EMPTY_STEP: StepForm = { enabled: false, subject_template: "", body_template: "" };

const STEPS: { key: StepKey; label: string; shortLabel: string }[] = [
  { key: "initial",    label: "Initial",      shortLabel: "1" },
  { key: "followup_1", label: "Follow-up 1",  shortLabel: "2" },
  { key: "followup_2", label: "Follow-up 2",  shortLabel: "3" },
];

function NewTemplateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();

  // Shared fields
  const [name,     setName]     = useState("");
  const [pipeline, setPipeline] = useState<"student" | "experienced" | "both">("experienced");
  const [channel,  setChannel]  = useState<"email" | "linkedin">("email");

  // Per-step forms — initial always enabled
  const [steps, setSteps] = useState<Record<StepKey, StepForm>>({
    initial:    { ...EMPTY_STEP, enabled: true },
    followup_1: { ...EMPTY_STEP },
    followup_2: { ...EMPTY_STEP },
  });

  const [activeStep, setActiveStep] = useState<StepKey>("initial");
  const [saveError,  setSaveError]  = useState<string | null>(null);
  const [saving,     setSaving]     = useState(false);

  // Reset on open
  useEffect(() => {
    if (open) {
      setName("");
      setPipeline("experienced");
      setChannel("email");
      setSteps({
        initial:    { ...EMPTY_STEP, enabled: true },
        followup_1: { ...EMPTY_STEP },
        followup_2: { ...EMPTY_STEP },
      });
      setActiveStep("initial");
      setSaveError(null);
    }
  }, [open]);

  const setStep = (key: StepKey, patch: Partial<StepForm>) =>
    setSteps((s) => ({ ...s, [key]: { ...s[key], ...patch } }));

  const enabledSteps = STEPS.filter((s) => steps[s.key].enabled);

  const handleSave = async () => {
    setSaveError(null);
    setSaving(true);
    try {
      await Promise.all(
        enabledSteps.map((s) => {
          const step = steps[s.key];
          const templateName =
            s.key === "initial"
              ? name.trim()
              : `${name.trim()} — ${s.label}`;
          return upsertOutreachTemplateFn({
            data: {
              name:             templateName,
              pipeline,
              message_type:     s.key,
              channel,
              subject_template: channel === "email" && step.subject_template ? step.subject_template : null,
              body_template:    step.body_template,
            },
          });
        })
      );
      queryClient.invalidateQueries({ queryKey: ["outreach-templates"] });
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const canSave =
    name.trim().length > 0 &&
    enabledSteps.length > 0 &&
    enabledSteps.every((s) => steps[s.key].body_template.trim().length > 0);

  const VARS_HINT = "{{name}}, {{role}}, {{company}}, {{college}}, {{branch}}, {{sender_name}}";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-base">New Template Series</DialogTitle>
          <DialogDescription className="text-xs">
            Create an initial message and optionally follow-ups in one go. Variables: <code className="font-mono">{VARS_HINT}</code>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-1">
          {/* Shared: name + pipeline + channel */}
          <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-end">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">Series name</Label>
              <Input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Experienced Outreach"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">Pipeline</Label>
              <select
                value={pipeline}
                onChange={(e) => setPipeline(e.target.value as typeof pipeline)}
                className="h-8 w-28 rounded-md border border-border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="experienced">Experienced</option>
                <option value="student">Students</option>
                <option value="both">Both</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">Channel</Label>
              <div className="flex rounded-md border border-border overflow-hidden h-8">
                {(["email", "linkedin"] as const).map((ch) => (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => setChannel(ch)}
                    className={cn(
                      "px-3 text-xs capitalize transition-colors",
                      channel === ch ? "bg-primary text-primary-foreground" : "hover:bg-accent",
                    )}
                  >
                    {ch}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Step tabs */}
          <div className="border border-border rounded-lg overflow-hidden">
            {/* Tab bar */}
            <div className="flex border-b border-border bg-muted/40">
              {STEPS.map((s) => {
                const step = steps[s.key];
                const isActive = activeStep === s.key;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setActiveStep(s.key)}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors border-r border-border last:border-r-0",
                      isActive
                        ? "bg-background text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                    )}
                  >
                    <span
                      className={cn(
                        "flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold",
                        step.enabled
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
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

            {/* Active step content */}
            {STEPS.map((s) => {
              if (s.key !== activeStep) return null;
              const step = steps[s.key];
              return (
                <div key={s.key} className="p-3 space-y-2.5">
                  {/* Enable toggle for follow-ups */}
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
                        <span
                          className={cn(
                            "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform",
                            step.enabled ? "translate-x-4" : "translate-x-0",
                          )}
                        />
                      </button>
                      <Label className="text-xs text-muted-foreground cursor-pointer" onClick={() => setStep(s.key, { enabled: !step.enabled })}>
                        {step.enabled ? `Include ${s.label}` : `Skip ${s.label}`}
                      </Label>
                    </div>
                  )}

                  {step.enabled && (
                    <>
                      {channel === "email" && (
                        <div className="space-y-1">
                          <Label className="text-xs font-medium text-muted-foreground">
                            Subject line{s.key !== "initial" && <span className="ml-1 text-muted-foreground/60">(leave blank to reply in same thread)</span>}
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
                          className="min-h-[140px] text-xs resize-y font-mono"
                        />
                      </div>
                    </>
                  )}

                  {!step.enabled && s.key !== "initial" && (
                    <p className="text-xs text-muted-foreground py-4 text-center">
                      Toggle on to add a {s.label.toLowerCase()} message.
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Nav hint */}
          <p className="text-[11px] text-muted-foreground">
            Will create {enabledSteps.length} template{enabledSteps.length !== 1 ? "s" : ""}:{" "}
            {enabledSteps.map((s) => s.label).join(", ")}
          </p>

          {saveError && (
            <p className="text-xs text-destructive">{saveError}</p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!canSave || saving}>
            <Check className="h-3.5 w-3.5 mr-1.5" />
            {saving ? "Saving…" : `Save ${enabledSteps.length} Template${enabledSteps.length !== 1 ? "s" : ""}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------

function TemplatesTab() {
  const queryClient = useQueryClient();
  const [newOpen, setNewOpen] = useState(false);

  const { data: templates, isLoading } = useQuery({
    queryKey: ["outreach-templates"],
    queryFn:  () => getOutreachTemplatesFn(),
  });

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {isLoading ? "Loading…" : `${(templates ?? []).length} template${(templates ?? []).length !== 1 ? "s" : ""}`}
        </p>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1.5 text-xs"
          onClick={() => setNewOpen(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          New Template
        </Button>
      </div>

      {!isLoading && (!templates || templates.length === 0) && (
        <p className="text-sm text-muted-foreground">
          No templates found. Run the Supabase migration to seed defaults, or create one above.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {(templates ?? []).map((t) => (
          <TemplateCard key={t.id} tmpl={t as OutreachTemplate} />
        ))}
      </div>

      <NewTemplateDialog open={newOpen} onClose={() => setNewOpen(false)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stats bar
// ---------------------------------------------------------------------------

function StatsBar() {
  const { data: stats } = useQuery({
    queryKey:       ["outreach-stats"],
    queryFn:        () => getOutreachStatsFn(),
    refetchInterval: 30_000,
  });

  const s = stats as Record<string, number> ?? {};
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <StatCard label="Approved" value={s.approved ?? 0} highlight />
      <StatCard label="Sent"     value={s.sent     ?? 0} highlight />
      <StatCard label="Replied"  value={s.replied  ?? 0} highlight />
      <StatCard label="Follow-up Due" value={s.followup_due ?? 0} highlight={!!s.followup_due} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function OutreachPage() {
  const [tab, setTab] = useState<TabKey>("queue");

  // Auto-check follow-ups when the page loads
  useEffect(() => {
    // Silent background check — only show result if there are new follow-ups
    processFollowUpsFn({ data: {} })
      .then((r) => {
        if (r.created > 0) {
          console.info(`[outreach] Created ${r.created} follow-up draft(s)`);
        }
      })
      .catch(console.error);
  }, []);

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: "queue",     label: "Queue",     icon: <Clock className="h-3.5 w-3.5" /> },
    { key: "sent",      label: "Sent",      icon: <Send className="h-3.5 w-3.5" /> },
    { key: "templates", label: "Templates", icon: <MessageSquare className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopNav health="fail" hideCompetitions />

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Outreach</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Review, approve, and send messages to candidates.
            </p>
          </div>
        </div>

        {/* Stats */}
        <StatsBar />

        {/* Tabs */}
        <div className="flex gap-1 mt-6 mb-5 border-b border-border">
          {tabs.map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                "flex items-center gap-1.5 px-3 pb-3 text-sm font-medium transition-colors border-b-2 -mb-px",
                tab === key
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === "queue"     && <QueueTab />}
        {tab === "sent"      && <SentTab />}
        {tab === "templates" && <TemplatesTab />}

        {/* Back link */}
        <div className="mt-10">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Talent Radar
          </Link>
        </div>
      </div>
    </div>
  );
}
