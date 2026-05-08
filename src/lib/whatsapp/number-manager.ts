import "server-only";
import {
  assignNumberToClient,
  getNumberForClient,
  type WhatsAppNumber,
} from "@/lib/db/whatsapp";
import { sendWhatsAppMessage } from "./twilio-client";
import { getClient } from "@/lib/db/store";

/**
 * Number Manager — orchestration côté business du pool WhatsApp.
 *
 * Responsabilités :
 * - Attribuer un numéro à un client après paiement
 * - Envoyer le message d'onboarding sur WhatsApp (si numéro perso connu)
 * - Notifier le client par email avec son numéro d'agent
 *
 * Délègue à :
 * - lib/db/whatsapp.ts pour les opérations DB
 * - lib/whatsapp/twilio-client.ts pour l'envoi WhatsApp
 * - tools/send-email pour l'email de confirmation (à brancher si besoin)
 */

const ONBOARDING_TEMPLATE = (clientName: string) =>
  `Bonjour ${clientName} 👋

Je suis ton agent IA personnel.

Tu peux me parler dans WhatsApp comme à un assistant : je peux générer des devis, gérer ton CRM, prendre des RDV, lire des tickets, et bien plus selon les modules que tu as activés.

Pour commencer : dis-moi simplement ton métier (carreleur, comptable, agent immo...) et je m'adapterai à ton vocabulaire et tes règles métier.

À tout de suite ✨`;

/**
 * Attribue un numéro à un client (idempotent : si déjà attribué, retourne
 * celui-ci) et envoie le message d'onboarding si on a son numéro perso.
 *
 * @param input.clientId      Le client (UUID public.clients.id)
 * @param input.userPhone     Le téléphone perso du client (E.164)
 *                            Si fourni, on lui envoie le 1er message WhatsApp
 *                            pour qu'il puisse le sauver en contact.
 *
 * Throw NO_WHATSAPP_NUMBER_AVAILABLE si le pool est vide.
 */
export async function provisionAgentForClient(input: {
  clientId: string;
  userPhone?: string;
}): Promise<{
  number: WhatsAppNumber;
  /** True si le message d'onboarding a été envoyé (faux SID en mode démo) */
  onboardingSent: boolean;
  twilioSid?: string;
}> {
  const number = await assignNumberToClient(input.clientId);

  // Pas de téléphone perso → pas d'envoi auto, on retourne juste le numéro.
  // Le client sera notifié par email + via la page de confirmation.
  if (!input.userPhone) {
    return { number, onboardingSent: false };
  }

  // Best-effort : on tente l'envoi d'onboarding mais on ne fail pas si Twilio
  // rejette (le numéro est déjà attribué en DB, le client peut quand même
  // être notifié par email).
  const client = getClient(input.clientId);
  const clientName = client?.name ?? "ami";
  const result = await sendWhatsAppMessage({
    from: number.phoneNumber,
    to: input.userPhone,
    body: ONBOARDING_TEMPLATE(clientName),
  });

  return {
    number,
    onboardingSent: result.status !== "failed",
    twilioSid: result.sid || undefined,
  };
}

/**
 * Vérifie si un client a déjà un numéro attribué. Retourne null si non.
 */
export async function getAgentNumberForClient(
  clientId: string,
): Promise<WhatsAppNumber | null> {
  return getNumberForClient(clientId);
}
