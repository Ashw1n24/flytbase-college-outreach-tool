import {
  ChevronDown,
  Zap,
  Settings,
  FolderKanban,
  Users,
  Trophy,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTalent } from "@/context/TalentContext";
import { useQuery } from "@tanstack/react-query";
import { getPendingFlaggedFn } from "@/lib/api/competitions.functions";
import { cn } from "@/lib/utils";

type HealthState = "ok" | "warn" | "fail";

const HEALTH_META: Record<
  HealthState,
  { label: string; dot: string; text: string }
> = {
  ok: { label: "Healthy", dot: "bg-ok", text: "text-ok" },
  warn: { label: "Degraded", dot: "bg-warn", text: "text-warn" },
  fail: { label: "Failing", dot: "bg-fail", text: "text-fail" },
};

export function TopNav({
  health = "fail",
  hideCompetitions = false,
}: {
  health?: HealthState;
  hideCompetitions?: boolean;
}) {
  const h = HEALTH_META[health];
  const { pipelines, pipelineMemberCount } = useTalent();
  const { data: pendingFlagged = [] } = useQuery({
    queryKey: ["flagged_competitions", "pending"],
    queryFn: () => getPendingFlaggedFn(),
    staleTime: 60_000,
    enabled: !hideCompetitions,
  });
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-card px-4">
      <div className="flex items-center gap-2">
        <img
          src="/flytbase-logo.png"
          alt="FlytBase"
          className="mr-4 h-8 w-8 rounded-lg object-contain"
        />
        <div className="leading-tight">
          <Link to="/" className="text-sm font-semibold tracking-tight hover:text-primary">
            Talent Radar
          </Link>
          <p className="text-[11px] text-muted-foreground">FlytBase · Sourcing Engine</p>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1.5">
              <FolderKanban className="h-4 w-4" />
              Pipelines
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>Pipelines</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {pipelines.map((p) => (
              <DropdownMenuItem key={p.id} asChild className="justify-between">
                <Link to="/pipelines" search={{ pipeline: p.id }}>
                  <span className="flex items-center gap-2">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    {p.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {pipelineMemberCount(p.id)}
                  </span>
                </Link>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="text-muted-foreground">
              <Link to="/pipelines">Manage Pipelines →</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {!hideCompetitions && (
          <Button asChild variant="outline" size="sm" className="relative h-8 gap-1.5">
            <Link to="/competitions">
              <Trophy className="h-4 w-4" />
              Competitions
              {pendingFlagged.length > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
                  {pendingFlagged.length}
                </span>
              )}
            </Link>
          </Button>
        )}

        <Button asChild variant="outline" size="sm" className="h-8 gap-1.5">
          <Link to="/admin/health">
            <span className={cn("h-2 w-2 rounded-full", h.dot)} />
            <Zap className="h-4 w-4" />
            <span className={cn("font-medium", h.text)}>Health</span>
          </Link>
        </Button>

        <Button variant="outline" size="sm" className="h-8 gap-1.5">
          <Settings className="h-4 w-4" />
          Admin
        </Button>
      </div>
    </header>
  );
}