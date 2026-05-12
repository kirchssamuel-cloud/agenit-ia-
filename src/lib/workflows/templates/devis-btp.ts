import "server-only";
import { z } from "zod";
import type { WorkflowDefinition } from "../types";
import { extractInfo } from "../actions/extract-info";
import { sendWhatsAppOwner } from "../actions/send-message";
import { sendEmailTool } from "@/agent/tools/send-email";

/**
 * Workflow devis-btp — pipeline complet de génération + validation + envoi
 * d'un devis BTP (carrelage, plomberie, peinture...).
 *
 * Pipeline :
 *
 *   1. extract_info → parse la demande du client (surface, type, contact)
 *   2. calculate → applique formule de prix
 *   3. send_owner_validation → WhatsApp Samuel pour valider
 *   4. wait_owner → attend la réponse de Samuel
 *   5. handle_owner_response → branche selon "envoie" / "+30%" / "non"
 *   6. (si ajustement) recalculate → goto 3
 *   7. (si envoie) send_email_client → envoie devis par mail
 *   8. complete
 *
 * V1 : pas de PDF (envoi en texte brut). Sprint 2 ajoutera React-PDF.
 */

const requestSchema = z.object({
  nom: z.string().nullable().describe("Nom complet du prospect (ex: 'Mme Martin')"),
  email: z.string().nullable().describe("Email de contact du prospect"),
  surface_m2: z
    .number()
    .nullable()
    .describe("Surface en m² (nombre, sans unité)"),
  type_travaux: z
    .string()
    .nullable()
    .describe("Type de travaux (ex: 'carrelage', 'peinture', 'plomberie')"),
  niveau_gamme: z
    .string()
    .nullable()
    .describe("Gamme : 'budget' / 'moyen' / 'premium'. null si pas précisé."),
});

// Tarifs indicatifs (à externaliser plus tard via un module de config client)
const PRIX_M2: Record<string, Record<string, number>> = {
  carrelage: { budget: 25, moyen: 35, premium: 55 },
  peinture: { budget: 12, moyen: 20, premium: 35 },
  plomberie: { budget: 80, moyen: 120, premium: 200 },
};
const PRIX_M2_DEFAUT = { budget: 30, moyen: 50, premium: 80 };
const MARGE_DEFAUT = 1.4;

