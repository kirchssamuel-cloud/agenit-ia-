import { z } from "zod";
import type { ToolDefinition } from "./types";

const inputSchema = z.object({
  rows: z.array(z.record(z.string(), z.string())),
  keyFields: z
    .array(z.string())
    .default(["telephone", "tel", "phone", "email"])
    .describe("Champs utilisés pour calculer la clé de dédup."),
});

export interface DedupOutput {
  rows: Record<string, string>[];
  duplicatesRemoved: number;
}

export const dedupRowsTool: ToolDefinition<typeof inputSchema, DedupOutput> = {
  id: "dedup-rows",
  name: "Supprimer les doublons",
  description:
    "Supprime les lignes dont la combinaison des champs-clé (téléphone et/ou email par défaut) est déjà vue.",
  category: "data",
  exposedToLLM: false,
  inputSchema,
  execute: async ({ rows, keyFields }, ctx) => {
    const seen = new Set<string>();
    const lcKeys = keyFields.map((k) => k.toLowerCase());
    const out: Record<string, string>[] = [];
    let dups = 0;
    for (const row of rows) {
      const parts: string[] = [];
      for (const lcKey of lcKeys) {
        const realKey = Object.keys(row).find((k) => k.toLowerCase() === lcKey);
        if (realKey) parts.push(row[realKey]?.trim().toLowerCase() ?? "");
      }
      const key = parts.join("||");
      if (key === "" || !seen.has(key)) {
        seen.add(key);
        out.push(row);
      } else {
        dups++;
      }
    }
    ctx.log("info", `Doublons supprimés : ${dups}`);
    return { rows: out, duplicatesRemoved: dups };
  },
};
