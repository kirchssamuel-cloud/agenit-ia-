import { NextResponse, type NextRequest } from "next/server";
import { chatWithAgent } from "@/agent/brain";

// Endpoint de test (bypass auth — DEV uniquement, à retirer en prod)
export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    clientId: string;
    conversationId?: string;
    message: string;
  };
  if (!body.clientId || !body.message) {
    return NextResponse.json(
      { error: "clientId et message requis" },
      { status: 400 },
    );
  }
  try {
    const result = await chatWithAgent({
      clientId: body.clientId,
      conversationId: body.conversationId,
      userMessage: body.message,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message, stack: (err as Error).stack },
      { status: 500 },
    );
  }
}
