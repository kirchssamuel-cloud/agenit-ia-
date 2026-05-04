import { NextResponse, type NextRequest } from "next/server";
import { chatWithAgent } from "@/agent/brain";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

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
      channel: "web",
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
