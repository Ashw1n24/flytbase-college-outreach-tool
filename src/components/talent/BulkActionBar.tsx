import { ChevronDown, Download, X, FolderPlus } from "lucide-react";
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

interface Props {
  count: number;
  onClear: () => void;
  onAddToPipeline: (pipelineId: string) => void;
}

export function BulkActionBar({ count, onClear, onAddToPipeline }: Props) {
  const { pipelines } = useTalent();
  if (count === 0) return null;
  return (
    <div className="pointer-events-none sticky bottom-4 z-30 flex justify-center px-6">
      <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-2.5 shadow-lg">
        <span className="text-sm font-medium">
          {count} candidate{count > 1 ? "s" : ""} selected
        </span>
        <div className="h-5 w-px bg-border" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="h-8 gap-1.5">
              <FolderPlus className="h-4 w-4" />
              Add to Pipeline
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center">
            <DropdownMenuLabel>Add {count} to pipeline</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {pipelines.map((p) => (
              <DropdownMenuItem
                key={p.id}
                onSelect={() => onAddToPipeline(p.id)}
              >
                {p.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="outline" size="sm" className="h-8 gap-1.5">
          <Download className="h-4 w-4" />
          Export Selected
        </Button>
        <Button variant="ghost" size="sm" className="h-8 gap-1.5" onClick={onClear}>
          <X className="h-4 w-4" />
          Clear
        </Button>
      </div>
    </div>
  );
}