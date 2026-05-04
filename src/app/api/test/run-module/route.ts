import { NextResponse, type NextRequest } from "next/server";
import { runModuleForClient } from "@/agent/runner";
import { listRunsForClient } from "@/lib/db/runs";

// Endpoint de test (DEV uniquement). À retirer ou protéger en prod.
export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    clientId: string;
    moduleId: string;
    payload: unknown;
  };

  try {
    const outcome = await runModuleForClient({
      clientId: body.clientId,
      moduleId: body.moduleId,
      payload: body.payload,
      bypassEnabledCheck: true,
    });
    const runs = await listRunsForClient(body.clientId, 5);
    return NextResponse.json({
      ok: true,
      summary: outcome.result.summary,
      durationMs: outcome.durationMs,
      data: outcome.result.data,
      recentRunsCount: runs.length,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
