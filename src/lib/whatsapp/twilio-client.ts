import "server-only";

/**
 * Wrapper Twilio API REST — envoi de messages WhatsApp.
 *
 * Utilise fetch direct (pas le SDK npm) pour rester léger.
 *
 * Doc Twilio :
 *   POST https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/Messages.json
 *   Body x-www-form-urlencoded : From=whatsapp:+33...&To=whatsapp:+33...&Body=...
 *   Auth Basic : AccountSid:AuthToken
 *
 * Mode démo : si TWILIO_ACCOUNT_SID/AUTH_TOKEN absents, on simule l'envoi
 * (retourne un faux SID, log un warning), pas d'erreur. Permet de tester
 * tout le flux end-to-end sans Twilio configuré.
 */

const TWILIO_API_BASE = "https://api.twilio.com/2010-04-01";

export interface SendWhatsAppInput {
  /** Numéro de l'agent (Twilio) au format E.164 : +33712345678 */
  from: string;
  /** Numéro du destinataire au format E.164 */
  to: string;
  /** Texte du message (max 1600 chars en WhatsApp) */
  body: string;
  /** URL d'un média à attacher (image, audio, vidéo, document) */
  mediaUrl?: string;
}

export interface SendWhatsAppResult {
  /** SID du message Twilio (MMxxx ou SMxxx). Faux SID en mode démo. */
  sid: string;
  /** Statut initial renvoyé par Twilio (queued le plus souvent) */
  status: string;
  /** Coût estimé en cents (Twilio facture ~$0.005-0.05 selon pays) */
  costCents: number;
  /** True si on a vraiment appelé Twilio, false si mock démo */
  realApiCall: boolean;
  errorCode?: string;
  errorMessage?: string;
}

interface TwilioCreateMessageResponse {
  sid: string;
  status: string;
  price?: string;
  price_unit?: string;
  error_code?: string;
  error_message?: string;
}

function isTwilioConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      !process.env.TWILIO_ACCOUNT_SID.includes("placeholder"),
  );
}

/**
 * Préfixe le numéro avec "whatsapp:" comme Twilio l'exige.
 * Tolère les numéros déjà préfixés.
 */
function toWhatsAppFormat(phone: string): string {
  if (phone.startsWith("whatsapp:")) return phone;
  return `whatsapp:${phone}`;
}

/**
 * Envoie un message WhatsApp via Twilio.
 *
 * Mode démo : retourne un faux SID sans appel réseau, log un warning.
 * Mode prod : POST Twilio API. Si erreur, retourne errorCode/errorMessage
 * sans throw (le caller décide quoi faire).
 */
export async function sendWhatsAppMessage(
  input: SendWhatsAppInput,
): Promise<SendWhatsAppResult> {
  // Kill switch contrôlé par env var Vercel. DÉSACTIVÉ par défaut pour
  // éviter tout envoi accidentel (incident spam du 12 mai 2026 où un
  // poll de test a déclenché 5 messages d'onboarding en boucle).
  //
  // Pour autoriser les envois : ajouter dans Vercel env vars
  //   WHATSAPP_SEND_ENABLED=true
  // Pour bloquer instantanément : remettre à false ou supprimer la var.
  //
  // Toujours bloqué par défaut → safe pour les développeurs qui poussent
  // du code sans réaliser que ça peut déclencher un envoi.
  if (process.env.WHATSAPP_SEND_ENABLED !== "true") {
    console.warn(
      `[twilio] WHATSAPP_SEND_ENABLED != "true" — message bloqué : ${input.from} → ${input.to} : "${input.body.slice(0, 50)}..."`,
    );
    return {
      sid: `BLOCKED_BY_FLAG_${Date.now()}`,
      status: "queued",
      costCents: 0,
      realApiCall: false,
    };
  }

  if (!isTwilioConfigured()) {
    console.warn(
      `[twilio] Mode démo (TWILIO_ACCOUNT_SID absent) — message non envoyé : ${input.from} → ${input.to} : "${input.body.slice(0, 50)}..."`,
    );
    return {
      sid: `DEMO_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      status: "queued",
      costCents: 0,
      realApiCall: false,
    };
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID!;
  const authToken = process.env.TWILIO_AUTH_TOKEN!;

  const formData = new URLSearchParams();
  formData.set("From", toWhatsAppFormat(input.from));
  formData.set("To", toWhatsAppFormat(input.to));
  formData.set("Body", input.body);
  if (input.mediaUrl) formData.set("MediaUrl", input.mediaUrl);

  try {
    const res = await fetch(
      `${TWILIO_API_BASE}/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      },
    );

    const json = (await res.json()) as TwilioCreateMessageResponse;

    if (!res.ok) {
      return {
        sid: "",
        status: "failed",
        costCents: 0,
        realApiCall: true,
        errorCode: json.error_code?.toString() ?? `HTTP_${res.status}`,
        errorMessage: json.error_message ?? `HTTP ${res.status}`,
      };
    }

    // price arrive sous forme "-0.0050" en USD (négatif = sortie de fonds)
    const priceUsd = json.price ? Math.abs(parseFloat(json.price)) : 0.005;
    const costCents = Math.round(priceUsd * 100);

    return {
      sid: json.sid,
      status: json.status,
      costCents,
      realApiCall: true,
    };
  } catch (err) {
    return {
      sid: "",
      status: "failed",
      costCents: 0,
      realApiCall: true,
      errorCode: "NETWORK_ERROR",
      errorMessage: (err as Error).message,
    };
  }
}

/**
 * Vérifie qu'une signature Twilio est valide (sécurité webhook).
 *
 * Twilio signe chaque webhook avec X-Twilio-Signature = HMAC-SHA1
 * du concaténat (URL + paramètres triés alphabétiquement).
 *
 * En mode démo (pas de TWILIO_AUTH_TOKEN), la vérification est skip
 * pour permettre les tests locaux.
 *
 * Doc : https://www.twilio.com/docs/usage/webhooks/webhooks-security
 */
export async function verifyTwilioSignature(input: {
  signature: string | null;
  url: string;
  params: Record<string, string>;
}): Promise<boolean> {
  if (!isTwilioConfigured()) return true; // skip en démo
  if (!input.signature) return false;

  const authToken = process.env.TWILIO_AUTH_TOKEN!;
  const sortedKeys = Object.keys(input.params).sort();
  const data =
    input.url +
    sortedKeys.map((k) => k + input.params[k]).join("");

  // HMAC-SHA1 via Web Crypto API
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(authToken),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    enc.encode(data),
  );
  const expected = Buffer.from(signatureBuffer).toString("base64");
  return expected === input.signature;
}
