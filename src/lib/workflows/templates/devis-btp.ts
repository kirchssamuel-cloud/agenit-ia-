import "server-only";
import { z } from "zod";
import type { WorkflowDefinition } from "../types";
import { extractInfo } from "../actions/extract-info";
import { sendWhatsAppOwner } from "../actions/send-message";
import { renderDevisPdf, type DevisData } from "@/lib/pdf/devis-template";
import { sendEmailWithAttachment } from "@/lib/email/send-with-attachment";
import { getClient } from "@/lib/db/store";

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
          return { type: "goto", stepId: "generate_pdf" };
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
      id: "generate_pdf",
      description: "Générer le PDF du devis (charte Kizzo)",
      execute: async (ctx) => {
        const req = ctx.instance.state.request as Record<string, unknown>;
        const calc = ctx.instance.state.calcul as Record<string, unknown>;
        const client = getClient(ctx.instance.clientId);

        const today = new Date().toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        });
        const numero = `DEV-${new Date().getFullYear()}-${ctx.instance.id.slice(0, 6).toUpperCase()}`;

        const data: DevisData = {
          numero,
          date: today,
          client: {
            nom: (req.nom as string) ?? "Client",
            email: (req.email as string) ?? undefined,
          },
          prestation: {
            type: calc.typeKey as string,
            gamme: calc.gammeKey as string,
            surface: calc.surface as number,
            prixHtM2: calc.prixHtM2 as number,
          },
          calcul: {
            sousTotal: calc.sousTotal as number,
            marge: calc.marge as number,
            totalHt: calc.totalHt as number,
            tva: calc.tva as number,
            totalTtc: calc.totalTtc as number,
          },
          emetteur: client
            ? {
                nom: client.name,
                email: client.contactEmail,
                telephone: client.contactPhone,
              }
            : undefined,
        };

        try {
          const pdfBuffer = await renderDevisPdf(data);
          // Stocke base64 dans state pour réutilisation au step suivant
          await ctx.updateState({
            pdfMeta: {
              numero,
              filename: `Devis-${numero}.pdf`,
              sizeBytes: pdfBuffer.byteLength,
              generatedAt: new Date().toISOString(),
            },
            pdfBase64: pdfBuffer.toString("base64"),
          });
          ctx.log("info", `PDF généré (${pdfBuffer.byteLength} bytes)`);
        } catch (err) {
          return {
            type: "fail",
            error: `PDF generation: ${(err as Error).message}`,
          };
        }
        return { type: "next" };
      },
    },
    {
      id: "send_email_client",
      description: "Envoyer le devis au client par email avec PDF en attachment",
      execute: async (ctx) => {
        const req = ctx.instance.state.request as Record<string, unknown>;
        const calc = ctx.instance.state.calcul as Record<string, unknown>;
        const pdfMeta = ctx.instance.state.pdfMeta as
          | { filename: string; numero: string }
          | undefined;
        const pdfBase64 = ctx.instance.state.pdfBase64 as string | undefined;

        if (!req.email || typeof req.email !== "string") {
          return {
            type: "fail",
            error: "Email du client manquant — impossible d'envoyer",
          };
        }
        if (!pdfBase64 || !pdfMeta) {
          return {
            type: "fail",
            error: "PDF non généré — relance generate_pdf",
          };
        }

        const body = [
          `Bonjour ${req.nom ?? ""},`,
          ``,
          `Suite à votre demande, vous trouverez ci-joint votre devis détaillé.`,
          ``,
          `Récap :`,
          `  • ${calc.surface}m² de ${calc.typeKey} (${calc.gammeKey})`,
          `  • Total TTC : ${calc.totalTtc}€ (TVA 10%)`,
          ``,
          `Pour confirmer ou poser une question, répondez simplement à cet email.`,
          ``,
          `Cordialement,`,
        ].join("\n");

        const pdfBuffer = Buffer.from(pdfBase64, "base64");
        const result = await sendEmailWithAttachment({
          to: req.email,
          subject: `Devis ${pdfMeta.numero} — ${calc.totalTtc}€ TTC`,
          text: body,
          attachments: [
            {
              filename: pdfMeta.filename,
              content: pdfBuffer,
              contentType: "application/pdf",
            },
          ],
        });

        if (!result.ok) {
          return {
            type: "fail",
            error: `send-email: ${result.reason ?? "unknown"}`,
          };
        }

        await ctx.updateState({
          sentToClient: true,
          sentAt: new Date().toISOString(),
          emailMessageId: result.messageId,
          // On purge le base64 du state une fois envoyé (économie de DB)
          pdfBase64: undefined,
        });
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
