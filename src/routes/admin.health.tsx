import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Activity,
  RefreshCw,
  Database,
  Cpu,
  Search,
  RotateCcw,
  Loader2,
} from "lucide-react";
import { TopNav } from "@/components/talent/TopNav";
import { Button } from "@/components/ui/button";
import { getSystemHealthFn, type ServiceCheck } from "@/lib/api/health.functions";
import { recomputeStudentScoresFn } from "@/lib/api/candidates.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/health")({
  head: () => ({
    meta: [
      { title: "API Health · Talent Radar · FlytBase" },
      {
        name: "description",
        content: "Live API health checks for Supabase, Apify, and Anthropic.",
      },
    ],
  }),
  component: HealthPage,
});

const STATUS_META = {
  ok:   { label: "OK",       Icon: CheckCircle2, text: "text-ok",   bg: "bg-ok/10",   border: "border-ok/30"   },
  warn: { label: "DEGRADED", Icon: AlertTriangle, text: "text-warn", bg: "bg-warn/10", border: "border-warn/30" },
  fail: { label: "FAIL",     Icon: XCircle,       text: "text-fail", bg: "bg-fail/10", border: "border-fail/30" },
} as const;

const SERVICE_ICONS: Record<string, typeof Database> = {
  supabase:   Database,
  apify:      Search,
  anthropic:  Cpu,
};

function ServiceCard({ svc }: { svc: ServiceCheck }) {
  const meta = STATUS_META[svc.status] ?? STATUS_META.fail;
  const Icon = SERVICE_ICONS[svc.id] ?? Activity;
  return (
    <div className={cn("rounded-lg border bg-card p-4", meta.border)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{svc.name}</span>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold uppercase",
            meta.bg,
            meta.text,
          )}
        >
          <meta.Icon className="h-3 w-3" />
          {meta.label}
        </span>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">{svc.detail}</p>

      {/* Apify credit bar */}
      {svc.credits && (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
            <span>Monthly usage</span>
            <span>${svc.credits.usedUsd.toFixed(2)} / ${svc.credits.totalUsd.toFixed(2)}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full",
                (svc.credits.usedUsd / svc.credits.totalUsd) >= 0.8 ? "bg-warn" : "bg-primary",
              )}
              style={{ width: `${Math.min((svc.credits.usedUsd / svc.credits.totalUsd) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* DB counts */}
      {svc.counts && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            { label: "Students",    value: svc.counts.candidates },
            { label: "Experienced", value: svc.counts.experienced },
            { label: "Campaigns",   value: svc.counts.campaigns },
          ].map(({ label, value }) => (
            <div key={label} className="rounded bg-muted/50 px-2 py-1.5 text-center">
              <p className="text-base font-semibold tabular-nums">{value.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      )}

      <p className="mt-2 text-right text-[10px] text-muted-foreground tabular-nums">
        {svc.latencyMs}ms
      </p>
    </div>
  );
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.round(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}

function HealthPage() {
  const {
    data: healthData,
    isLoading,
    isFetching,
    refetch,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ["system-health"],
    queryFn: () => getSystemHealthFn(),
    staleTime: 2 * 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
  });

  const services = healthData?.services ?? [];
  const okCount   = services.filter((s) => s.status === "ok").length;
  const warnCount = services.filter((s) => s.status === "warn").length;
  const failCount = services.filter((s) => s.status === "fail").length;
  const overall   = healthData?.overallStatus ?? "warn";
  const overallMeta = STATUS_META[overall];

  const [recomputing, setRecomputing] = useState(false);
  const [recomputeResult, setRecomputeResult] = useState<string | null>(null);

  const handleRecompute = async () => {
    setRecomputing(true);
    setRecomputeResult(null);
    try {
      const res = await recomputeStudentScoresFn();
      setRecomputeResult(`Updated ${res.updated} candidates` + (res.errors ? ` (${res.errors} errors)` : ""));
    } catch (e) {
      setRecomputeResult(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRecomputing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopNav />
      <div className="mx-auto max-w-4xl px-6 py-6">
        <Link
          to="/"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to search
        </Link>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold tracking-tight">API Health</h1>
          </div>
          <div className="flex items-center gap-3">
            {dataUpdatedAt > 0 && (
              <span className="text-xs text-muted-foreground">
                Last checked {relativeTime(new Date(dataUpdatedAt).toISOString())}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
              {isFetching ? "Checking…" : "Refresh"}
            </Button>
          </div>
        </div>

        {/* Summary bar */}
        <div className={cn(
          "mt-4 flex items-center gap-3 rounded-lg border px-4 py-3",
          overallMeta.bg, overallMeta.border,
        )}>
          <overallMeta.Icon className={cn("h-5 w-5", overallMeta.text)} />
          <span className={cn("text-sm font-semibold", overallMeta.text)}>
            {overall === "ok" ? "All systems operational" : overall === "warn" ? "Some services degraded" : "One or more services failing"}
          </span>
          <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
            <span className="text-ok">{okCount} OK</span>
            {warnCount > 0 && <span className="text-warn">{warnCount} degraded</span>}
            {failCount > 0 && <span className="text-fail">{failCount} failing</span>}
          </div>
        </div>

        {/* Service cards */}
        {isLoading ? (
          <div className="mt-8 text-center text-sm text-muted-foreground">
            <RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin opacity-50" />
            Pinging services…
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-1">
            {services.map((svc) => (
              <ServiceCard key={svc.id} svc={svc} />
            ))}
          </div>
        )}

        {/* Env key checklist */}
        <div className="mt-6 rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Environment Keys</h2>
          <div className="space-y-1.5">
            {[
              { key: "ANTHROPIC_API_KEY", present: services.find(s => s.id === "anthropic")?.status !== "fail" || services.find(s => s.id === "anthropic")?.detail !== "ANTHROPIC_API_KEY not configured" },
              { key: "APIFY_API_KEY",   present: services.find(s => s.id === "apify")?.detail !== "APIFY_API_KEY not configured" },
              { key: "SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY", present: services.find(s => s.id === "supabase")?.status === "ok" },
            ].map(({ key, present }) => (
              <div key={key} className="flex items-center gap-2 text-xs">
                {present ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-ok" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 text-fail" />
                )}
                <span className={cn("font-mono", present ? "text-foreground" : "text-fail")}>
                  {key}
                </span>
                {!present && (
                  <span className="text-muted-foreground">— missing from .env</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Maintenance */}
        <div className="mt-6 rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Maintenance</h2>
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              className="h-8 gap-1.5"
              onClick={handleRecompute}
              disabled={recomputing}
            >
              {recomputing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RotateCcw className="h-3.5 w-3.5" />
              )}
              {recomputing ? "Recomputing…" : "Recompute student scores"}
            </Button>
            {recomputeResult && (
              <span className="text-xs text-muted-foreground">{recomputeResult}</span>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Recalculates culture_score for every student from their stored competitions and positions of responsibility.
          </p>
        </div>
      </div>
    </div>
  );
}
