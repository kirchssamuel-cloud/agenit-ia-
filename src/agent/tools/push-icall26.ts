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
  /** True si on est en mode mock (pas de vrai push) */
  mock: boolean;
}

export const pushIcall26Tool: ToolDefinition<typeof inputSchema, PushIcall26Output> = {
  id: "push-icall26",
  name: "Pousser des leads dans iCall26",
  description:
    "Crée chaque ligne en lead dans iCall26 via l'API. Mapping de colonnes paramétrable. Mock activé tant que l'API n'est pas branchée.",
  category: "integration",
  exposedToLLM: false,
  inputSchema,
  execute: async ({ rows, columnMapping, campaignId }, ctx) => {
    const apiKey = process.env.ICALL26_API_KEY;
    const apiUrl = process.env.ICALL26_API_URL;

    // Mode mock — tant que les credentials ne sont pas dispo, on simule
    if (!apiKey || !apiUrl) {
      ctx.log(
        "warn",
        `MOCK iCall26 : ${rows.length} lead(s) "poussés" (API non configurée — vraie API à brancher dès réception).`,
        { campaignId, sample: rows[0], columnMapping },
      );
      // Petit délai simulé (réaliste 50ms/lead)
      await new Promise((r) => setTimeout(r, Math.min(rows.length * 5, 200)));
      return {
        pushed: rows.length,
        failed: 0,
        errors: [],
        mock: true,
      };
    }

    // Mode réel (à finaliser dès que la doc API iCall26 arrive)
    let pushed = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const row of rows) {
      try {
        const payload: Record<string, string> = {};
        for (const [src, dest] of Object.entries(columnMapping)) {
          if (row[src] !== undefined) payload[dest] = row[src];
        }
        // Si pas de mapping, on envoie le row brut
        const body = Object.keys(payload).length > 0 ? payload : row;

        const res = await fetch(`${apiUrl}/leads`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...body, campaign_id: campaignId }),
        });

        if (!res.ok) {
          failed++;
          errors.push(`HTTP ${res.status} pour ${row.email ?? row.telephone ?? "lead"}`);
        } else {
          pushed++;
        }
      } catch (err) {
        failed++;
        errors.push((err as Error).message);
      }
    }

    ctx.log("info", `iCall26 : ${pushed} OK, ${failed} échec`, { campaignId });
    return { pushed, failed, errors, mock: false };
  },
};
