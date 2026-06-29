import {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import {
  MOCK_PIPELINES,
  PIPELINE_ROLES,
  type Pipeline,
} from "@/data/talent";
import {
  getPipelinesFn,
  createPipelineFn,
  deletePipelineFn,
  renamePipelineFn,
  addStudentMemberFn,
  removeStudentMemberFn,
  addExpMemberFn,
  removeExpMemberFn,
} from "@/lib/api/pipelines.functions";

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
  deletePipeline: (pipelineId: string) => void;
  renamePipeline: (pipelineId: string, name: string) => void;
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

// ---------------------------------------------------------------------------
// Derive flat membership maps from the pipelines array
// ---------------------------------------------------------------------------

function buildMembership(pipelines: Pipeline[]): {
  membership: Record<string, string>;
  expMembership: Record<string, string>;
} {
  const membership: Record<string, string> = {};
  const expMembership: Record<string, string> = {};
  for (const p of pipelines) {
    for (const id of (p as any).candidate_ids ?? []) membership[id] = p.id;
    for (const id of (p as any).exp_candidate_ids ?? []) expMembership[id] = p.id;
  }
  return { membership, expMembership };
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function TalentProvider({ children }: { children: ReactNode }) {
  const [pipelines, setPipelines] = useState<Pipeline[]>(MOCK_PIPELINES);
  const [membership, setMembership] = useState<Record<string, string>>({});
  const [expMembership, setExpMembership] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [openCandidateId, setOpenCandidateId] = useState<string | null>(null);

  // Load pipelines from Supabase on mount
  useEffect(() => {
    getPipelinesFn().then((rows) => {
      if (!rows.length) return; // keep MOCK_PIPELINES if DB is empty
      const ps: Pipeline[] = rows.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        role: (r.role as any) ?? PIPELINE_ROLES[0],
        // carry through the arrays for buildMembership
        candidate_ids: r.candidate_ids,
        exp_candidate_ids: r.exp_candidate_ids,
      } as any));
      setPipelines(ps);
      const { membership: m, expMembership: em } = buildMembership(ps);
      setMembership(m);
      setExpMembership(em);
    }).catch(() => { /* silently fall back to in-memory */ });
  }, []);

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

      // ── Student pipeline ─────────────────────────────────────────────────
      addToPipeline: (candidateId, pipelineId) => {
        setMembership((m) => ({ ...m, [candidateId]: pipelineId }));
        addStudentMemberFn({ data: { pipelineId, candidateId } }).catch(console.error);
      },
      removeFromPipeline: (candidateId) => {
        const pipelineId = membership[candidateId];
        setMembership((m) => { const n = { ...m }; delete n[candidateId]; return n; });
        if (pipelineId) removeStudentMemberFn({ data: { pipelineId, candidateId } }).catch(console.error);
      },

      // ── Pipeline management ──────────────────────────────────────────────
      createPipeline: (name) => {
        const tempId = `p${Date.now()}`;
        const p: Pipeline = {
          id: tempId,
          name,
          description: "Custom pipeline.",
          role: PIPELINE_ROLES[0],
        };
        setPipelines((prev) => [...prev, p]);
        // Create in DB and swap temp id for real UUID
        createPipelineFn({ data: { name, description: p.description, role: p.role } })
          .then((row) => {
            setPipelines((prev) => prev.map((x) => x.id === tempId ? { ...x, id: row.id } : x));
            setMembership((m) => {
              const n = { ...m };
              Object.keys(n).forEach((k) => { if (n[k] === tempId) n[k] = row.id; });
              return n;
            });
            setExpMembership((m) => {
              const n = { ...m };
              Object.keys(n).forEach((k) => { if (n[k] === tempId) n[k] = row.id; });
              return n;
            });
          })
          .catch(console.error);
        return p;
      },
      deletePipeline: (pipelineId) => {
        setPipelines((prev) => prev.filter((p) => p.id !== pipelineId));
        setMembership((m) => { const n = { ...m }; Object.keys(n).forEach((k) => { if (n[k] === pipelineId) delete n[k]; }); return n; });
        setExpMembership((m) => { const n = { ...m }; Object.keys(n).forEach((k) => { if (n[k] === pipelineId) delete n[k]; }); return n; });
        deletePipelineFn({ data: { id: pipelineId } }).catch(console.error);
      },
      renamePipeline: (pipelineId, name) => {
        setPipelines((prev) => prev.map((p) => p.id === pipelineId ? { ...p, name } : p));
        renamePipelineFn({ data: { id: pipelineId, name } }).catch(console.error);
      },

      setNote: (candidateId, val) =>
        setNotes((n) => ({ ...n, [candidateId]: val })),
      pipelineOf,
      isInPipeline: (candidateId) => Boolean(membership[candidateId]),
      pipelineMemberIds: (pipelineId) =>
        Object.entries(membership)
          .filter(([, pid]) => pid === pipelineId)
          .map(([id]) => id),

      // ── Experienced pipeline ─────────────────────────────────────────────
      addToExpPipeline: (candidateId, pipelineId) => {
        setExpMembership((m) => ({ ...m, [candidateId]: pipelineId }));
        addExpMemberFn({ data: { pipelineId, candidateId } }).catch(console.error);
      },
      removeFromExpPipeline: (candidateId) => {
        const pipelineId = expMembership[candidateId];
        setExpMembership((m) => { const n = { ...m }; delete n[candidateId]; return n; });
        if (pipelineId) removeExpMemberFn({ data: { pipelineId, candidateId } }).catch(console.error);
      },
      isInExpPipeline: (candidateId) => Boolean(expMembership[candidateId]),
      expPipelineOf,
      expMemberIds: (pipelineId) =>
        Object.entries(expMembership)
          .filter(([, pid]) => pid === pipelineId)
          .map(([id]) => id),

      // ── Combined count ───────────────────────────────────────────────────
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
