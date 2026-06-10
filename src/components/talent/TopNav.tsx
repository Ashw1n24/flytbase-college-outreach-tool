import {
  Search,
  ChevronDown,
  Zap,
  Settings,
  Plus,
  FolderKanban,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

const PIPELINES = [
  { name: "SWE Intern — July 2025", count: 12 },
  { name: "Hardware Lead — Q3", count: 5 },
  { name: "Founders Office — 2025", count: 8 },
];

export function TopNav({ health = "fail" }: { health?: HealthState }) {
  const h = HEALTH_META[health];
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-card px-4">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Search className="h-4 w-4" />
        </div>
        <div className="leading-tight">
          <h1 className="text-sm font-semibold tracking-tight">
            High-Agency Talent Engine
          </h1>
          <p className="text-[11px] text-muted-foreground">FlytBase · Internal</p>
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
            {PIPELINES.map((p) => (
              <DropdownMenuItem key={p.name} className="justify-between">
                <span className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  {p.name}
                </span>
                <span className="text-xs text-muted-foreground">{p.count}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Plus className="h-3.5 w-3.5" />
              Create New Pipeline
            </DropdownMenuItem>
            <DropdownMenuItem className="text-muted-foreground">
              Manage Pipelines →
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="outline" size="sm" className="h-8 gap-1.5">
          <span className={cn("h-2 w-2 rounded-full", h.dot)} />
          <Zap className="h-4 w-4" />
          <span className={cn("font-medium", h.text)}>Health</span>
        </Button>

        <Button variant="outline" size="sm" className="h-8 gap-1.5">
          <Settings className="h-4 w-4" />
          Admin
        </Button>
      </div>
    </header>
  );
}