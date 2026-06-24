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
  PIPELINE_ROLES,
  type Pipeline,
} from "@/data/talent";

interface TalentContextValue {
  pipelines: Pipeline[];
  /** student candidateId -> pipelineId */
  membership: Record<string, string>;
  /** experienced candidateId -> pipelineId */
  expMembership: Record<string, string>;
  notes: Record<string, string>;
  openCandidateId: string | null;
  openDrawer: (id: string) => void;
  closeDrawer: () => void;
  // Student pipeline
  addToPipeline: (candidateId: string, pipelineId: string) => void;
  removeFromPipeline: (candidateId: string) => void;
  createPipeline: (name: string) => Pipeline;
  setNote: (candidateId: string, value: string) => void;
  pipelineOf: (candidateId: string) => Pipeline | null;
  isInPipeline: (candidateId: string) => boolean;
  pipelineMemberIds: (pipelineId: string) => string[];
  // Experienced pipeline
  addToExpPipeline: (candidateId: string, pipelineId: string) => void;
  removeFromExpPipeline: (candidateId: string) => void;
  isInExpPipeline: (candidateId: string) => boolean;
  expPipelineOf: (candidateId: string) => Pipeline | null;
  expMemberIds: (pipelineId: string) => string[];
  // Combined count (student + experienced) for nav badge
  pipelineMemberCount: (pipelineId: string) => number;
}

const TalentContext = createContext<TalentContextValue | null>(null);

export function TalentProvider({ children }: { children: ReactNode }) {
  const [pipelines, setPipelines] = useState<Pipeline[]>(MOCK_PIPELINES);
  const [membership, setMembership] =
    useState<Record<string, string>>(INITIAL_MEMBERSHIP);
  const [expMembership, setExpMembership] =
    useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [openCandidateId, setOpenCandidateId] = useState<string | null>(null);

  const value = useMemo<TalentContextValue>(() => {
    const pipelineOf = (candidateId: string) => {
      const pid = membership[candidateId];
      return pid ? pipelines.find((p) => p.id === pid) ?? null : null;
    };
    const expPipelineOf = (candidateId: string) => {
      const pid = expMembership[candidateId];
      return pid ? pipelines.find((p) => p.id === pid) ?? null : null;
    };

    return {
      pipelines,
      membership,
      expMembership,
      notes,
      openCandidateId,
      openDrawer: (id) => setOpenCandidateId(id),
      closeDrawer: () => setOpenCandidateId(null),

      // Student pipeline
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
          role: PIPELINE_ROLES[0],
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
          .map(([id]) => id),

      // Experienced pipeline
      addToExpPipeline: (candidateId, pipelineId) =>
        setExpMembership((m) => ({ ...m, [candidateId]: pipelineId })),
      removeFromExpPipeline: (candidateId) =>
        setExpMembership((m) => {
          const next = { ...m };
          delete next[candidateId];
          return next;
        }),
      isInExpPipeline: (candidateId) => Boolean(expMembership[candidateId]),
      expPipelineOf,
      expMemberIds: (pipelineId) =>
        Object.entries(expMembership)
          .filter(([, pid]) => pid === pipelineId)
          .map(([id]) => id),

      // Combined count
      pipelineMemberCount: (pipelineId) =>
        Object.values(membership).filter((pid) => pid === pipelineId).length +
        Object.values(expMembership).filter((pid) => pid === pipelineId).length,
    };
  }, [pipelines, membership, expMembership, notes, openCandidateId]);

  return (
    <TalentContext.Provider value={value}>{children}</TalentContext.Provider>
  );
}

export function useTalent() {
  const ctx = useContext(TalentContext);
  if (!ctx) throw new Error("useTalent must be used within TalentProvider");
  return ctx;
}
