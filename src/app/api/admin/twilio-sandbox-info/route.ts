import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * /api/admin/twilio-sandbox-info — retourne le code "join" du sandbox
 * WhatsApp ACTUEL, en parsant les messages récents envoyés par Twilio.
 *
 * Le code est dans les replies auto type :
 *   "Twilio Sandbox: ✅ You are all set! ..."
 *   "with the code: join XXX-YYYY"
 *
 * On liste les 50 derniers messages incoming, on cherche un "join XXX YYY"
 * dans les bodies. Si trouvé, on le retourne. Sinon on dit "introuvable —
 * va voir la console Twilio".
 */

interface TwilioMessage {
  body?: string;
  from?: string;
  to?: string;
  direction?: string;
  date_sent?: string;
}

interface TwilioMessagesResponse {
  messages?: TwilioMessage[];
}

export async function GET() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token || sid.includes("placeholder")) {
    return NextResponse.json(
      { ok: false, error: "TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN absent" },
      { status: 400 },
    );
  }

  try {
    // Récupère les 50 derniers messages
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json?PageSize=50`,
      {
        headers: {
          Authorization:
            "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
        },
      },
    );
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `Twilio HTTP ${res.status}` },
        { status: 500 },
      );
    }
    const data = (await res.json()) as TwilioMessagesResponse;
    const messages = data.messages ?? [];

    // Cherche le code "join XXX YYY" dans n'importe quel body
    const joinRegex = /join\s+([a-z0-9-]+(?:[\s-][a-z0-9-]+)?)/i;
    let foundCode: string | null = null;
    let foundIn: string | null = null;
    const sandboxMessages: Array<{
      direction: string;
      from: string;
      to: string;
      body: string;
      date: string;
    }> = [];

    for (const m of messages) {
      const body = m.body ?? "";
      // Garde tous les messages qui mentionnent sandbox / join / code
      if (
        /sandbox|join\s|all set|connected/i.test(body) ||
        m.from?.includes("14155238886") ||
        m.to?.includes("14155238886")
      ) {
        sandboxMessages.push({
          direction: m.direction ?? "?",
          from: m.from ?? "?",
          to: m.to ?? "?",
          body: body.slice(0, 500),
          date: m.date_sent ?? "?",
        });
      }
      // Cherche le code dans les outbound de Twilio Sandbox
      if (body.toLowerCase().includes("join ")) {
        const match = body.match(joinRegex);
        if (match && !foundCode) {
          foundCode = match[0]; // "join XXX YYY"
          foundIn = body.slice(0, 200);
        }
      }
    }

    return NextResponse.json({
      ok: true,
      foundJoinCode: foundCode,
      foundInMessage: foundIn,
      sandboxNumber: "+14155238886",
      hint: foundCode
        ? `Sur WhatsApp, envoie EXACTEMENT au +14155238886 : "${foundCode}"`
        : "Aucun code 'join XXX' trouvé dans les 50 derniers messages. Va voir https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn",
      recentSandboxMessages: sandboxMessages.slice(0, 10),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
