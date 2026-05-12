import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import type { ActionContext, ActionResult } from "../types";

/**
 * Action extract_info — extrait des données structurées d'un texte libre
 * en utilisant Claude (LLM extraction).
 *
 * Use case typique : un client envoie "Je veux un devis pour 50m² de
 * carrelage premium dans ma salle de bain" → on extrait
 * { surface: 50, type: "premium", piece: "salle de bain" }.
 */

const MODEL = "claude-haiku-4-5";

export async function extractInfo<T>(
  ctx: ActionContext,
  input: {
    /** Texte source à analyser */
    text: string;
    /** Schema Zod des champs à extraire (avec .describe() pour guider l'LLM) */
    schema: z.ZodObject<z.ZodRawShape>;
    /** Stocke le résultat sous cette clé dans state */
    storeAs: string;
    /** Description optionnelle du contexte pour aider l'LLM */
    contextHint?: string;
  },
): Promise<ActionResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.includes("placeholder")) {
    ctx.log("warn", "extract_info: pas d'ANTHROPIC_API_KEY, retour mock");
    await ctx.updateState({ [input.storeAs]: {} });
    return { type: "next" };
  }

  const anthropic = new Anthropic({ apiKey });

  // Construit un prompt simple pour extraction structurée
  const fieldDescriptions = Object.entries(input.schema.shape)
    .map(([key, zodField]) => {
      const desc =
        (zodField as { description?: string }).description ?? key;
      return `- "${key}" : ${desc}`;
    })
    .join("\n");

  const systemPrompt = `Tu es un extracteur d'informations structuré. Tu reçois un texte libre et tu retournes UN SEUL JSON avec EXACTEMENT les champs demandés. Pas de markdown, pas de texte autour. Juste le JSON brut.

Champs à extraire :
${fieldDescriptions}

Si une information n'est pas présente dans le texte, mets la valeur à null (pas "inconnu", pas "n/a", null).
Les nombres doivent être des nombres (pas des strings).`;

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 500,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: input.contextHint
            ? `Contexte : ${input.contextHint}\n\nTexte à analyser :\n${input.text}`
            : input.text,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const rawText = textBlock?.type === "text" ? textBlock.text : "";

    let extracted: T;
    try {
      // L'LLM peut entourer le JSON de markdown ; on nettoie
      const cleaned = rawText
        .replace(/^```(?:json)?\n?/i, "")
        .replace(/\n?```\s*$/, "")
        .trim();
      extracted = JSON.parse(cleaned);
    } catch (err) {
      ctx.log("error", `extract_info: JSON parse failed sur "${rawText.slice(0, 200)}"`);
      return {
        type: "fail",
        error: `Impossible de parser la réponse LLM : ${(err as Error).message}`,
      };
    }

    ctx.log("info", `extract_info → ${input.storeAs}`, extracted);
    await ctx.updateState({ [input.storeAs]: extracted });
    return { type: "next" };
  } catch (err) {
    ctx.log("error", `extract_info exception : ${(err as Error).message}`);
    return { type: "fail", error: (err as Error).message };
  }
}
