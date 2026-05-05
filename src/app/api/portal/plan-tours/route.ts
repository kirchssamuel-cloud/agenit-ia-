import { NextResponse, type NextRequest } from "next/server";
import { runModuleForClient } from "@/agent/runner";

// Endpoint public (côté portail client). Pas d'auth admin requise.
// À sécuriser quand on aura un vrai login client (ex: token de portail).
export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    clientId: string;
    appointments: Array<{
      id?: string;
      address: string;
      durationMinutes?: number;
      assignedToSalesId?: string;
    }>;
    sales: Array<{
      id?: string;
      name: string;
      homeAddress?: string;
      email?: string;
    }>;
    maxDriveMinutes?: number;
    workingHoursStart?: string;
  };

  if (!body.clientId) {
    return NextResponse.json({ error: "clientId requis" }, { status: 400 });
  }
  if (!body.appointments?.length) {
    return NextResponse.json({ error: "Au moins un RDV est requis" }, { status: 400 });
  }
  if (!body.sales?.length) {
    return NextResponse.json({ error: "Au moins un commercial est requis" }, { status: 400 });
  }

  // Auto-id si manquant
  const sales = body.sales.map((s, i) => ({ ...s, id: s.id ?? `s${i + 1}` }));
  const appointments = body.appointments.map((a, i) => ({
    ...a,
    id: a.id ?? `rdv${i + 1}`,
    durationMinutes: a.durationMinutes ?? 60,
  }));

  try {
    const outcome = await runModuleForClient({
      clientId: body.clientId,
      moduleId: "tour-planning",
      payload: { sales, appointments },
      bypassEnabledCheck: true,
    });
    return NextResponse.json({
      ok: outcome.result.ok,
      summary: outcome.result.summary,
      durationMs: outcome.durationMs,
      data: outcome.result.data,
      error: outcome.result.error,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
