import { NextResponse, type NextRequest } from "next/server";
import { ensureLoaded, getClient } from "@/lib/db/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/agent-web/chat
 *
 * Bridge web ↔ chatWithAgent() sans passer par Twilio. Permet à un
 * client de parler à son agent depuis le navigateur — utilisé par
 * /client-area/test-agent et par les premiers testeurs avant qu'on
 * branche WhatsApp côté commercial.
 *
 * Body :
 *  {
 *    clientId: string,        // UUID du client
 *    userMessage: string,     // texte à envoyer à l'agent
 *    conversationId?: string  // pour continuer une conversation
 *  }
 *
 * Réponse :
 *  {
 *    ok: true,
 *    conversationId: string,
 *    assistantMessage: string,
 *    toolUses: [...],
 *    costCents: number,
 *    tokensIn: number,
 *    tokensOut: number,
 *    durationMs: number
 *  }
 *
 * Sécurité MVP :
 *  - clientId présent → 404 sinon
 *  - userMessage limité à 4000 chars
 *  - Rate limit par clientId : 30 calls / 10 min in-memory (cap dur)
 *
 * Le rate limit in-memory n'est pas partagé entre lambdas Vercel donc
 * un attaquant pourrait théoriquement obtenir N×30 calls. Acceptable
 * en phase test : ça bloque l'abus naïf. Pour la prod réelle, plug
 * Upstash Redis ou similaire.
 */

// ============================================================
// Rate limit in-memory : 30 calls / 10 min par clientId
// ============================================================

interface RateBucket {
  count: number;
  resetAt: number;
}
const RATE_BUCKETS = new Map<string, RateBucket>();
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 10 * 60_000;

function checkRateLimit(clientId: string): {
  ok: boolean;
  retryAfterSec?: number;
} {
  const now = Date.now();
  const bucket = RATE_BUCKETS.get(clientId);
  if (!bucket || bucket.resetAt < now) {
    RATE_BUCKETS.set(clientId, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return { ok: true };
  }
  if (bucket.count >= RATE_LIMIT_MAX) {
    return {
      ok: false,
      retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }
  bucket.count += 1;
  return { ok: true };
}

export async function POST(request: NextRequest) {
  const t0 = Date.now();

  let body: { clientId?: string; userMessage?: string; conversationId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }

  const { clientId, userMessage, conversationId } = body;

  if (!clientId || typeof clientId !== "string") {
    return NextResponse.json(
      { ok: false, error: "clientId (string) requis" },
      { status: 400 },
    );
  }
  if (!userMessage || typeof userMessage !== "string" || !userMessage.trim()) {
    return NextResponse.json(
      { ok: false, error: "userMessage (string non vide) requis" },
      { status: 400 },
    );
  }
  if (userMessage.length > 4000) {
    return NextResponse.json(
      { ok: false, error: "userMessage trop long (max 4000 chars)" },
      { status: 400 },
    );
  }

  // Rate limit AVANT de charger le client + Anthropic
  const rl = checkRateLimit(clientId);
  if (!rl.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: `Trop de requêtes. Réessaie dans ${rl.retryAfterSec}s.`,
        retryAfterSec: rl.retryAfterSec,
      },
      {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSec ?? 60) },
      },
    );
  }

  await ensureLoaded();
  if (!getClient(clientId)) {
    return NextResponse.json(
      { ok: false, error: "Client introuvable" },
      { status: 404 },
    );
  }

  try {
    // Import dynamique pour éviter de charger Anthropic SDK si Vercel
    // démarre la route à froid sans en avoir besoin ailleurs.
    const { chatWithAgent } = await import("@/agent/brain");
    const result = await chatWithAgent({
      clientId,
      userMessage,
      conversationId,
      channel: "web",
    });

    return NextResponse.json({
      ok: true,
      conversationId: result.conversationId,
      assistantMessage: result.assistantMessage,
      toolUses: result.toolUses,
      costCents: result.costCents,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      durationMs: Date.now() - t0,
    });
  } catch (err) {
    const msg = (err as Error).message;
    // Mode démo (pas de clé Anthropic) → on retourne un 503 informatif
    // plutôt que 500 pour que l'UI puisse afficher un message lisible.
    if (msg.includes("ANTHROPIC_API_KEY")) {
      return NextResponse.json(
        {
          ok: false,
          error: "ANTHROPIC_API_KEY non configurée sur ce déploiement",
          hint: "Ajoute la clé dans Vercel → Settings → Environment Variables.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { ok: false, error: msg, durationMs: Date.now() - t0 },
      { status: 500 },
    );
  }
}