export const devisBtpWorkflow: WorkflowDefinition = {
  name: "devis-btp",
  description:
    "Génère un devis BTP basé sur la demande client, le soumet à validation du propriétaire via WhatsApp, et l'envoie au client après accord.",
  version: "0.1.0",
  triggers: [
    {
      type: "message_match",
      pattern: /devis|prix|tarif|combien|c[oô]ute|propose|proposition/i,
      description: "Message contenant 'devis', 'prix', 'tarif', 'combien'…",
    },
  ],
  initialDataSchema: z.object({
    rawRequest: z
      .string()
      .describe("Texte original de la demande du client (email ou message)"),
  }),
  steps: [
    {
      id: "extract",
      description: "Extraire les infos clés de la demande",
      execute: async (ctx) => {
        const raw = (ctx.instance.state.rawRequest as string) ?? "";
        if (!raw) {
          return { type: "fail", error: "rawRequest manquant dans state" };
        }
        return extractInfo(ctx, {
          text: raw,
          schema: requestSchema,
          storeAs: "request",
          contextHint:
            "Demande de devis BTP envoyée par un prospect. Si la gamme n'est pas précisée, laisse null (on demandera).",
        });
      },
    },
    {
      id: "calculate",
      description: "Calculer le devis selon les tarifs",
      execute: async (ctx) => {
        const req = (ctx.instance.state.request ?? {}) as {
          surface_m2?: number | null;
          type_travaux?: string | null;
          niveau_gamme?: string | null;
        };

        if (!req.surface_m2 || req.surface_m2 <= 0) {
          // Demande la surface via owner ou client (V1 : on demande à owner)
          return {
            type: "fail",
            error: "Surface manquante — workflow v1 nécessite une surface valide. (V2 demandera via WhatsApp.)",
          };
        }

        const typeKey = (req.type_travaux ?? "carrelage").toLowerCase().trim();
        const gammeKey = (req.niveau_gamme ?? "moyen").toLowerCase().trim() as
          | "budget"
          | "moyen"
          | "premium";

        const prixCatalogue = PRIX_M2[typeKey] ?? PRIX_M2_DEFAUT;
        const prixHtM2 = prixCatalogue[gammeKey] ?? prixCatalogue.moyen;
        const sousTotal = prixHtM2 * req.surface_m2;
        const marge = (ctx.instance.state.margeMultiplier as number) ?? MARGE_DEFAUT;
        const totalHt = Math.round(sousTotal * marge);
        const tva = Math.round(totalHt * 0.1); // TVA 10% rénovation par défaut
        const totalTtc = totalHt + tva;

        await ctx.updateState({
          calcul: {
            typeKey,
            gammeKey,
            prixHtM2,
            surface: req.surface_m2,
            sousTotal,
            marge,
            totalHt,
            tva,
            totalTtc,
          },
        });
        return { type: "next" };
      },
    },
    {
      id: "send_owner_validation",
      description: "Demander validation à Samuel via WhatsApp",
      execute: async (ctx) => {
        const calc = ctx.instance.state.calcul as Record<string, unknown>;
        const req = ctx.instance.state.request as Record<string, unknown>;
        const message = [
          `📄 Devis prêt — ${req.nom ?? "(prospect sans nom)"}`,
          ``,
          `${calc.surface}m² ${calc.typeKey} ${calc.gammeKey}`,
          `Marge actuelle : ×${calc.marge}`,
          `Total HT : ${calc.totalHt}€`,
          `Total TTC : ${calc.totalTtc}€ (TVA 10%)`,
          ``,
          `Réponds :`,
          `  "envoie" → j'envoie au client`,
          `  "+30%" (ou autre %) → j'ajuste la marge`,
          `  "non" → j'annule`,
        ].join("\n");

        return sendWhatsAppOwner(ctx, { message });
      },
    },
    {
      id: "wait_owner",
      description: "Attendre la réponse de Samuel",
      execute: async () => {
        return {
          type: "wait_input",
          waitingFor: "owner_decision",
          timeoutHours: 24,
        };
      },
    },
    {
      id: "handle_owner_response",
      description: "Interpréter la réponse de Samuel",
      execute: async (ctx) => {
        const lastInput = ctx.instance.state.lastInput as
          | { text: string }
          | undefined;
        const text = (lastInput?.text ?? "").trim().toLowerCase();

        if (!text) {
          return { type: "fail", error: "Aucune réponse owner reçue" };
        }

        // Détection ajustement marge : +XX% ou -XX%
        const pctMatch = text.match(/([+-]?\s*\d+(?:[.,]\d+)?)\s*%/);
        if (pctMatch) {
          const pct = parseFloat(pctMatch[1].replace(",", ".").replace(/\s/g, ""));
          const currentMarge = (ctx.instance.state.margeMultiplier as number) ?? MARGE_DEFAUT;
          const newMarge = currentMarge * (1 + pct / 100);
          await ctx.updateState({ margeMultiplier: parseFloat(newMarge.toFixed(2)) });
          ctx.log("info", `marge ajustée : ${currentMarge} → ${newMarge.toFixed(2)} (${pct > 0 ? "+" : ""}${pct}%)`);
          return { type: "goto", stepId: "calculate" };
        }

        // Détection envoi
        if (/envoie|envoyer|envoi|ok|oui|valide|valid[éeée]|go/.test(text)) {
          return { type: "goto", stepId: "send_email_client" };
        }

        // Détection refus
        if (/non|annul|stop|cancel/.test(text)) {
          return { type: "fail", error: "Owner a refusé l'envoi" };
        }

        // Réponse non comprise → reposer la question
        await ctx.updateState({ lastInput: undefined });
        return { type: "goto", stepId: "send_owner_validation" };
      },
    },
    {
      id: "send_email_client",
      description: "Envoyer le devis au client par email",
      execute: async (ctx) => {
        const req = ctx.instance.state.request as Record<string, unknown>;
        const calc = ctx.instance.state.calcul as Record<string, unknown>;

        if (!req.email || typeof req.email !== "string") {
          return {
            type: "fail",
            error: "Email du client manquant — impossible d'envoyer",
          };
        }

        const body = [
          `Bonjour ${req.nom ?? ""},`,
          ``,
          `Suite à votre demande, voici votre devis :`,
          ``,
          `- Surface : ${calc.surface}m²`,
          `- Travaux : ${calc.typeKey} (${calc.gammeKey})`,
          `- Prix HT : ${calc.totalHt}€`,
          `- TVA (10%) : ${calc.tva}€`,
          `- **Total TTC : ${calc.totalTtc}€**`,
          ``,
          `Pour confirmer ce devis ou poser une question, répondez simplement à cet email.`,
          ``,
          `Cordialement,`,
        ].join("\n");

        try {
          await sendEmailTool.execute(
            {
              to: req.email,
              subject: `Devis ${calc.typeKey} ${calc.surface}m² — ${calc.totalTtc}€ TTC`,
              text: body,
            },
            {
              clientId: ctx.instance.clientId,
              runId: ctx.instance.id,
              log: () => {},
            },
          );
        } catch (err) {
          return { type: "fail", error: `send-email: ${(err as Error).message}` };
        }

        await ctx.updateState({ sentToClient: true, sentAt: new Date().toISOString() });
        return { type: "next" };
      },
    },
    {
      id: "notify_owner_done",
      description: "Confirmer à Samuel que le devis est parti",
      execute: async (ctx) => {
        const req = ctx.instance.state.request as Record<string, unknown>;
        const calc = ctx.instance.state.calcul as Record<string, unknown>;
        return sendWhatsAppOwner(ctx, {
          message: `✅ Devis envoyé à ${req.nom ?? req.email} — ${calc.totalTtc}€ TTC`,
        });
      },
    },
    {
      id: "complete",
      description: "Workflow terminé",
      execute: async () => ({ type: "complete" }),
    },
  ],
};
