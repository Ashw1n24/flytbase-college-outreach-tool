import { useState } from "react";
import { ChevronDown, Plus, Check, FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTalent } from "@/context/TalentContext";
import type { RoleFitLabel } from "@/lib/utils/rolefit";
import { cn } from "@/lib/utils";

interface Props {
  candidateId: string;
  className?: string;
  size?: "sm" | "default";
  /** First value from computeRoleFit() for this candidate, used to pre-populate the new pipeline name. */
  suggestedRoleFit?: RoleFitLabel;
}

export function AddToPipelineMenu({
  candidateId,
  className,
  size = "sm",
  suggestedRoleFit,
}: Props) {
  const { pipelines, membership, addToPipeline, createPipeline } = useTalent();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const currentPipelineId = membership[candidateId];

  const suggestedName = suggestedRoleFit ? `${suggestedRoleFit} Pipeline` : "";

  const handleOpenCreate = () => {
    setName(suggestedName);
    setCreating(true);
  };

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const p = createPipeline(trimmed);
    addToPipeline(candidateId, p.id);
    setName("");
    setCreating(false);
    setOpen(false);
  };

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setCreating(false);
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          variant={currentPipelineId ? "secondary" : "outline"}
          size={size}
          className={cn("h-7 shrink-0 gap-1 text-xs", className)}
          onClick={(e) => e.stopPropagation()}
        >
          {currentPipelineId ? (
            <Check className="h-3.5 w-3.5 text-ok" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          {currentPipelineId ? "In pipeline" : "Add to Pipeline"}
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-64"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenuLabel>Add to pipeline</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {pipelines.map((p) => (
          <DropdownMenuItem
            key={p.id}
            className="justify-between"
            onSelect={() => addToPipeline(candidateId, p.id)}
          >
            <span className="truncate">{p.name}</span>
            {currentPipelineId === p.id && (
              <Check className="h-3.5 w-3.5 text-ok" />
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        {creating ? (
          <div className="flex items-center gap-1.5 p-1.5">
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                e.stopPropagation();
              }}
              placeholder="Pipeline name"
              className="h-7 text-xs"
            />
            <Button size="sm" className="h-7 px-2 text-xs" onClick={handleCreate}>
              Add
            </Button>
          </div>
        ) : (
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              handleOpenCreate();
            }}
          >
            <FolderPlus className="h-3.5 w-3.5" />
            Create New Pipeline
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
