import { Inbox } from "lucide-react";
import { z } from "zod";
import type { ModuleDefinition, ModuleRunResult } from "../types";

/**
 * Module Daily Triage — l'assistant matin/soir du commercial terrain.
 *
 * Use case principal (commerciaux panneaux solaires de Samuel) :
 *
 *   🌅 7h00 (cron morning-triage)
 *     L'agent lit Gmail → classe → archive le crap → pousse les leads
 *     dans le CRM (iCall26 par défaut, extensible) → t'envoie un résumé
 *     WhatsApp avec les leads chauds à appeler en priorité.
 *
 *   🌆 18h00 (cron evening-planning)
 *     L'agent lit Google Calendar + l'historique CRM → identifie les
 *     RDV de demain → cherche infos sur chaque prospect (web search,
 *     historique appels) → t'envoie un brief WhatsApp structuré.
 *
 * Le module ne contient PAS de logique métier — c'est l'agent (brain.ts)
 * qui orchestre les tools en fonction du prompt envoyé par le cron.
 *
 * Extensible à d'autres CRM via le tool push-icall26 (à dupliquer en
 * push-hubspot, push-pipedrive, etc. quand on en a besoin).
 */

const configSchema = z.object({
  crmTarget: z
    .enum(["icall26", "hubspot", "pipedrive", "none"])
    .default("icall26")
    .describe(
      "CRM cible où pousser les nouveaux leads. 'none' = juste résumer, ne pas pousser.",
    ),
  morningTime: z
    .string()
    .default("07:00")
    .describe("Heure d'envoi du résumé matin (Europe/Paris). Format HH:MM."),
  eveningTime: z
    .string()
    .default("18:00")
    .describe("Heure d'envoi du brief soir (Europe/Paris). Format HH:MM."),
  gmailQuery: z
    .string()
    .default("newer_than:1d -label:Triaged in:inbox")
    .describe(
      "Filtre Gmail pour le triage matin. Par défaut : nouveaux emails de la veille pas encore triés.",
    ),
  calendarRange: z
    .string()
    .default("tomorrow")
    .describe(
      "Plage du calendrier à analyser le soir. 'tomorrow' (défaut), 'today', 'next-7-days'.",
    ),
  webSearchForBrief: z
    .boolean()
    .default(true)
    .describe(
      "Activer la recherche web pour enrichir le brief (météo, infos prospect, actu).",
    ),
});

type DailyTriageConfig = z.infer<typeof configSchema>;

export const dailyTriageModule: ModuleDefinition<typeof configSchema> = {
  id: "daily-triage",
  name: "Assistant matin/soir",
  shortDescription:
    "L'agent trie ta boîte mail le matin (lead → CRM, spam → poubelle) et prépare ton planning RDV le soir.",
  longDescription:
    "À 7h chaque matin, l'agent lit tes nouveaux emails Gmail, classe chaque message, archive le spam et les emails déjà traités, ajoute les nouveaux leads dans ton CRM, et te résume tout sur WhatsApp avec ce que tu dois traiter en priorité. À 18h, il lit ton calendrier + l'historique CRM, recherche des infos sur tes prospects (web), et t'envoie un brief structuré pour préparer tes RDV du lendemain. Conçu pour un commercial terrain (panneaux solaires, fenêtres, PAC, etc.) mais utilisable par n'importe quel pro qui jongle entre boîte mail / calendrier / CRM.",
  category: "leads",
  icon: Inbox,
  version: "0.1.0",
  status: "alpha",
  pricing: {
    monthlyEUR: 49,
  },
  // Tools accessibles à l'agent quand ce module est activé.
  tools: [
    "read-gmail-inbox",
    "gmail-archive",
    "read-google-calendar",
    "push-icall26",
    "read-icall26-leads",
    "read-icall26-appointments",
    "send-whatsapp-proactive",
    "web-search",
    "remember-fact",
  ],
  triggers: ["cron", "manual"],
  configSchema,
  defaultConfig: {
    crmTarget: "icall26",
    morningTime: "07:00",
    eveningTime: "18:00",
    gmailQuery: "newer_than:1d -label:Triaged in:inbox",
    calendarRange: "tomorrow",
    webSearchForBrief: true,
  } as DailyTriageConfig,
  // Pas de run() ici — le module fonctionne via les cron endpoints
  // /api/cron/morning-triage et /api/cron/evening-planning qui invoquent
  // chatWithAgent avec le prompt approprié. Cette approche laisse l'agent
  // décider de l'enchaînement des tools en fonction du contexte (au lieu
  // d'avoir une logique métier figée dans le module).
  run: async (ctx): Promise<ModuleRunResult> => {
    return {
      ok: false,
      summary:
        "Module daily-triage ne s'exécute pas via run() direct. Utiliser /api/cron/morning-triage ou /api/cron/evening-planning, qui invoquent l'agent avec le prompt approprié.",
      data: { config: ctx.config },
    };
  },
};
