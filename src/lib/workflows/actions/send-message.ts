import "server-only";
import { sendWhatsAppMessage } from "@/lib/whatsapp/twilio-client";
import { getNumberForClient } from "@/lib/db/whatsapp";
import { getClient } from "@/lib/db/store";
import type { ActionContext, ActionResult } from "../types";

/**
 * Action send_whatsapp_owner — envoie un message WhatsApp au PROPRIÉTAIRE
 * du client (le commercial Samuel, pas l'utilisateur final). Sert à
 * demander une validation ou une décision pendant un workflow.
 *
 * Le destinataire = contactPhone du client (= le téléphone perso du
 * commercial qui possède ce compte agent).
 *
 * Note : respecte le kill switch WHATSAPP_SEND_ENABLED (cf. twilio-client.ts).
 */

export async function sendWhatsAppOwner(
  ctx: ActionContext,
  input: {
    /** Texte du message (peut inclure des templates type {{var}}) */
    message: string;
  },
): Promise<ActionResult> {
  const agentNumber = await getNumberForClient(ctx.instance.clientId);
  if (!agentNumber) {
    return {
      type: "fail",
      error: `Aucun numéro WhatsApp attribué au client ${ctx.instance.clientId}`,
    };
  }

  const client = getClient(ctx.instance.clientId);
  const ownerPhone = client?.contactPhone;
  if (!ownerPhone) {
    return {
      type: "fail",
      error: `Client ${ctx.instance.clientId} sans contactPhone — impossible de joindre l'owner`,
    };
  }

  // Substitue les variables {{key}} depuis state
  const finalMessage = interpolate(input.message, ctx.instance.state);

  const result = await sendWhatsAppMessage({
    from: agentNumber.phoneNumber,
    to: ownerPhone,
    body: finalMessage,
  });

  await ctx.updateState({
    lastOwnerMessageSid: result.sid,
    lastOwnerMessageStatus: result.status,
  });

  if (result.status === "failed") {
    ctx.log("error", `send_whatsapp_owner: ${result.errorCode ?? "?"} ${result.errorMessage ?? ""}`);
    return {
      type: "fail",
      error: `Twilio: ${result.errorCode ?? "FAILED"}: ${result.errorMessage ?? ""}`,
    };
  }

  ctx.log("info", `send_whatsapp_owner → ${ownerPhone} (sid=${result.sid})`);
  return { type: "next" };
}

/**
 * Simple substitution {{key}} ou {{nested.path}} depuis state.
 */
function interpolate(template: string, state: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path: string) => {
    const parts = path.split(".");
    let current: unknown = state;
    for (const p of parts) {
      if (typeof current === "object" && current !== null && p in current) {
        current = (current as Record<string, unknown>)[p];
      } else {
        return `{{${path}?}}`;
      }
    }
    if (current === null || current === undefined) return "";
    if (typeof current === "object") return JSON.stringify(current);
    return String(current);
  });
}
