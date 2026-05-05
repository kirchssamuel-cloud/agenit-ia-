import { z } from "zod";
import type { ToolDefinition } from "./types";
import { runModuleForClient } from "@/agent/runner";

const inputSchema = z.object({
  moduleId: z
    .string()
    .describe("L'ID du module à exécuter (ex: 'lead-cleaning', 'tour-planning')."),
  payload: z
    .record(z.string(), z.unknown())
    .describe("Le payload d'entrée du module (CSV, JSON, fichier base64, etc.) selon le module."),
});

export const runModuleTool: ToolDefinition<
  typeof inputSchema,
  {
    ok: boolean;
    summary: string;
    durationMs: number;
    data?: unknown;
    error?: string;
  }
> = {
  id: "run-module",
  name: "Lancer un module complet",
  description:
    "Exécute un workflow complet (module). Ex: 'lead-cleaning' avec un fichier CSV en payload, 'tour-planning' avec une liste de RDV. À utiliser quand l'utilisateur demande explicitement de lancer un job, ou quand tu détectes que le workflow est nécessaire.",
  category: "utility",
  exposedToLLM: true,
  inputSchema,
  execute: async ({ moduleId, payload }, ctx) => {
    const outcome = await runModuleForClient({
      clientId: ctx.clientId,
      moduleId,
      payload,
      bypassEnabledCheck: false,
    });
    ctx.log("info", `Module ${moduleId} exécuté : ${outcome.result.summary}`);
    return {
      ok: outcome.result.ok,
      summary: outcome.result.summary,
      durationMs: outcome.durationMs,
      data: outcome.result.data,
      error: outcome.result.error,
    };
  },
};
