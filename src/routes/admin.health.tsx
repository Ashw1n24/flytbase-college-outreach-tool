import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Activity,
  Copy,
  Check,
  Gauge,
} from "lucide-react";
import { TopNav } from "@/components/talent/TopNav";
import { Button } from "@/components/ui/button";
import {
  SCRAPER_HEALTH,
  RATE_LIMITS,
  type ScraperStatus,
} from "@/data/talent";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/health")({
  head: () => ({
    meta: [
      { title: "Scraper Health · High-Agency Talent Engine" },
      {
        name: "description",
        content:
          "Monitor scraper health, free-tier rate limits, and error reports.",
      },
    ],
  }),
  component: HealthPage,
});

const STATUS_META: Record<
  ScraperStatus,
  { label: string; Icon: typeof CheckCircle2; text: string; bg: string }
> = {
  ok: { label: "OK", Icon: CheckCircle2, text: "text-ok", bg: "bg-ok/10" },
  degraded: {
    label: "DEGRADED",
    Icon: AlertTriangle,
    text: "text-warn",
    bg: "bg-warn/10",
  },
  failed: { label: "FAILED", Icon: XCircle, text: "text-fail", bg: "bg-fail/10" },
};

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function HealthPage() {
  const [copied, setCopied] = useState(false);
  const failing = SCRAPER_HEALTH.filter(
    (s) => s.status !== "ok" && s.error_message,
  );

  const errorReport = [
    `# Scraper Error Report — ${new Date().toISOString()}`,
    "",
    ...failing.map(
      (s) =>
        `[${s.status.toUpperCase()}] ${s.name} (${s.source})\n` +
        `  records: ${s.records_extracted}/${s.records_expected} · last run: ${s.last_run}\n` +
        `  error: ${s.error_message}`,
    ),
  ].join("\n");

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(errorReport);
    } catch {
      /* clipboard may be blocked in sandbox */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold tracking-tight">
            Scraper Health Dashboard
          </h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Zero-cost architecture · all sources free-tier
        </p>

        {/* Status summary */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          {(["ok", "degraded", "failed"] as ScraperStatus[]).map((st) => {
            const meta = STATUS_META[st];
            const count = SCRAPER_HEALTH.filter((s) => s.status === st).length;
            return (
              <div
                key={st}
                className="rounded-lg border border-border bg-card p-3"
              >
                <div className={cn("flex items-center gap-2", meta.text)}>
                  <meta.Icon className="h-4 w-4" />
                  <span className="text-xs font-medium uppercase">
                    {meta.label}
                  </span>
                </div>
                <p className="mt-1 text-2xl font-semibold">{count}</p>
              </div>
            );
          })}
        </div>

        {/* Scrapers table */}
        <h2 className="mt-6 text-sm font-semibold">Scrapers</h2>
        <div className="mt-2 overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Scraper</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Extracted / Expected</th>
                <th className="px-4 py-2.5 font-medium">Last Run</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {SCRAPER_HEALTH.map((s) => {
                const meta = STATUS_META[s.status];
                const pct = Math.round(
                  (s.records_extracted / s.records_expected) * 100,
                );
                return (
                  <tr key={s.id}>
                    <td className="px-4 py-3">
                      <div className="font-mono font-medium">{s.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {s.source}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium",
                          meta.bg,
                          meta.text,
                        )}
                      >
                        <meta.Icon className="h-3.5 w-3.5" />
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="tabular-nums text-muted-foreground">
                          {s.records_extracted.toLocaleString()} /{" "}
                          {s.records_expected.toLocaleString()}
                        </span>
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              s.status === "ok"
                                ? "bg-ok"
                                : s.status === "degraded"
                                  ? "bg-warn"
                                  : "bg-fail",
                            )}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {relativeTime(s.last_run)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Rate limits */}
        <h2 className="mt-6 flex items-center gap-2 text-sm font-semibold">
          <Gauge className="h-4 w-4" />
          Free Service Rate Limits
        </h2>
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {RATE_LIMITS.map((r) => {
            const remaining = r.limit - r.used;
            const pct = Math.round((r.used / r.limit) * 100);
            const near = pct >= 80;
            return (
              <div
                key={r.id}
                className="rounded-lg border border-border bg-card p-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{r.service}</p>
                    <p className="text-xs text-muted-foreground">{r.metric}</p>
                  </div>
                  <span
                    className={cn(
                      "text-sm font-semibold tabular-nums",
                      near ? "text-warn" : "text-foreground",
                    )}
                  >
                    {remaining.toLocaleString()} left
                  </span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      near ? "bg-warn" : "bg-primary",
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
                  <span>
                    {r.used.toLocaleString()} / {r.limit.toLocaleString()} used
                  </span>
                  <span>{r.reset_label}</span>
                </p>
              </div>
            );
          })}
        </div>

        {/* Error report */}
        <div className="mt-6 rounded-lg border border-fail/40 bg-fail/5">
          <div className="flex items-center gap-2 border-b border-fail/30 px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-fail" />
            <h2 className="text-sm font-semibold">
              Error Report
              <span className="ml-2 font-normal text-muted-foreground">
                {failing.length} scraper{failing.length !== 1 ? "s" : ""} need
                attention
              </span>
            </h2>
            <Button
              size="sm"
              variant="outline"
              className="ml-auto h-7 gap-1.5 text-xs"
              onClick={copyReport}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-ok" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? "Copied" : "Copy Error Report"}
            </Button>
          </div>
          <pre className="overflow-x-auto px-4 py-3 font-mono text-xs leading-relaxed text-muted-foreground">
            {errorReport}
          </pre>
        </div>
      </div>
    </div>
  );
}