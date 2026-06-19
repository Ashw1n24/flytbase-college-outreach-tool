import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  getActiveCompetitions,
  getPendingFlaggedCompetitions,
  deactivateCompetition,
  dismissFlagged,
  approveFlagged,
} from "@/lib/db/competitions.server";

export const getActiveCompetitionsFn = createServerFn({ method: "GET" }).handler(
  async () => getActiveCompetitions(),
);

export const getPendingFlaggedFn = createServerFn({ method: "GET" }).handler(
  async () => getPendingFlaggedCompetitions(),
);

export const deactivateCompetitionFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => {
    await deactivateCompetition(data.id);
  });

export const dismissFlaggedFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => {
    await dismissFlagged(data.id);
  });

export const approveFlaggedFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      flaggedId: z.string().min(1),
      competition: z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        short_name: z.string(),
        type: z.string().min(1),
        role_clusters: z.array(z.string()).min(1),
      }),
    }),
  )
  .handler(async ({ data }) => {
    await approveFlagged(data.flaggedId, data.competition);
  });
