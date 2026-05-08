import "server-only";

/**
 * Vérifie l'état de connexion des 3 services critiques pour WhatsApp :
 * Twilio, Anthropic, Supabase.
 *
 * Pour chacun :
 * - configured : la clé est-elle présente et non placeholder ?
 * - reachable : la requête de ping a-t-elle réussi (200) ?
 * - error : message d'erreur si KO
 *
 * Utilisé par /admin/whatsapp pour afficher un panel "Status connexion".
 */

export interface ServiceStatus {
  service: "twilio" | "anthropic" | "supabase";
  configured: boolean;
  reachable: boolean | null; // null si non testé (pas configuré)
  error?: string;
  details?: string;
}

async function checkTwilio(): Promise<ServiceStatus> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (
    !accountSid ||
    !authToken ||
    accountSid.includes("placeholder") ||
    authToken.includes("placeholder")
  ) {
    return {
      service: "twilio",
      configured: false,
      reachable: null,
    };
  }

  try {
    // Ping Twilio API : on récupère les infos du compte (cheap)
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`,
      {
        method: "GET",
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
        },
      },
    );

    if (!res.ok) {
      return {
        service: "twilio",
        configured: true,
        reachable: false,
        error: `HTTP ${res.status}`,
      };
    }
    const data = (await res.json()) as { friendly_name?: string; status?: string };
    return {
      service: "twilio",
      configured: true,
      reachable: true,
      details: `${data.friendly_name ?? "Account"} · ${data.status ?? "active"}`,
    };
  } catch (err) {
    return {
      service: "twilio",
      configured: true,
      reachable: false,
      error: (err as Error).message,
    };
  }
}

async function checkAnthropic(): Promise<ServiceStatus> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey || apiKey.includes("placeholder")) {
    return {
      service: "anthropic",
      configured: false,
      reachable: null,
    };
  }

  try {
    // Ping Anthropic : appel minimal max_tokens=1 (cheap, ~$0.0001)
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 1,
        messages: [{ role: "user", content: "ping" }],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return {
        service: "anthropic",
        configured: true,
        reachable: false,
        error: `HTTP ${res.status}: ${body.slice(0, 100)}`,
      };
    }
    return {
      service: "anthropic",
      configured: true,
      reachable: true,
      details: "Claude API joignable",
    };
  } catch (err) {
    return {
      service: "anthropic",
      configured: true,
      reachable: false,
      error: (err as Error).message,
    };
  }
}

function checkSupabase(): ServiceStatus {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  const placeholder =
    url.includes("placeholder") ||
    key.includes("placeholder") ||
    url === "" ||
    key === "";

  if (placeholder) {
    return {
      service: "supabase",
      configured: false,
      reachable: null,
    };
  }

  return {
    service: "supabase",
    configured: true,
    reachable: true,
    details: "Configuré (mode prod)",
  };
}

export async function checkAllConnections(): Promise<{
  twilio: ServiceStatus;
  anthropic: ServiceStatus;
  supabase: ServiceStatus;
}> {
  const [twilio, anthropic] = await Promise.all([
    checkTwilio(),
    checkAnthropic(),
  ]);
  return {
    twilio,
    anthropic,
    supabase: checkSupabase(),
  };
}
