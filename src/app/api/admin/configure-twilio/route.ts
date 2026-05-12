import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/admin/configure-twilio — configure automatiquement le webhook
 * Twilio WhatsApp Sandbox via l'API REST Twilio.
 *
 * Évite d'aller le chercher manuellement dans la console Twilio (Samuel
 * a passé 2h dessus hier).
 *
 * Body optionnel : { webhookUrl?: string }
 *   Si absent, utilise `https://agenit-ia.vercel.app/api/webhooks/whatsapp`.
 *
 * Endpoint Twilio Sandbox (legacy mais toujours actif en mai 2026) :
 *   POST /2010-04-01/Accounts/{AccountSid}/Sandbox.json
 *   Champs supportés : SmsUrl, SmsMethod, VoiceUrl, VoiceMethod
 *   Pour WhatsApp sandbox, c'est le même endpoint SmsUrl qui sert.
 */

interface TwilioSandboxResponse {
  account_sid?: string;
  pin?: string;
  phone_number?: string;
  sms_url?: string;
  sms_method?: string;
  voice_url?: string;
  voice_method?: string;
  uri?: string;
  // Erreurs
  code?: number;
  message?: string;
  more_info?: string;
  status?: number;
}

export async function POST(request: NextRequest) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken || accountSid.includes("placeholder")) {
    return NextResponse.json(
      {
        success: false,
        error:
          "TWILIO_ACCOUNT_SID ou TWILIO_AUTH_TOKEN absent / placeholder dans Vercel. Configure les vars en prod d'abord.",
      },
      { status: 400 },
    );
  }

  // Récupère l'URL du webhook (body JSON optionnel, sinon défaut)
  const body = (await request.json().catch(() => ({}))) as {
    webhookUrl?: string;
  };
  const defaultWebhook = "https://agenit-ia.vercel.app/api/webhooks/whatsapp";
  const webhookUrl = body.webhookUrl ?? defaultWebhook;

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Sandbox.json`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        SmsUrl: webhookUrl,
        SmsMethod: "POST",
      }).toString(),
    });

    const data = (await res.json()) as TwilioSandboxResponse;

    if (!res.ok) {
      return NextResponse.json(
        {
          success: false,
          error: data.message ?? `HTTP ${res.status}`,
          twilioCode: data.code,
          moreInfo: data.more_info,
          httpStatus: res.status,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      webhookUrl: data.sms_url,
      webhookMethod: data.sms_method,
      sandboxNumber: data.phone_number,
      joinCode: data.pin,
      message:
        "Webhook configuré ✅ Tu peux maintenant envoyer un message au sandbox.",
    });
  } catch (err) {
    console.error("[configure-twilio]", err);
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    service: "configure-twilio",
    method: "POST",
    description:
      "Configure le webhook WhatsApp Sandbox Twilio automatiquement via leur API REST. Body JSON optionnel: { webhookUrl?: string }. Sinon utilise https://agenit-ia.vercel.app/api/webhooks/whatsapp.",
    requires: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"],
  });
}
