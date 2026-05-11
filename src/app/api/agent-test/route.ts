import { NextResponse, type NextRequest } from "next/server";
import { chatWithAgent } from "@/agent/brain";
import { ensureLoaded, listClients, createClient } from "@/lib/db/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * /api/agent-test — endpoint public TEMPORAIRE pour tester le cerveau
 * directement depuis curl, sans passer par WhatsApp ni l'UI authentifiée.
 *
 * Si pas de clientId fourni : utilise le premier client en DB, ou crée un
 * client "Test Agent" si la DB est vide.
 *
 * À supprimer une fois qu'on a une UI de test propre côté admin.
 *
 * Usage:
 *   curl -X POST https://agenit-ia.vercel.app/api/agent-test \
 *     -H "Content-Type: application/json" \
 *     -d '{"message": "Salut, comment ça va ?"}'
 */

export async function POST(req: NextRequest) {
  try {
    await ensureLoaded();

    const body = (await req.json().catch(() => ({}))) as {
      message?: string;
      clientId?: string;
      conversationId?: string;
    };

    const message = (body.message ?? "").trim();
    if (!message) {
      return NextResponse.json(
        { ok: false, error: "message required" },
        { status: 400 },
      );
    }

    // Pick a clientId: explicit > first existing > create one
    let clientId = body.clientId;
    if (!clientId) {
      const clients = listClients();
      if (clients.length > 0) {
        clientId = clients[0].id;
      } else {
        const c = await createClient({
          name: "Test Agent (via /api/agent-test)",
          contactEmail: "test@agent-platform.local",
          industry: "Test",
        });
        clientId = c.id;
      }
    }

    const result = await chatWithAgent({
      clientId,
      conversationId: body.conversationId,
      userMessage: message,
      channel: "api",
    });

    return NextResponse.json({
      ok: true,
      clientId,
      conversationId: result.conversationId,
      reply: result.assistantMessage,
      toolUses: result.toolUses.map((t) => ({
        name: t.toolName,
        isError: t.isError,
      })),
      cost: {
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
        cents: result.costCents,
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: (err as Error).message,
        stack: (err as Error).stack?.split("\n").slice(0, 6).join("\n"),
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "agent-test",
    usage:
      "POST /api/agent-test avec { message: string, clientId?: string, conversationId?: string }",
  });
}
