import { NextResponse, type NextRequest } from "next/server";
import { runModuleForClient } from "@/agent/runner";

/**
 * Endpoint de test admin (sans auth pour faciliter le debug en dev).
 * À supprimer ou protéger avant prod.
 *
 * Usage:
 *   POST /api/test/run
 *   { "clientId": "...", "moduleId": "lead-cleaning", "payload": { ... } }
 */
export async function POST(request: NextRequest) {
  let body: { clientId?: string; moduleId?: string; payload?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  if (!body.clientId || !body.moduleId) {
    return NextResponse.json(
      { error: "clientId et moduleId requis" },
      { status: 400 },
    );
  }
  try {
    const outcome = await runModuleForClient({
      clientId: body.clientId,
      moduleId: body.moduleId,
      payload: body.payload,
      bypassEnabledCheck: true,
    });
    return NextResponse.json({ ok: true, outcome });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
