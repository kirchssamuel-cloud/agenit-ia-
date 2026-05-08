import "server-only";
import {
  getNumberByPhone,
  appendWhatsAppMessage,
  type WhatsAppNumber,
} from "@/lib/db/whatsapp";
import { sendWhatsAppMessage } from "./twilio-client";

/**
 * Message Handler — pipeline d'un message WhatsApp entrant.
 *
 *   Twilio webhook → handleInboundMessage()
 *      ├─ identifie le numéro agent (To) → trouve le client_id propriétaire
 *      ├─ persiste le message inbound
 *      ├─ appelle le cerveau de l'agent (chatWithAgent)
 *      ├─ envoie la réponse via Twilio
 *      └─ persiste le message outbound
 *
 * Le brain.ts reçoit le clientId + le userMessage. Il s'occupe lui-même
 * de :
 * - Charger les modules actifs du client (filtre les tools)
 * - Lancer la détection de secteur si premier message
 * - Récupérer la mémoire vectorielle
 * - Appeler Claude avec ou sans superviseur
 *
 * En mode démo (pas de clé Anthropic), on bascule sur le stub demo
 * pour ne pas crasher.
 */

export interface InboundWhatsAppPayload {
  /** Numéro de l'utilisateur qui parle à l'agent (E.164) */
  fromUserPhone: string;
  /** Numéro de l'agent (= numéro Twilio) (E.164) */
  toAgentPhone: string;
  /** Texte du message */
  body: string;
  /** SID Twilio du message reçu (pour idempotence) */
  twilioSid?: string;
  /** Type de média si pas texte */
  mediaUrl?: string;
  messageType?: "text" | "image" | "audio" | "video" | "document" | "location";
}

export interface InboundResult {
  ok: boolean;
  /** Le numéro de l'agent attribué (avec son client_id) */
  agentNumber?: WhatsAppNumber;
  /** Réponse texte de l'agent qui a été envoyée au user */
  responseText?: string;
  /** SID Twilio du message envoyé en réponse */
  outboundTwilioSid?: string;
  durationMs: number;
  error?: string;
}

/**
 * Pipeline complet : webhook → DB → agent → DB → Twilio.
 * Conçu pour être appelé depuis /api/webhooks/whatsapp/route.ts.
 */
export async function handleInboundMessage(
  payload: InboundWhatsAppPayload,
): Promise<InboundResult> {
  const t0 = Date.now();

  // 1. Identifier le numéro agent → client_id
  const agentNumber = await getNumberByPhone(payload.toAgentPhone);
  if (!agentNumber) {
    return {
      ok: false,
      durationMs: Date.now() - t0,
      error: `NUMBER_NOT_FOUND: ${payload.toAgentPhone}`,
    };
  }
  if (agentNumber.status !== "assigned" || !agentNumber.clientId) {
    return {
      ok: false,
      agentNumber,
      durationMs: Date.now() - t0,
      error: `NUMBER_NOT_ASSIGNED: status=${agentNumber.status}`,
    };
  }

  const clientId = agentNumber.clientId;

  // 2. Persister le message entrant (best-effort, on continue si échec DB)
  await appendWhatsAppMessage({
    clientId,
    whatsappNumberId: agentNumber.id,
    userPhone: payload.fromUserPhone,
    agentPhone: payload.toAgentPhone,
    direction: "inbound",
    messageText: payload.body,
    messageType: payload.messageType ?? "text",
    mediaUrl: payload.mediaUrl,
    twilioSid: payload.twilioSid,
    status: "received",
  }).catch((err) => {
    console.error(
      `[whatsapp] persist inbound échec : ${(err as Error).message}`,
    );
  });

  // 3. Appeler le cerveau de l'agent
  let responseText = "";
  let agentConversationId: string | undefined;

  try {
    // Import dynamique pour éviter de charger Anthropic SDK si on n'en a pas
    // besoin (par ex. en mode démo). chatWithAgent throw si pas d'API key.
    const { chatWithAgent } = await import("@/agent/brain");
    const result = await chatWithAgent({
      clientId,
      userMessage: payload.body,
      channel: "whatsapp",
    });
    responseText = result.assistantMessage;
    agentConversationId = result.conversationId;
  } catch (err) {
    const msg = (err as Error).message;
    // Mode démo / pas de clé Anthropic → stub
    if (msg.includes("ANTHROPIC_API_KEY")) {
      responseText = stubAgentResponse(payload.body);
    } else {
      console.error(`[whatsapp] brain échec : ${msg}`);
      responseText = "Désolé, un problème technique m'empêche de te répondre maintenant. Réessaie dans quelques instants.";
    }
  }

  // 4. Envoyer la réponse via Twilio
  const sendResult = await sendWhatsAppMessage({
    from: payload.toAgentPhone, // l'agent répond depuis son propre numéro
    to: payload.fromUserPhone,
    body: responseText,
  });

  // 5. Persister le message sortant
  await appendWhatsAppMessage({
    clientId,
    whatsappNumberId: agentNumber.id,
    userPhone: payload.fromUserPhone,
    agentPhone: payload.toAgentPhone,
    direction: "outbound",
    messageText: responseText,
    twilioSid: sendResult.sid || undefined,
    status: sendResult.status === "failed" ? "failed" : "sent",
    errorCode: sendResult.errorCode,
    errorMessage: sendResult.errorMessage,
    agentConversationId,
    costCents: sendResult.costCents,
  }).catch((err) => {
    console.error(
      `[whatsapp] persist outbound échec : ${(err as Error).message}`,
    );
  });

  return {
    ok: sendResult.status !== "failed",
    agentNumber,
    responseText,
    outboundTwilioSid: sendResult.sid || undefined,
    durationMs: Date.now() - t0,
    error:
      sendResult.status === "failed"
        ? `SEND_FAILED: ${sendResult.errorMessage}`
        : undefined,
  };
}

/**
 * Réponse de secours quand pas d'ANTHROPIC_API_KEY (mode démo).
 * Permet de tester le pipeline WhatsApp end-to-end sans clé.
 */
function stubAgentResponse(userMessage: string): string {
  const lower = userMessage.toLowerCase();
  if (lower.includes("devis")) {
    return "📐 Reçu pour un devis. En mode prod (clé Anthropic configurée), je calcule la surface, les matériaux, la marge et je te renvoie le total HT/TTC.\n\n[Mode démo : pas encore de cerveau Claude branché]";
  }
  if (lower.includes("rdv") || lower.includes("rendez")) {
    return "📅 Reçu pour le RDV. En prod je vérifie ton calendrier, je propose des créneaux et j'envoie la confirmation.\n\n[Mode démo : pas encore de cerveau Claude branché]";
  }
  if (lower.includes("salut") || lower.includes("bonjour")) {
    return "👋 Hello ! Je suis ton agent IA. Dis-moi ton métier ou ce que tu veux que je fasse.\n\n[Mode démo : pas encore de cerveau Claude branché]";
  }
  return `Compris : "${userMessage.slice(0, 80)}".\n\nEn mode prod je traite ta demande avec mes outils. Là je suis en démo (pas de clé Anthropic).\n\nPour activer le vrai cerveau : ANTHROPIC_API_KEY dans Vercel.`;
}
