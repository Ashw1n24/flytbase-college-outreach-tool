import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  MOCK_CANDIDATES,
  MOCK_PIPELINES,
  INITIAL_MEMBERSHIP,
  type Candidate,
  type Pipeline,
} from "@/data/talent";

interface TalentContextValue {
  pipelines: Pipeline[];
  /** candidateId -> pipelineId */
  membership: Record<string, string>;
  notes: Record<string, string>;
  candidates: Candidate[];
  openCandidateId: string | null;
  openCandidate: Candidate | null;
  openDrawer: (id: string) => void;
  closeDrawer: () => void;
  addToPipeline: (candidateId: string, pipelineId: string) => void;
  removeFromPipeline: (candidateId: string) => void;
  createPipeline: (name: string) => Pipeline;
  setNote: (candidateId: string, value: string) => void;
  pipelineOf: (candidateId: string) => Pipeline | null;
  candidatesInPipeline: (pipelineId: string) => Candidate[];
}

const TalentContext = createContext<TalentContextValue | null>(null);

export function TalentProvider({ children }: { children: ReactNode }) {
  const [pipelines, setPipelines] = useState<Pipeline[]>(MOCK_PIPELINES);
  const [membership, setMembership] =
    useState<Record<string, string>>(INITIAL_MEMBERSHIP);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [openCandidateId, setOpenCandidateId] = useState<string | null>(null);

  const candidates = useMemo(
    () =>
      MOCK_CANDIDATES.map((c) => ({
        ...c,
        in_pipeline: Boolean(membership[c.id]),
      })),
    [membership],
  );

  const value = useMemo<TalentContextValue>(() => {
    const pipelineOf = (candidateId: string) => {
      const pid = membership[candidateId];
      return pid ? pipelines.find((p) => p.id === pid) ?? null : null;
    };

    return {
      pipelines,
      membership,
      notes,
      candidates,
      openCandidateId,
      openCandidate: candidates.find((c) => c.id === openCandidateId) ?? null,
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
      candidatesInPipeline: (pipelineId) =>
        candidates.filter((c) => membership[c.id] === pipelineId),
    };
  }, [pipelines, membership, notes, candidates, openCandidateId]);

  return (
    <TalentContext.Provider value={value}>{children}</TalentContext.Provider>
  );
}

export function useTalent() {
  const ctx = useContext(TalentContext);
  if (!ctx) throw new Error("useTalent must be used within TalentProvider");
  return ctx;
}