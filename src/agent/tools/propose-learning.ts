import { z } from "zod";
import type { ToolDefinition } from "./types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const inputSchema = z.object({
  type: z
    .enum(["new_skill", "improvement", "correction", "auto_fix"])
    .describe("Type d'apprentissage : nouvelle compétence, amélioration d'une existante, correction d'une erreur, auto-réparation."),
  skillName: z
    .string()
    .describe("Nom court et clair de la compétence (ex: 'Génération devis solaire', 'Relance leads tièdes')."),
  reason: z
    .string()
    .describe("Pourquoi proposer cette skill MAINTENANT. Ex: 'L'utilisateur a posé 3 fois la même question cette semaine', 'J'ai détecté un pattern récurrent'."),
  triggerPattern: z
    .string()
    .optional()
    .describe("Quand cette skill devrait se déclencher (mots-clés ou situation)."),
  actionTemplate: z
    .string()
    .optional()
    .describe("Comment l'agent doit agir quand la skill se déclenche."),
  examples: z
    .array(
      z.object({
        user: z.string(),
        agent: z.string(),
      }),
    )
    .optional()
    .describe("Quelques exemples concrets de conversation user/agent qui démontrent la skill."),
});

export const proposeLearningTool: ToolDefinition<
  typeof inputSchema,
  { ok: true; learningId: string; skillId: string | null }
> = {
  id: "propose-learning",
  name: "Proposer une nouvelle compétence à apprendre",
  description:
    "Quand tu détectes un pattern, une demande répétée, ou une amélioration possible, propose une nouvelle compétence à l'admin. Elle sera revue et activée par lui. NE PAS spammer — utilise uniquement si tu vois quelque chose d'utile et récurrent.",
  category: "ai",
  exposedToLLM: true,
  inputSchema,
  execute: async (input, ctx) => {
    const sb = createSupabaseAdminClient();

    // Crée la skill en draft
    const { data: skillData, error: skillErr } = await sb
      .from("agent_skills")
      .insert({
        name: input.skillName,
        description: input.reason,
        trigger_pattern: input.triggerPattern ?? null,
        action_template: input.actionTemplate ?? null,
        examples: input.examples ?? [],
        client_scope: ctx.clientId,
        status: "draft",
      })
      .select()
      .single();
    if (skillErr) {
      ctx.log("warn", `Échec création skill : ${skillErr.message}`);
    }

    const { data: learningData, error: learningErr } = await sb
      .from("agent_learnings")
      .insert({
        type: input.type,
        skill_id: skillData?.id ?? null,
        reason: input.reason,
        before_state: null,
        after_state: { proposed_skill: input },
        approved_by_admin: false,
      })
      .select()
      .single();
    if (learningErr) throw new Error(`propose-learning: ${learningErr.message}`);

    ctx.log("info", `Apprentissage proposé : ${input.skillName}`);
    return {
      ok: true,
      learningId: (learningData as { id: string }).id,
      skillId: (skillData as { id: string } | null)?.id ?? null,
    };
  },
};
