import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  MOCK_PIPELINES,
  INITIAL_MEMBERSHIP,
  type Pipeline,
} from "@/data/talent";

interface TalentContextValue {
  pipelines: Pipeline[];
  /** candidateId -> pipelineId */
  membership: Record<string, string>;
  notes: Record<string, string>;
  openCandidateId: string | null;
  openDrawer: (id: string) => void;
  closeDrawer: () => void;
  addToPipeline: (candidateId: string, pipelineId: string) => void;
  removeFromPipeline: (candidateId: string) => void;
  createPipeline: (name: string) => Pipeline;
  setNote: (candidateId: string, value: string) => void;
  pipelineOf: (candidateId: string) => Pipeline | null;
  isInPipeline: (candidateId: string) => boolean;
  pipelineMemberIds: (pipelineId: string) => string[];
  pipelineMemberCount: (pipelineId: string) => number;
}

const TalentContext = createContext<TalentContextValue | null>(null);

export function TalentProvider({ children }: { children: ReactNode }) {
  const [pipelines, setPipelines] = useState<Pipeline[]>(MOCK_PIPELINES);
  const [membership, setMembership] =
    useState<Record<string, string>>(INITIAL_MEMBERSHIP);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [openCandidateId, setOpenCandidateId] = useState<string | null>(null);

  const value = useMemo<TalentContextValue>(() => {
    const pipelineOf = (candidateId: string) => {
      const pid = membership[candidateId];
      return pid ? pipelines.find((p) => p.id === pid) ?? null : null;
    };

    return {
      pipelines,
      membership,
      notes,
      openCandidateId,
      openDrawer: (id) => setOpenCandidateId(id),
      closeDrawer: () => setOpenCandidateId(null),
      addToPipeline: (candidateId, pipelineId) =>
        setMembership((m) => ({ ...m, [candidateId]: pipelineId })),
      removeFromPipeline: (candidateId) =>
        setMembership((m) => {
          const next = { ...m };
          delete next[candidateId];
          return next;
        }),
      createPipeline: (name) => {
        const p: Pipeline = {
          id: `p${Date.now()}`,
          name,
          description: "Custom pipeline created in this session.",
          role: name,
        };
        setPipelines((prev) => [...prev, p]);
        return p;
      },
      setNote: (candidateId, val) =>
        setNotes((n) => ({ ...n, [candidateId]: val })),
      pipelineOf,
      isInPipeline: (candidateId) => Boolean(membership[candidateId]),
      pipelineMemberIds: (pipelineId) =>
        Object.entries(membership)
          .filter(([, pid]) => pid === pipelineId)
          .map(([candidateId]) => candidateId),
      pipelineMemberCount: (pipelineId) =>
        Object.values(membership).filter((pid) => pid === pipelineId).length,
    };
  }, [pipelines, membership, notes, openCandidateId]);

  return (
    <TalentContext.Provider value={value}>{children}</TalentContext.Provider>
  );
}

export function useTalent() {
  const ctx = useContext(TalentContext);
  if (!ctx) throw new Error("useTalent must be used within TalentProvider");
  return ctx;
}
