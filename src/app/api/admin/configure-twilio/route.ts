import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/admin/configure-twilio — tente plusieurs endpoints Twilio
 * pour configurer le webhook WhatsApp Sandbox automatiquement.
 *
 * En mai 2026, l'endpoint legacy /Sandbox.json renvoie 404 sur les
 * comptes récents. Twilio recommande officiellement de passer par la
 * console UI ("Sandbox settings > Sandbox configuration").
 *
 * Cet endpoint essaie donc 2 stratégies API avant de fallback sur des
 * instructions manuelles :
 *
 *   1. POST /2010-04-01/Accounts/{Sid}/Sandbox.json (legacy)
 *   2. PATCH https://messaging.twilio.com/v1/Services pour chaque
 *      Messaging Service trouvé qui contient le sandbox WhatsApp
 *
 * Si rien ne marche, retourne les instructions UI précises (path
 * exact dans la console, qu'on a galéré à trouver hier).
 */

interface ConfigAttempt {
  endpoint: string;
  status: number;
  ok: boolean;
  error?: string;
}

async function tryEndpoint(
  endpoint: string,
  accountSid: string,
  authToken: string,
  webhookUrl: string,
  method: "POST" | "PATCH" = "POST",
  extraBody: Record<string, string> = {},
): Promise<ConfigAttempt> {
  try {
    const res = await fetch(endpoint, {
      method,
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        SmsUrl: webhookUrl,
        SmsMethod: "POST",
        InboundRequestUrl: webhookUrl, // Pour Messaging Services
        ...extraBody,
      }).toString(),
    });
    const text = await res.text();
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }
    return {
      endpoint,
      status: res.status,
      ok: res.ok,
      error: res.ok
        ? undefined
        : `${(parsed.message as string) ?? `HTTP ${res.status}`} (code ${(parsed.code as string) ?? "?"})`,
    };
  } catch (err) {
    return {
      endpoint,
      status: 0,
      ok: false,
      error: (err as Error).message,
    };
  }
}

export async function POST(request: NextRequest) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken || accountSid.includes("placeholder")) {
    return NextResponse.json(
      {
        success: false,
        error: "TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN absent en prod.",
      },
      { status: 400 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    webhookUrl?: string;
  };
  const webhookUrl =
    body.webhookUrl ?? "https://agenit-ia.vercel.app/api/webhooks/whatsapp";

  const attempts: ConfigAttempt[] = [];

  // Stratégie 1 : endpoint legacy Sandbox
  attempts.push(
    await tryEndpoint(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Sandbox.json`,
      accountSid,
      authToken,
      webhookUrl,
    ),
  );

  // Stratégie 2 : lister les Messaging Services + configurer chacun
  try {
    const servicesRes = await fetch(
      "https://messaging.twilio.com/v1/Services",
      {
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
        },
      },
    );
    if (servicesRes.ok) {
      const servicesData = (await servicesRes.json()) as {
        services?: Array<{ sid: string; friendly_name?: string }>;
      };
      const services = servicesData.services ?? [];
      // Cherche un service qui ressemble à un sandbox WhatsApp
      const whatsappCandidates = services.filter((s) =>
        (s.friendly_name ?? "").toLowerCase().includes("whatsapp"),
      );
      const toConfigure =
        whatsappCandidates.length > 0 ? whatsappCandidates : services;
      for (const service of toConfigure.slice(0, 3)) {
        attempts.push(
          await tryEndpoint(
            `https://messaging.twilio.com/v1/Services/${service.sid}`,
            accountSid,
            authToken,
            webhookUrl,
            "POST",
          ),
        );
      }
    } else {
      attempts.push({
        endpoint: "messaging.twilio.com/v1/Services (list)",
        status: servicesRes.status,
        ok: false,
        error: `HTTP ${servicesRes.status}`,
      });
    }
  } catch (err) {
    attempts.push({
      endpoint: "messaging.twilio.com/v1/Services (list)",
      status: 0,
      ok: false,
      error: (err as Error).message,
    });
  }

  const anySuccess = attempts.some((a) => a.ok);

  if (anySuccess) {
    return NextResponse.json({
      success: true,
      webhookUrl,
      attempts,
      message: "Webhook configuré ✅",
    });
  }

  // Tous les endpoints API ont échoué — fallback : instructions manuelles
  return NextResponse.json(
    {
      success: false,
      error:
        "L'API Twilio ne permet plus de configurer le sandbox webhook via REST en 2026. À faire manuellement dans la console (1 fois).",
      attempts,
      manualInstructions: {
        step1: "Va sur https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn",
        step2: "Scrolle TOUT EN BAS de la page (sous le QR code et le numéro sandbox)",
        step3: "Tu trouveras une section 'Sandbox Configuration' avec 2 champs",
        step4: `Champ "When a message comes in" → colle : ${webhookUrl}`,
        step5: "Method : POST",
        step6: "Clique Save",
        alternativeUrl1:
          "https://console.twilio.com/us1/develop/sms/settings/whatsapp-sandbox (parfois fonctionne)",
        alternativeUrl2:
          "https://www.twilio.com/console/sms/whatsapp/sandbox (legacy, peut rediriger)",
      },
      webhookToConfigure: webhookUrl,
    },
    { status: 200 }, // 200 car on retourne du contenu utile, pas une erreur serveur
  );
}

export async function GET() {
  return NextResponse.json({
    service: "configure-twilio",
    method: "POST",
    description:
      "Tente de configurer le webhook WhatsApp Sandbox via plusieurs endpoints Twilio. Si tous échouent, retourne les instructions manuelles précises.",
    requires: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"],
  });
}
