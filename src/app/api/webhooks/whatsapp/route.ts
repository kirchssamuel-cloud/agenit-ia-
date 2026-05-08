import { NextResponse, type NextRequest } from "next/server";
import { handleInboundMessage } from "@/lib/whatsapp/message-handler";
import { verifyTwilioSignature } from "@/lib/whatsapp/twilio-client";

/**
 * Webhook Twilio WhatsApp — POINT D'ENTRÉE des messages utilisateurs.
 *
 * Twilio envoie un POST x-www-form-urlencoded à chaque message reçu
 * sur l'un des numéros du pool. Format exact :
 *
 *   MessageSid=SMxxx
 *   From=whatsapp:+33612345678
 *   To=whatsapp:+33712345600       ← numéro agent attribué au client
 *   Body=Salut, je suis carreleur
 *   NumMedia=0
 *   ProfileName=Marc Dupont        (optionnel)
 *
 * Sécurité : Twilio signe chaque webhook avec X-Twilio-Signature.
 * On vérifie la signature avec TWILIO_AUTH_TOKEN. En mode démo (pas de
 * clé), la vérification est skip pour permettre les tests locaux/curl.
 *
 * Doc : https://www.twilio.com/docs/messaging/twiml#receiving-messages
 *
 * Le webhook DOIT être configuré dans Twilio Console :
 *   WhatsApp number → Messaging settings → Webhook URL :
 *   https://agenit-ia-spo6.vercel.app/api/webhooks/whatsapp
 *   HTTP method : POST
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // Buffer + crypto.subtle nécessaires

/** Préfixe "whatsapp:" → enlever pour avoir l'E.164 nu */
function stripWhatsAppPrefix(phone: string): string {
  return phone.replace(/^whatsapp:/, "").trim();
}

export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "INVALID_BODY" },
      { status: 400 },
    );
  }

  // Reconstruction des params en object pour la vérif signature
  const params: Record<string, string> = {};
  formData.forEach((value, key) => {
    if (typeof value === "string") params[key] = value;
  });

  // Vérification signature Twilio (skip en mode démo)
  const signature = request.headers.get("x-twilio-signature");
  // L'URL doit être l'URL exacte que Twilio a appelée (avec scheme + host)
  // x-forwarded-* sont nécessaires derrière Vercel.
  const url =
    process.env.TWILIO_WEBHOOK_URL ??
    `https://${request.headers.get("host")}${request.nextUrl.pathname}`;

  const valid = await verifyTwilioSignature({
    signature,
    url,
    params,
  });
  if (!valid) {
    console.warn(
      `[webhook/whatsapp] Signature invalide. signature=${signature?.slice(0, 20)}... url=${url}`,
    );
    return NextResponse.json(
      { ok: false, error: "INVALID_SIGNATURE" },
      { status: 401 },
    );
  }

  const from = params.From ? stripWhatsAppPrefix(params.From) : null;
  const to = params.To ? stripWhatsAppPrefix(params.To) : null;
  const body = params.Body ?? "";
  const messageSid = params.MessageSid ?? params.SmsMessageSid;

  if (!from || !to) {
    return NextResponse.json(
      { ok: false, error: "MISSING_FROM_OR_TO" },
      { status: 400 },
    );
  }

  // Détecter media (Twilio envoie MediaUrl0, MediaUrl1, ... + MediaContentType0)
  const mediaUrl = params.MediaUrl0;
  let messageType: "text" | "image" | "audio" | "video" | "document" = "text";
  if (mediaUrl) {
    const ct = params.MediaContentType0 ?? "";
    if (ct.startsWith("image/")) messageType = "image";
    else if (ct.startsWith("audio/")) messageType = "audio";
    else if (ct.startsWith("video/")) messageType = "video";
    else messageType = "document";
  }

  try {
    const result = await handleInboundMessage({
      fromUserPhone: from,
      toAgentPhone: to,
      body,
      twilioSid: messageSid,
      mediaUrl,
      messageType,
    });

    if (!result.ok) {
      console.error(
        `[webhook/whatsapp] handleInboundMessage failed : ${result.error}`,
      );
      // On répond 200 quand même pour que Twilio ne retry pas indéfiniment
      // (l'erreur est déjà loguée + persistée en DB).
    }

    // Twilio attend du TwiML ou un 200 vide. Comme on envoie nous-mêmes la
    // réponse via API REST (handleInboundMessage), on renvoie juste un OK.
    return new Response("", {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  } catch (err) {
    console.error(
      `[webhook/whatsapp] exception : ${(err as Error).message}`,
    );
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}

/**
 * GET : ping de santé pour vérifier que la route est joignable.
 * Twilio utilise POST, donc GET est juste pour debug humain.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "whatsapp-webhook",
    method: "POST",
    note: "Configure cette URL dans Twilio Console → numéro WhatsApp → Messaging webhook (POST).",
  });
}
