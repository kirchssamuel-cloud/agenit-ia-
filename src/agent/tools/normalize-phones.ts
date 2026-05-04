import { z } from "zod";
import type { ToolDefinition } from "./types";

const inputSchema = z.object({
  rows: z.array(z.record(z.string(), z.string())),
  phoneFields: z
    .array(z.string())
    .default(["telephone", "tel", "phone", "mobile", "portable"])
    .describe("Champs à normaliser. Insensible à la casse."),
  defaultCountryCode: z.string().default("+33"),
});

export interface NormalizedRowsOutput {
  rows: Record<string, string>[];
  cleanedCount: number;
  invalidCount: number;
}

export const normalizePhonesTool: ToolDefinition<typeof inputSchema, NormalizedRowsOutput> = {
  id: "normalize-phones",
  name: "Normaliser des numéros de téléphone",
  description:
    "Nettoie les numéros (espaces, points, tirets, parenthèses) et applique le format E.164 avec préfixe pays.",
  category: "data",
  exposedToLLM: false,
  inputSchema,
  execute: async ({ rows, phoneFields, defaultCountryCode }, ctx) => {
    const phoneSet = new Set(phoneFields.map((f) => f.toLowerCase()));
    let cleanedCount = 0;
    let invalidCount = 0;
    const out = rows.map((row) => {
      const next: Record<string, string> = { ...row };
      for (const key of Object.keys(row)) {
        if (phoneSet.has(key.toLowerCase())) {
          const cleaned = normalizeOne(row[key], defaultCountryCode);
          if (cleaned) {
            next[key] = cleaned;
            cleanedCount++;
          } else if (row[key]?.trim().length > 0) {
            invalidCount++;
          }
        }
      }
      return next;
    });
    ctx.log("info", `Téléphones normalisés : ${cleanedCount} ok, ${invalidCount} invalides`);
    return { rows: out, cleanedCount, invalidCount };
  },
};

function normalizeOne(raw: string | undefined, defaultCC: string): string | null {
  if (!raw) return null;
  let s = raw.replace(/[\s.\-()_]/g, "");
  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (s.startsWith("+")) {
    return /^\+\d{8,15}$/.test(s) ? s : null;
  }
  if (/^\d+$/.test(s)) {
    if (s.startsWith("0") && defaultCC === "+33") {
      return `+33${s.slice(1)}`;
    }
    return `${defaultCC}${s.replace(/^0+/, "")}`;
  }
  return null;
}
