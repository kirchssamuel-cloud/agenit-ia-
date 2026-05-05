import { z } from "zod";
import type { ToolDefinition } from "./types";
import { addClientFact } from "@/lib/db/agent-brain";

const inputSchema = z.object({
  category: z
    .enum(["preference", "pricing", "team", "process", "constraint", "context", "other"])
    .describe("Type de fait : préférence du client, tarif habituel, info équipe, process métier, contrainte, contexte général."),
  fact: z
    .string()
    .describe("Le fait en langage naturel, à la 3e personne. Ex: 'Le manager Solaris veut les rapports le vendredi soir', 'Le tarif habituel est 7000€ par installation'."),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .default(0.9)
    .describe("Niveau de confiance (0-1). 0.9 = très sûr, 0.5 = à vérifier."),
});

export const rememberFactTool: ToolDefinition<typeof inputSchema, { ok: true; factId: string }> = {
  id: "remember-fact",
  name: "Mémoriser un fait sur le client",
  description:
    "Stocke en mémoire long-terme une information importante sur le client. À utiliser dès qu'il dit quelque chose de structurant que tu voudras te rappeler dans 1 mois (préférences, tarifs, équipe, contraintes). NE PAS utiliser pour des infos triviales ou ponctuelles.",
  category: "ai",
  exposedToLLM: true,
  inputSchema,
  execute: async ({ category, fact, confidence }, ctx) => {
    const stored = await addClientFact({
      clientId: ctx.clientId,
      category,
      fact,
      confidence,
    });
    ctx.log("info", `Fact mémorisé : ${fact}`);
    return { ok: true, factId: stored.id };
  },
};
