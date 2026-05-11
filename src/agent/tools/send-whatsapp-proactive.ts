import { z } from "zod";
import type { ToolDefinition } from "./types";
import { sendWhatsAppMessage } from "@/lib/whatsapp/twilio-client";
import { getNumberForClient } from "@/lib/db/whatsapp";
import { getClient } from "@/lib/db/store";

const inputSchema = z.object({
  message: z
    .string()
    .min(1)
    .max(1600)
    .describe(
      "Le message WhatsApp à envoyer au client. Max 1600 caractères. Sois concis (WhatsApp ce n'est pas un email).",
    ),
  /** Téléphone destinataire optionnel. Si absent, on prend le contactPhone du client. */
  overridePhone: z
    .string()
    .optional()
    .describe(
      "Optionnel — téléphone destinataire au format E.164 (+33...). Par défaut on envoie au contactPhone du client.",
    ),
});

export interface SendWhatsAppProactiveOutput {
  ok: boolean;
  sid?: string;
  to?: string;
  from?: string;
  error?: string;
}

export const sendWhatsAppProactiveTool: ToolDefinition<
  typeof inputSchema,
  SendWhatsAppProactiveOutput
> = {
  id: "send-whatsapp-proactive",
  name: "Envoyer un WhatsApp proactif au client",
  description:
    "Envoie un message WhatsApp de toi (l'agent) vers le client, SANS qu'il y ait eu un message entrant. À utiliser pour les rapports cron (résumé du matin, brief planning du soir, alertes). NE PAS utiliser pour répondre à une conversation en cours — pour ça, retourne juste un texte normal et le pipeline webhook répond automatiquement.",
  category: "communication",
  exposedToLLM: true,
  costEstimateCents: 1,
  requiresSupervision: false, // proactif mais initié par l'agent du client, pas par un tiers
  inputSchema,
  execute: async ({ message, overridePhone }, ctx) => {
    // 1. Récupère le numéro Twilio attribué au client
    const agentNumber = await getNumberForClient(ctx.clientId);
    if (!agentNumber) {
      return {
        ok: false,
        error: `NO_AGENT_NUMBER : aucun numéro WhatsApp attribué au client ${ctx.clientId}. Lancer Setup MVP ou provisionAgentForClient.`,
      };
    }

    // 2. Détermine le destinataire
    let to = overridePhone;
    if (!to) {
      const client = getClient(ctx.clientId);
      to = client?.contactPhone;
    }
    if (!to) {
      return {
        ok: false,
        error: `NO_DESTINATION_PHONE : pas d'overridePhone fourni et le client n'a pas de contactPhone.`,
      };
    }

    // 3. Envoie via Twilio
    const result = await sendWhatsAppMessage({
      from: agentNumber.phoneNumber,
      to,
      body: message,
    });

    if (result.status === "failed") {
      ctx.log(
        "error",
        `send-whatsapp-proactive échec: ${result.errorCode ?? "?"} ${result.errorMessage ?? ""}`,
      );
      return {
        ok: false,
        error: `${result.errorCode ?? "FAILED"}: ${result.errorMessage ?? "unknown"}`,
        from: agentNumber.phoneNumber,
        to,
      };
    }

    ctx.log("info", `send-whatsapp-proactive OK → ${to} (sid=${result.sid})`);

    return {
      ok: true,
      sid: result.sid,
      from: agentNumber.phoneNumber,
      to,
    };
  },
};
