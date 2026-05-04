import { z } from "zod";
import type { ToolDefinition } from "./types";

const inputSchema = z.object({
  rows: z.array(z.record(z.string(), z.string())),
  /** Mapping colonnes → champs iCall26. Défini dans la config du module. */
  columnMapping: z.record(z.string(), z.string()).default({}),
  campaignId: z.string().optional(),
});

export interface PushIcall26Output {
  pushed: number;
  failed: number;
  errors: string[];
}

export const pushIcall26Tool: ToolDefinition<typeof inputSchema, PushIcall26Output> = {
  id: "push-icall26",
  name: "Pousser des leads dans iCall26",
  description:
    "Crée chaque ligne en lead dans iCall26 via l'API. Mapping de colonnes paramétrable.",
  category: "integration",
  exposedToLLM: false,
  inputSchema,
  execute: async (_input, ctx) => {
    ctx.log("warn", "push-icall26 : pas encore implémenté (en attente de la doc API iCall26).");
    throw new Error(
      "Tool 'push-icall26' not implemented yet. À implémenter dès réception de la doc API iCall26.",
    );
  },
};
